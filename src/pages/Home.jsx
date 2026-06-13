import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, TrendingUp, Users, Disc3, Zap, Music2, ChevronRight } from 'lucide-react';
import MixCard from '@/components/common/MixCard';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useSpotify } from '@/context/SpotifyContext';

// Genre pill colors
const GENRE_COLORS = {
  'House':       { bg: '#7c3aed22', border: '#7c3aed44', text: '#a78bfa' },
  'Techno':      { bg: '#dc262622', border: '#dc262644', text: '#f87171' },
  'Lo-Fi':       { bg: '#0284c722', border: '#0284c744', text: '#38bdf8' },
  'Drum & Bass': { bg: '#d97706 22', border: '#d9770644', text: '#fbbf24' },
  'Electronic':  { bg: '#05966922', border: '#05966944', text: '#34d399' },
  'Ambient':     { bg: '#475569 22', border: '#47556944', text: '#94a3b8' },
  'Synthwave':   { bg: '#db277722', border: '#db277744', text: '#f472b6' },
  'Hip-Hop':     { bg: '#92400e22', border: '#92400e44', text: '#fbbf24' },
  'Trap':        { bg: '#1e293b',   border: '#334155',   text: '#e2e8f0' },
};
function genreStyle(genre) {
  return GENRE_COLORS[genre] || { bg: '#1e293b', border: '#334155', text: '#94a3b8' };
}

function TrendingGenreCard({ genre, index }) {
  const s = genreStyle(genre.genre);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 200 }}
    >
      <Link to={`/session?genre=${encodeURIComponent(genre.genre)}&mood=${encodeURIComponent((genre.mood_tags || [])[0] || '')}`}>
        <div
          className="relative rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition-transform duration-200 overflow-hidden"
          style={{ background: s.bg, borderColor: s.border }}
        >
          {/* Cover art */}
          {genre.cover_art_url && (
            <div className="absolute inset-0 opacity-10">
              <img src={genre.cover_art_url} className="w-full h-full object-cover" alt="" />
            </div>
          )}
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: s.text }}>
                #{index + 1}
              </span>
              {genre.trend_score && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: s.border, color: s.text }}>
                  ↑ {genre.trend_score}
                </span>
              )}
            </div>
            <p className="font-bold text-sm text-foreground mb-1">{genre.genre}</p>
            <p className="text-[10px] text-muted-foreground">
              {genre.bpm_min}–{genre.bpm_max} BPM
            </p>
            {(genre.mood_tags || []).slice(0, 2).map(t => (
              <span key={t} className="inline-block text-[9px] mt-1 mr-1 px-1.5 py-0.5 rounded-full"
                style={{ background: s.border, color: s.text }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PersonalizedRow({ profile }) {
  if (!profile) return null;
  const topGenre = (profile.top_genres || [])[0];
  const topMood = (profile.top_moods || [])[0];
  const artists = (profile.spotify_top_artists || []).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1DB954]/15 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1DB954]" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#1DB954]">Your Spotify DNA is active</p>
          <p className="text-xs text-muted-foreground">
            {topGenre && topMood ? `${topGenre} · ${topMood}` : 'Taste profile ready'}
            {profile.preferred_bpm_min ? ` · ${profile.preferred_bpm_min}–${profile.preferred_bpm_max} BPM` : ''}
          </p>
        </div>
      </div>

      {artists.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
          {artists.map(a => (
            <span key={a} className="text-[11px] px-2 py-1 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954]">
              {a}
            </span>
          ))}
        </div>
      )}

      <Link to="/session" className="shrink-0">
        <Button size="sm" className="gap-1.5 bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-semibold text-xs">
          <Zap className="w-3 h-3" />
          Start For You Session
        </Button>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('trending');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [trendingGenres, setTrendingGenres] = useState([]);
  const { connected } = useSpotify();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('premium') === 'success') {
      toast.success('Welcome to AuraDJ Premium! 🎉');
      window.history.replaceState({}, '', '/');
    } else if (params.get('premium') === 'cancelled') {
      toast.info('Checkout cancelled — upgrade anytime from the DJ Studio.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.DJSession.filter({ is_public: true, is_saved: true }, '-play_count', 24),
      base44.entities.TrendingGenre.list('-trend_score', 8).catch(() => []),
      base44.functions.invoke('spotifyAnalyze', { action: 'profile' }).catch(() => null),
    ]).then(([sessData, genreData, profileRes]) => {
      setSessions(sessData);
      setTrendingGenres(genreData || []);
      if (profileRes?.data?.profile) setTasteProfile(profileRes.data.profile);
    }).finally(() => setLoading(false));
  }, []);

  const trendingMixes = sessions.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));

  return (
    <div className="pt-14 min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-accent/20 to-background px-4 py-16 sm:py-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Music Generation
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto text-balance mb-4">
            Your personal AI DJ,{' '}
            <span className="text-primary">always on.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 text-pretty">
            Generate original music, create seamless mixes, and discover new sounds — all powered by AI that listens to you.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/session">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 pulse-glow">
                <Sparkles className="w-4 h-4" />
                Start DJ Session
              </Button>
            </Link>
            <Link to="/discover">
              <Button size="lg" variant="outline" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Explore Mixes
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Decorative waveform */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 h-12 opacity-10 pointer-events-none">
          {[...Array(60)].map((_, i) => (
            <div key={i} className="bg-primary rounded-full w-1" style={{ height: `${20 + Math.sin(i * 0.4) * 40 + Math.random() * 20}%` }} />
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">

        {/* Spotify DNA Banner */}
        {tasteProfile && <PersonalizedRow profile={tasteProfile} />}

        {/* CTA to connect Spotify if not connected */}
        {!connected && !tasteProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-dashed border-border p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-10 h-10 rounded-full bg-[#1DB954]/10 flex items-center justify-center shrink-0">
              <Music2 className="w-5 h-5 text-[#1DB954]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-0.5">Unlock personalized mixes</p>
              <p className="text-xs text-muted-foreground">Connect Spotify and AuraDJ will analyze your taste to build mixes made for you.</p>
            </div>
            <Link to="/services">
              <Button size="sm" variant="outline" className="gap-2 border-[#1DB954]/30 text-[#1DB954] hover:bg-[#1DB954]/10">
                Connect Spotify <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Trending Genres */}
        {trendingGenres.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Trending Genres
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">What's moving right now</p>
              </div>
              <Link to="/session">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  Mix one <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {trendingGenres.map((g, i) => (
                <TrendingGenreCard key={g.id} genre={g} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Mixes section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-heading">Trending Mixes</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Discover what's hot right now</p>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="trending" className="gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Trending
                </TabsTrigger>
                <TabsTrigger value="following" className="gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Following
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square rounded-xl bg-secondary animate-pulse" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : trendingMixes.length === 0 ? (
            <div className="text-center py-24">
              <Disc3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No mixes yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to create and share an AI mix!</p>
              <Link to="/session">
                <Button className="gap-2">
                  <Sparkles className="w-4 h-4" /> Create First Mix
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {trendingMixes.map((session, i) => (
                <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <MixCard session={session} />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
