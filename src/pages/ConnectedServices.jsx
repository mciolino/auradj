import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { CheckCircle2, Music, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ServiceCard from '@/components/services/ServiceCard';
import { useSpotify } from '@/context/SpotifyContext';

const SERVICES = [
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Import playlists, export mixes, stream music',
    color: '#1DB954',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png',
    authUrl: 'https://accounts.spotify.com/authorize',
    features: ['Import playlists', 'Export mixes', 'In-app streaming (SDK)', 'AI taste analysis'],
    connectInstructions: 'Connect your Spotify Premium account to stream music and get AI-powered mix recommendations.',
  },
  {
    id: 'apple_music',
    name: 'Apple Music',
    description: 'Access your Apple Music library and playlists',
    color: '#FA233B',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Apple_Music_icon.svg/200px-Apple_Music_icon.svg.png',
    authUrl: null,
    features: ['Import playlists', 'Open in Apple Music', 'Library access'],
    connectInstructions: 'Connect via MusicKit JS to access your Apple Music library.',
  },
  {
    id: 'youtube_music',
    name: 'YouTube Music',
    description: 'Huge library of music and music videos',
    color: '#FF0000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/200px-Youtube_Music_icon.svg.png',
    authUrl: null,
    features: ['Deep-link playback', 'Open tracks in YouTube Music'],
    connectInstructions: 'Link your YouTube account to open tracks in YouTube Music.',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    description: 'Independent artists and underground music',
    color: '#FF5500',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Antu_soundcloud.svg/200px-Antu_soundcloud.svg.png',
    authUrl: null,
    features: ['Import liked tracks', 'Export mixes', 'Deep-link playback'],
    connectInstructions: 'Connect SoundCloud to import your liked tracks and reposts.',
  },
  {
    id: 'pandora',
    name: 'Pandora',
    description: 'Personalized radio and on-demand music',
    color: '#3668FF',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Pandora_logo_2022.svg/200px-Pandora_logo_2022.svg.png',
    authUrl: null,
    features: ['Open in Pandora', 'Station deep-links'],
    connectInstructions: 'Open AuraDJ mixes as Pandora stations.',
    comingSoon: true,
  },
  {
    id: 'tidal',
    name: 'Tidal',
    description: 'High-fidelity music streaming',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Tidal_logo.svg/200px-Tidal_logo.svg.png',
    authUrl: null,
    features: ['HiFi streaming', 'Import playlists', 'Export mixes'],
    connectInstructions: 'Connect your Tidal account for high-fidelity playback.',
    comingSoon: true,
  },
];

const SPOTIFY_CLIENT_ID = '4c10b0a13fe74b11a90713e21ca7eb3e';
const SPOTIFY_REDIRECT_URI = 'https://echo-dj-flow.base44.app/services';
// Added user-top-read + user-read-recently-played for taste analysis
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'user-library-read',
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
].join(' ');

export default function ConnectedServices() {
  const [connected, setConnected] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { reconnect } = useSpotify();

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me().catch(() => null);
      setCurrentUser(me);
      if (me?.connected_services) setConnected(me.connected_services);

      // Handle Spotify OAuth callback (code in URL)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code && me) {
        setExchanging(true);
        window.history.replaceState({}, '', '/services');
        try {
          const res = await base44.functions.invoke('spotifyAuth', { action: 'exchange', code });
          if (res.data?.success) {
            const updated = await base44.auth.me();
            setConnected(updated.connected_services || {});
            toast.success(`Spotify connected as ${res.data.display_name}!`);
            reconnect();

            // Immediately kick off taste analysis in background
            setAnalyzing(true);
            try {
              await base44.functions.invoke('spotifyAnalyze', { action: 'analyze' });
              toast.success('🎵 Taste profile built — your For You mix is ready!', { duration: 4000 });
            } catch (e) {
              console.warn('[ConnectedServices] analyze failed:', e);
            } finally {
              setAnalyzing(false);
            }
          } else {
            toast.error(res.data?.error || 'Spotify connection failed. Try again.');
          }
        } catch (e) {
          console.error('[ConnectedServices] Spotify exchange failed:', e);
          toast.error(e?.response?.data?.error || e?.message || 'Spotify connection failed. Check Spotify app redirect settings.');
        } finally {
          setExchanging(false);
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleConnect = async (service) => {
    if (!currentUser) { toast.error('Sign in first'); return; }
    if (service.comingSoon) { toast.info(`${service.name} integration coming soon!`); return; }

    if (service.id === 'spotify') {
      const url = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`;
      window.location.href = url;
      return;
    }

    const updated = { ...connected, [service.id]: { connected: true, connected_at: new Date().toISOString() } };
    setConnected(updated);
    await base44.auth.updateMe({ connected_services: updated });
    toast.success(`${service.name} connected!`);
  };

  const handleDisconnect = async (service) => {
    if (service.id === 'spotify') {
      await base44.functions.invoke('spotifyAuth', { action: 'disconnect' });
    } else {
      const updated = { ...connected };
      delete updated[service.id];
      setConnected(updated);
      await base44.auth.updateMe({ connected_services: updated });
    }
    setConnected(prev => { const u = { ...prev }; delete u[service.id]; return u; });
    toast.success(`${service.name} disconnected`);
  };

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await base44.functions.invoke('spotifyAnalyze', { action: 'analyze' });
      toast.success('Taste profile refreshed!');
    } catch (e) {
      toast.error('Analysis failed — try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading || exchanging) return (
    <div className="pt-14 min-h-screen flex items-center justify-center flex-col gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      {exchanging && <p className="text-muted-foreground text-sm">Connecting to Spotify...</p>}
    </div>
  );

  const connectedCount = Object.keys(connected).length;
  const spotifyConnected = !!connected?.spotify?.connected;

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-heading mb-2">Connected Services</h1>
            <p className="text-muted-foreground">
              Link your streaming accounts to import playlists, export mixes, and get AI-powered mix recommendations.
            </p>
            {connectedCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 text-sm text-primary bg-accent px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                {connectedCount} service{connectedCount > 1 ? 's' : ''} connected
              </div>
            )}
          </div>

          {/* Spotify taste profile status */}
          {spotifyConnected && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#1DB954]/30 bg-[#1DB954]/5"
            >
              <div className="flex items-center gap-2.5 text-sm">
                <Sparkles className="w-4 h-4 text-[#1DB954]" />
                <span className="font-medium text-foreground">Taste profile active</span>
                <span className="text-muted-foreground">— AuraDJ is learning your listening habits</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReanalyze}
                disabled={analyzing}
                className="text-xs border-[#1DB954]/40 text-[#1DB954] hover:bg-[#1DB954]/10 shrink-0"
              >
                {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
              </Button>
            </motion.div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICES.map((service, i) => (
              <motion.div key={service.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <ServiceCard
                  service={service}
                  isConnected={!!connected[service.id]}
                  onConnect={() => handleConnect(service)}
                  onDisconnect={() => handleDisconnect(service)}
                />
              </motion.div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-start gap-3">
              <Music className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About streaming integrations</p>
                <p>Full in-app streaming requires Spotify Premium. Connecting Spotify also enables AuraDJ's AI taste engine — it analyzes your listening history to suggest mixes and predict what you'll love next.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
