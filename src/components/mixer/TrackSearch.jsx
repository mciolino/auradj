import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Search, X, Loader2, Music2, Radio, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * TrackSearch — search Spotify (primary) + SoundCloud (fallback)
 *
 * Props:
 *   onLoadDeck(side, track)  — called when user picks a track for a deck
 *   onAddToQueue(track)      — called when user queues a track
 *   defaultSide              — 'A' or 'B', pre-selected deck
 */

// ── Normalise a raw Spotify track into our internal Track shape ───────────────
function normaliseSpotify(raw) {
  const preview = raw.preview_url; // 30s MP3, no auth needed
  return {
    id:             `spotify:${raw.id}`,
    spotify_id:     raw.id,
    spotify_uri:    raw.uri,
    source:         'spotify',
    title:          raw.name,
    artist:         raw.artists?.map(a => a.name).join(', ') || '',
    album:          raw.album?.name || '',
    cover_art_url:  raw.album?.images?.[0]?.url || null,
    preview_url:    preview,
    audio_url:      preview, // 30s preview — full playback requires Spotify SDK
    duration_seconds: Math.round((raw.duration_ms || 0) / 1000),
    bpm:            0, // fetched separately via audio features if needed
    genre:          raw.genres?.[0] || '',
    popularity:     raw.popularity || 0,
    external_url:   raw.external_urls?.spotify || '',
    playable:       !!preview,
  };
}

// ── Source pill ────────────────────────────────────────────────────────────────
function SourcePill({ source }) {
  const cfg = {
    spotify:    { label: 'Spotify',    color: '#1DB954' },
    soundcloud: { label: 'SoundCloud', color: '#ff5500' },
    saved:      { label: 'Saved',      color: '#C8FF00' },
  };
  const c = cfg[source] || cfg.spotify;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
      style={{ background: c.color + '22', color: c.color, border: `1px solid ${c.color}33` }}>
      {c.label}
    </span>
  );
}

// ── Individual search result row ───────────────────────────────────────────────
function TrackRow({ track, onLoadDeck, onAddToQueue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div layout className="group relative"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/6 cursor-pointer"
        onClick={() => setExpanded(v => !v)}>
        {/* Cover */}
        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-white/8">
          {track.cover_art_url
            ? <img src={track.cover_art_url} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-5 h-5 text-white/20 m-auto mt-2.5" />}
        </div>
        {/* Meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{track.title}</p>
          <p className="text-[11px] text-white/40 font-mono truncate">{track.artist}</p>
        </div>
        {/* Info + source */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SourcePill source={track.source} />
          {!track.playable && (
            <span className="text-[9px] font-mono text-white/25">no preview</span>
          )}
          {track.duration_seconds > 0 && (
            <span className="text-[10px] font-mono text-white/30">
              {Math.floor(track.duration_seconds/60)}:{String(track.duration_seconds%60).padStart(2,'0')}
            </span>
          )}
        </div>
      </div>

      {/* Expanded deck actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-2">
            <div className="rounded-xl p-2.5 border border-white/8 flex items-center gap-2 flex-wrap"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {!track.playable && (
                <p className="w-full text-[10px] text-yellow-400/70 font-mono mb-1">
                  ⚠ No 30s preview available — Spotify full playback requires Premium SDK
                </p>
              )}
              <button onClick={() => { onLoadDeck('A', track); setExpanded(false); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95"
                style={{ background: '#C8FF00', color: '#000', opacity: track.playable ? 1 : 0.4 }}
                disabled={!track.playable}>
                → Deck A
              </button>
              <button onClick={() => { onLoadDeck('B', track); setExpanded(false); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95"
                style={{ background: '#00d2ff', color: '#000', opacity: track.playable ? 1 : 0.4 }}
                disabled={!track.playable}>
                → Deck B
              </button>
              <button onClick={() => { onAddToQueue(track); setExpanded(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <Plus className="w-3 h-3" /> Queue
              </button>
              {track.external_url && (
                <a href={track.external_url} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-1.5 rounded-lg transition-all hover:bg-white/10"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrackSearch({ onLoadDeck, onAddToQueue, savedTracks = [] }) {
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState(null);
  const [tab,      setTab]     = useState('search'); // 'search' | 'saved' | 'recent'
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  // Check Spotify connection
  useEffect(() => {
    base44.auth.me().then(u => {
      setSpotifyConnected(!!u?.connected_services?.spotify?.connected);
    }).catch(() => {});
  }, []);

  const searchSpotify = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke('spotifyAuth', { action: 'search', query: q });
      const raw = res?.data?.tracks || [];
      setResults(raw.map(normaliseSpotify));
    } catch (err) {
      setError('Search failed — check Spotify connection');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSpotify(val), 420);
  };

  const clearSearch = () => { setQuery(''); setResults([]); inputRef.current?.focus(); };

  const handleLoadDeck = (side, track) => {
    onLoadDeck?.(side, track);
    toast.success(`"${track.title}" → Deck ${side}`);
  };

  const handleQueue = (track) => {
    onAddToQueue?.(track);
    toast(`"${track.title}" added to queue`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 p-3 border-b border-white/8">
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
        {!spotifyConnected && (
          <span className="ml-auto text-[10px] font-mono text-yellow-400/60 flex items-center gap-1">
            ⚠ Connect Spotify for search
          </span>
        )}
      </div>

      {/* Search tab */}
      {tab === 'search' && (
        <>
          {/* Search input */}
          <div className="p-3 border-b border-white/8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInput}
                placeholder="Search Spotify — artist, track, album…"
                className="w-full pl-8 pr-8 py-2 rounded-xl text-sm text-white placeholder-white/25 font-mono focus:outline-none transition-colors"
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

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">Searching Spotify…</span>
              </div>
            )}
            {error && (
              <div className="px-4 py-3 text-xs text-red-400/70 font-mono">{error}</div>
            )}
            {!loading && !error && results.length === 0 && query && (
              <div className="flex flex-col items-center py-8 text-white/25">
                <Music2 className="w-8 h-8 mb-2" />
                <p className="text-xs font-mono">No results for "{query}"</p>
              </div>
            )}
            {!loading && !error && results.length === 0 && !query && (
              <div className="flex flex-col items-center py-10 text-white/20 gap-2">
                <Radio className="w-8 h-8" />
                <p className="text-xs font-mono text-center px-4">
                  Search Spotify to load tracks into the mixer
                </p>
                <div className="flex flex-wrap gap-1.5 px-4 mt-2 justify-center">
                  {['Tech House', 'Melodic Techno', 'Drum & Bass', 'Afro House', 'Synthwave', 'Ambient'].map(s => (
                    <button key={s} onClick={() => { setQuery(s); searchSpotify(s); }}
                      className="px-2 py-1 rounded-full text-[10px] font-mono border border-white/10 hover:border-[#C8FF00]/40 hover:text-[#C8FF00] transition-colors text-white/40">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence>
              {results.map(track => (
                <TrackRow key={track.id} track={track}
                  onLoadDeck={handleLoadDeck} onAddToQueue={handleQueue} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Library tab — saved/session tracks */}
      {tab === 'saved' && (
        <div className="flex-1 overflow-y-auto">
          {savedTracks.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-white/20 gap-2">
              <Music2 className="w-8 h-8" />
              <p className="text-xs font-mono">No tracks in this session yet</p>
            </div>
          ) : savedTracks.map(track => (
            <TrackRow key={track.id || track.spotify_id} track={track}
              onLoadDeck={handleLoadDeck} onAddToQueue={handleQueue} />
          ))}
        </div>
      )}
    </div>
  );
}
