import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useSpotify } from '@/context/SpotifyContext';
import {
  Search, X, Loader2, Music2, Radio,
  ExternalLink, Plus, CheckCircle2, Crown, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * TrackSearch
 *
 * Playback priority per track:
 *   1. Spotify Web Playback SDK (full track, requires Premium + connected)
 *   2. 30s preview_url via Tone.js (always available, no auth)
 *
 * Props:
 *   onLoadDeck(side, track)   — load into Tone.js player (preview or full)
 *   onSpotifyDeck(side, track) — load via Spotify SDK (full track)
 *   onAddToQueue(track)
 *   savedTracks               — tracks already in the session
 */

// ── Normalise raw Spotify API track → internal shape ─────────────────────────
function normaliseSpotify(raw) {
  return {
    id:               `spotify:${raw.id}`,
    spotify_id:       raw.id,
    spotify_uri:      raw.uri,
    source:           'spotify',
    title:            raw.name,
    artist:           raw.artists?.map(a => a.name).join(', ') || '',
    album:            raw.album?.name || '',
    cover_art_url:    raw.album?.images?.[0]?.url || null,
    preview_url:      raw.preview_url || null,
    audio_url:        raw.preview_url || null, // Tone.js fallback
    duration_seconds: Math.round((raw.duration_ms || 0) / 1000),
    bpm:              0,
    genre:            '',
    popularity:       raw.popularity || 0,
    external_url:     raw.external_urls?.spotify || '',
    explicit:         raw.explicit || false,
  };
}

// ── Playback mode badge ───────────────────────────────────────────────────────
function PlaybackBadge({ hasPreview, spotifyReady }) {
  if (spotifyReady) return (
    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
      style={{ background: 'rgba(29,185,84,0.18)', color: '#1DB954', border: '1px solid #1DB95433' }}>
      <Crown className="w-2.5 h-2.5" /> Full
    </span>
  );
  if (hasPreview) return (
    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
      style={{ background: 'rgba(200,255,0,0.12)', color: '#C8FF00', border: '1px solid #C8FF0033' }}>
      <Zap className="w-2.5 h-2.5" /> 30s
    </span>
  );
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
      no audio
    </span>
  );
}

// ── Source pill ───────────────────────────────────────────────────────────────
function SourcePill({ source }) {
  const cfg = {
    spotify:    { label: 'Spotify',    color: '#1DB954' },
    soundcloud: { label: 'SoundCloud', color: '#ff5500' },
    saved:      { label: 'Saved',      color: '#C8FF00' },
  };
  const c = cfg[source] || cfg.spotify;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
      style={{ background: c.color + '20', color: c.color, border: `1px solid ${c.color}30` }}>
      {c.label}
    </span>
  );
}

// ── Track row ─────────────────────────────────────────────────────────────────
function TrackRow({ track, onLoadDeck, onSpotifyDeck, onAddToQueue, spotifyReady }) {
  const [expanded, setExpanded] = useState(false);
  const hasPreview = !!track.preview_url;
  const canPlay    = spotifyReady || hasPreview;

  const handleDeck = (side) => {
    if (spotifyReady && track.spotify_uri) {
      onSpotifyDeck?.(side, track);
    } else if (hasPreview) {
      onLoadDeck?.(side, { ...track, audio_url: track.preview_url });
    } else {
      toast.error('No playable audio — connect Spotify Premium for full tracks');
      return;
    }
    setExpanded(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Cover art */}
        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          {track.cover_art_url
            ? <img src={track.cover_art_url} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-4 h-4 text-white/20 m-3" />}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{track.title}</p>
          <p className="text-[11px] text-white/40 font-mono truncate">{track.artist}</p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PlaybackBadge hasPreview={hasPreview} spotifyReady={spotifyReady} />
          {track.duration_seconds > 0 && (
            <span className="text-[10px] font-mono text-white/25">
              {Math.floor(track.duration_seconds / 60)}:{String(track.duration_seconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Expanded action row */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-2"
          >
            <div className="rounded-xl p-2.5 border border-white/8 space-y-2"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              {/* Playback mode info */}
              {spotifyReady ? (
                <p className="text-[10px] font-mono text-[#1DB954] flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Spotify Premium — full track playback
                </p>
              ) : hasPreview ? (
                <p className="text-[10px] font-mono text-[#C8FF00] flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 30s preview — connect Spotify Premium for full tracks
                </p>
              ) : (
                <p className="text-[10px] font-mono text-yellow-400/60">
                  ⚠ No audio available for this track
                </p>
              )}

              {/* Deck buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeck('A')} disabled={!canPlay}
                  className="flex-1 py-2 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: '#C8FF00', color: '#000' }}>
                  → Deck A
                </button>
                <button
                  onClick={() => handleDeck('B')} disabled={!canPlay}
                  className="flex-1 py-2 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: '#00d2ff', color: '#000' }}>
                  → Deck B
                </button>
                <button
                  onClick={() => { onAddToQueue(track); setExpanded(false); }}
                  className="px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                  <Plus className="w-3 h-3" /> Queue
                </button>
                {track.external_url && (
                  <a href={track.external_url} target="_blank" rel="noopener noreferrer"
                    className="px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
                    onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Spotify Premium prompt ────────────────────────────────────────────────────
function PremiumPrompt() {
  return (
    <div className="mx-3 mt-3 rounded-xl p-3 border border-[#1DB954]/20"
      style={{ background: 'rgba(29,185,84,0.07)' }}>
      <div className="flex items-start gap-2">
        <Crown className="w-4 h-4 text-[#1DB954] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-white">Unlock Full Tracks</p>
          <p className="text-[10px] text-white/45 font-mono mt-0.5 leading-relaxed">
            Connect Spotify Premium in <strong className="text-white/70">Connected Services</strong> to stream full-length tracks directly in the mixer. 30s previews work without Premium.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrackSearch({ onLoadDeck, onSpotifyDeck, onAddToQueue, savedTracks = [] }) {
  const { ready: spotifyReady, connected: spotifyConnected, search: spotifySearch } = useSpotify();
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState('search'); // 'search' | 'saved'
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true); setError(null);
    try {
      // Use SpotifyContext search (already has token auto-refresh)
      const raw = await spotifySearch(q);
      setResults(raw.map(normaliseSpotify));
    } catch (err) {
      // Fallback: direct backend call
      try {
        const res = await base44.functions.invoke('spotifyAuth', { action: 'search', query: q });
        setResults((res?.data?.tracks || []).map(normaliseSpotify));
      } catch {
        setError('Search failed — check Spotify connection');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [spotifySearch]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const clearSearch = () => { setQuery(''); setResults([]); inputRef.current?.focus(); };

  const handleLoadDeck = (side, track) => {
    onLoadDeck?.(side, track);
    toast.success(`"${track.title}" → Deck ${side}`);
  };

  const handleSpotifyDeck = (side, track) => {
    onSpotifyDeck?.(side, track);
    toast.success(`"${track.title}" → Deck ${side} (Spotify)`);
  };

  const handleQueue = (track) => {
    onAddToQueue?.(track);
    toast(`"${track.title}" added to queue`);
  };

  const QUICK_GENRES = ['Tech House', 'Melodic Techno', 'Afro House', 'Drum and Bass', 'Synthwave', 'Ambient'];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 border-b border-white/8">
        {[
          { key: 'search', label: 'Search' },
          { key: 'saved',  label: `Library (${savedTracks.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t.key ? '#C8FF00' : 'rgba(255,255,255,0.06)',
              color:      tab === t.key ? '#000'    : 'rgba(255,255,255,0.4)',
            }}>
            {t.label}
          </button>
        ))}

        {/* Spotify status */}
        <div className="ml-auto flex items-center gap-1.5">
          {spotifyReady ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#1DB954]">
              <CheckCircle2 className="w-3 h-3" /> Premium
            </span>
          ) : spotifyConnected ? (
            <span className="text-[10px] font-mono text-yellow-400/70">No Premium</span>
          ) : (
            <span className="text-[10px] font-mono text-white/30">Spotify off</span>
          )}
        </div>
      </div>

      {/* Premium upsell (only if not ready) */}
      {!spotifyReady && <PremiumPrompt />}

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInput}
                placeholder="Search artist, track, album…"
                className="w-full pl-8 pr-8 py-2 rounded-xl text-sm text-white placeholder-white/25 font-mono focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                autoFocus
              />
              {query && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">Searching Spotify…</span>
              </div>
            )}
            {error && <p className="px-4 py-3 text-xs text-red-400/70 font-mono">{error}</p>}

            {!loading && !error && results.length === 0 && !query && (
              <div className="flex flex-col items-center py-8 text-white/20 gap-3">
                <Radio className="w-8 h-8" />
                <p className="text-xs font-mono">Search Spotify to load tracks into the mixer</p>
                <div className="flex flex-wrap gap-1.5 px-4 justify-center">
                  {QUICK_GENRES.map(g => (
                    <button key={g} onClick={() => { setQuery(g); doSearch(g); }}
                      className="px-2.5 py-1 rounded-full text-[10px] font-mono border border-white/10 hover:border-[#C8FF00]/40 hover:text-[#C8FF00] transition-colors text-white/40">
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && results.length === 0 && query && (
              <div className="flex flex-col items-center py-8 text-white/25">
                <Music2 className="w-7 h-7 mb-2" />
                <p className="text-xs font-mono">No results for "{query}"</p>
              </div>
            )}

            <AnimatePresence>
              {results.map(track => (
                <TrackRow
                  key={track.id}
                  track={track}
                  spotifyReady={spotifyReady}
                  onLoadDeck={handleLoadDeck}
                  onSpotifyDeck={handleSpotifyDeck}
                  onAddToQueue={handleQueue}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── Library tab ── */}
      {tab === 'saved' && (
        <div className="flex-1 overflow-y-auto">
          {savedTracks.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-white/20 gap-2">
              <Music2 className="w-8 h-8" />
              <p className="text-xs font-mono">No tracks in this session yet</p>
            </div>
          ) : (
            savedTracks.map(track => (
              <TrackRow
                key={track.id || track.spotify_id}
                track={track}
                spotifyReady={spotifyReady}
                onLoadDeck={handleLoadDeck}
                onSpotifyDeck={handleSpotifyDeck}
                onAddToQueue={handleQueue}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
