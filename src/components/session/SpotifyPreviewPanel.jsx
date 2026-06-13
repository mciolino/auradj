import React, { useState, useEffect, useRef } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SpotifyPreviewPanel({ genre, mood, prompt }) {
  const { connected, ready, search, playTrack, currentSpotifyTrack, isPaused, player } = useSpotify();
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const lastQueryRef = useRef('');

  // Auto-search when genre/mood changes
  useEffect(() => {
    const autoQuery = [mood, genre].filter(Boolean).join(' ') || 'electronic';
    if (autoQuery !== lastQueryRef.current && ready) {
      lastQueryRef.current = autoQuery;
      setQuery(autoQuery);
      runSearch(autoQuery);
    }
  }, [genre, mood, ready]);

  const runSearch = async (q) => {
    if (!q.trim()) return;
    setSearching(true);
    const tracks = await search(q);
    setResults(tracks.slice(0, 6));
    setSearching(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(query);
  };

  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1DB954]" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span>Spotify Preview</span>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link to="/services" className="text-primary underline">Connect Spotify</Link> to preview real tracks before generating
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-[#1DB954]/5">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#1DB954] flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <span className="text-xs font-medium text-[#1DB954]">Preview on Spotify</span>
        {!ready && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-1.5 p-2 border-b border-border">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tracks..."
          className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" disabled={searching || !ready}>
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </Button>
      </form>

      {/* Results */}
      <div className="max-h-56 overflow-y-auto">
        {results.length === 0 && !searching && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {ready ? 'Search for tracks to preview' : 'Connecting...'}
          </p>
        )}
        {results.map(track => {
          const isThisTrack = currentSpotifyTrack?.id === track.id;
          return (
            <button
              key={track.id}
              onClick={() => playTrack(track.uri)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors hover:bg-secondary group ${isThisTrack ? 'bg-[#1DB954]/10' : ''}`}
            >
              <div className="relative w-8 h-8 flex-shrink-0">
                <img
                  src={track.album?.images?.[2]?.url}
                  alt=""
                  className="w-8 h-8 rounded object-cover"
                />
                {isThisTrack && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                    {isPaused
                      ? <Play className="w-3 h-3 text-white" onClick={e => { e.stopPropagation(); player?.togglePlay(); }} />
                      : <Pause className="w-3 h-3 text-[#1DB954]" onClick={e => { e.stopPropagation(); player?.togglePlay(); }} />
                    }
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isThisTrack ? 'text-[#1DB954]' : ''}`}>{track.name}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artists?.map(a => a.name).join(', ')}</p>
              </div>
              {!isThisTrack && (
                <Play className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}