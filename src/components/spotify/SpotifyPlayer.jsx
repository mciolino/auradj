import React, { useEffect, useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, Loader2, Music, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SpotifyPlayer({ searchQuery }) {
  const { connected, ready, search, playTrack, currentSpotifyTrack, isPaused, player } = useSpotify();
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Auto-search when query changes and player is ready
  useEffect(() => {
    if (searchQuery && ready) {
      runSearch(searchQuery);
    }
  }, [searchQuery, ready]);

  const runSearch = async (query) => {
    setSearching(true);
    const results = await search(query);
    setSearchResults(results);
    setSearching(false);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center rounded-2xl border border-border bg-card">
        <Music className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connect Spotify in{' '}
          <Link to="/services" className="text-primary underline">Connected Services</Link>
          {' '}to stream music directly.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground rounded-2xl border border-border bg-card">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Connecting Spotify player...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* Now Playing */}
      {currentSpotifyTrack && (
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/20">
          <img
            src={currentSpotifyTrack.album?.images?.[0]?.url}
            alt=""
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{currentSpotifyTrack.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSpotifyTrack.artists?.map(a => a.name).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => player?.previousTrack()}>
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              className="w-9 h-9 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white rounded-full"
              onClick={() => player?.togglePlay()}
            >
              {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => player?.nextTrack()}>
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching Spotify...
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 pb-1">
            Related on Spotify
          </p>
          {searchResults.map(track => (
            <button
              key={track.id}
              onClick={() => playTrack(track.uri)}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors text-left group"
            >
              <img
                src={track.album?.images?.[2]?.url}
                alt=""
                className="w-9 h-9 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artists?.map(a => a.name).join(', ')}
                </p>
              </div>
              <Play className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {!searching && !currentSpotifyTrack && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Spotify Premium connected — ready to stream
        </p>
      )}
    </div>
  );
}