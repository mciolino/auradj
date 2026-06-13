import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useSpotify } from '@/context/SpotifyContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Pause, Sparkles, RefreshCw, Zap, Music2, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// Energy bar — electric lime for high energy, fades to muted for low
function EnergyBar({ value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: pct > 75 ? '#C8FF00' : pct > 45 ? '#86efac' : '#60a5fa',
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}

// Arc position label
const ARC_LABELS = ['INTRO', 'BUILD', 'BUILD', 'PEAK', 'PEAK', 'PEAK', 'SUSTAIN', 'SUSTAIN', 'OUTRO', 'OUTRO'];
function arcLabel(index, total) {
  const slot = Math.floor((index / total) * ARC_LABELS.length);
  return ARC_LABELS[Math.min(slot, ARC_LABELS.length - 1)];
}

function arcColor(label) {
  switch (label) {
    case 'INTRO':   return 'text-blue-400';
    case 'BUILD':   return 'text-yellow-400';
    case 'PEAK':    return 'text-[#C8FF00]';
    case 'SUSTAIN': return 'text-orange-400';
    case 'OUTRO':   return 'text-blue-400';
    default:        return 'text-muted-foreground';
  }
}

export default function ForYouPanel({ onApplyMix }) {
  const { connected, playTrack, currentSpotifyTrack, isPaused, player } = useSpotify();
  const [playlist, setPlaylist] = useState([]);
  const [mixHint, setMixHint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(null); // null = unknown
  const [activeTrackUri, setActiveTrackUri] = useState(null);

  // Check if we have a taste profile on mount
  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const res = await base44.functions.invoke('spotifyAnalyze', { action: 'profile' });
      setHasProfile(!!res?.data?.profile);
      if (res?.data?.profile) loadPlaylist();
    } catch (_) {
      setHasProfile(false);
    }
  };

  const loadPlaylist = useCallback(async (size = 20) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('spotifyAnalyze', {
        action: 'recommend',
        playlist_size: size,
      });
      if (res?.data?.ok) {
        setPlaylist(res.data.playlist || []);
        setMixHint(res.data.mix_hint || null);
      } else {
        toast.error(res?.data?.error || 'Could not load recommendations');
      }
    } catch (e) {
      toast.error('Failed to load your mix');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBuildProfile = async () => {
    setLoading(true);
    try {
      await base44.functions.invoke('spotifyAnalyze', { action: 'analyze' });
      setHasProfile(true);
      await loadPlaylist();
      toast.success('Taste profile built!');
    } catch (e) {
      toast.error('Analysis failed — make sure Spotify is connected');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = (track) => {
    if (!connected) { toast.error('Connect Spotify in Connected Services'); return; }
    if (activeTrackUri === track.uri && !isPaused) {
      player?.togglePlay();
    } else {
      setActiveTrackUri(track.uri);
      playTrack(track.uri);
    }
  };

  const handleApplyMix = () => {
    if (!mixHint || !onApplyMix) return;
    onApplyMix({
      genre: mixHint.suggested_genre,
      mood: mixHint.suggested_mood,
      bpm: mixHint.suggested_bpm,
      energy: mixHint.suggested_energy,
    });
    toast.success('Mix settings applied from your Spotify DNA 🎛️');
  };

  // Not connected to Spotify
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#1DB954]" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold mb-1">Connect Spotify to unlock For You</p>
          <p className="text-xs text-muted-foreground">AuraDJ analyzes your listening history to build mixes tailored to your taste.</p>
        </div>
        <Button size="sm" asChild className="gap-2 bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-semibold">
          <Link to="/services">
            Connect Spotify
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  // No profile yet
  if (hasProfile === false) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
        <div className="w-12 h-12 rounded-full border border-dashed border-primary/40 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1">No taste profile yet</p>
          <p className="text-xs text-muted-foreground">Let AuraDJ scan your Spotify history to build your personal mix DNA.</p>
        </div>
        <Button size="sm" onClick={handleBuildProfile} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Build My Profile
        </Button>
      </div>
    );
  }

  // Loading first time
  if (loading && !playlist.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Building your predictive mix...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mix DNA header */}
      {mixHint && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card/60 p-3 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold">Your Mix DNA</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => loadPlaylist()}
              disabled={loading}
              title="Refresh playlist"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Genre + mood pills */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] py-0.5 gap-1">
              <Music2 className="w-2.5 h-2.5" />
              {mixHint.suggested_genre}
            </Badge>
            <Badge variant="secondary" className="text-[10px] py-0.5">
              {mixHint.suggested_mood}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0.5">
              {mixHint.suggested_bpm} BPM
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0.5">
              Energy {mixHint.suggested_energy}/10
            </Badge>
          </div>

          {/* Top artists */}
          {mixHint.top_artists?.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Inspired by <span className="text-foreground">{mixHint.top_artists.slice(0, 3).join(', ')}</span>
            </p>
          )}

          {/* Apply button */}
          {onApplyMix && (
            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
              variant="ghost"
              onClick={handleApplyMix}
            >
              <Zap className="w-3 h-3" />
              Apply to session controls
            </Button>
          )}
        </motion.div>
      )}

      {/* Playlist */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {playlist.length} tracks · energy arc
          </p>
        </div>

        <AnimatePresence>
          {playlist.map((track, i) => {
            const isActive = currentSpotifyTrack?.uri === track.uri || activeTrackUri === track.uri;
            const isPlaying = isActive && !isPaused;
            const label = arcLabel(i, playlist.length);

            return (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.018 }}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  isActive ? 'bg-primary/8 border border-primary/15' : 'hover:bg-secondary/60'
                }`}
                onClick={() => handlePlayTrack(track)}
              >
                {/* Track number / play indicator */}
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isActive ? (
                    isPlaying
                      ? <Pause className="w-3.5 h-3.5 text-primary" />
                      : <Play className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <>
                      <span className="text-[10px] text-muted-foreground group-hover:hidden tabular-nums">{i + 1}</span>
                      <Play className="w-3.5 h-3.5 text-muted-foreground hidden group-hover:block" />
                    </>
                  )}
                </div>

                {/* Album art */}
                {track.album_art ? (
                  <img
                    src={track.album_art}
                    alt=""
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-secondary flex-shrink-0 flex items-center justify-center">
                    <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate leading-tight ${isActive ? 'text-primary' : ''}`}>
                    {track.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{track.artists}</p>
                </div>

                {/* Arc label + energy */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className={`text-[8px] font-bold tracking-wider ${arcColor(label)}`}>{label}</span>
                  <EnergyBar value={track.energy} />
                </div>

                {/* BPM pill */}
                <span className="text-[9px] text-muted-foreground tabular-nums flex-shrink-0 w-10 text-right">
                  {track.bpm}bpm
                </span>

                {/* External link */}
                {track.external_url && (
                  <a
                    href={track.external_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
