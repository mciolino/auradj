import React from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useSpotify } from '@/context/SpotifyContext';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music } from 'lucide-react';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Tiny waveform bars — pure CSS, no canvas */
function LiveBars() {
  return (
    <div className="flex items-end gap-px h-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="wave-bar w-0.5 bg-primary"
          style={{ height: '100%', animationDelay: `${i * 0.09}s` }}
        />
      ))}
    </div>
  );
}

export default function BottomPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, togglePlay, seek, skipNext, setVolume, setIsMuted
  } = usePlayer();
  const { currentSpotifyTrack, isPaused: spotifyPaused, player: spotifyPlayer } = useSpotify();

  // ── Spotify bar ──
  if (currentSpotifyTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 h-[72px] bg-background border-t-2 border-[#1DB954]">
        <div className="h-full flex items-center px-6 gap-6">
          {/* Track */}
          <div className="flex items-center gap-3 w-56 min-w-0">
            <img
              src={currentSpotifyTrack.album?.images?.[0]?.url}
              alt=""
              className="w-9 h-9 object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{currentSpotifyTrack.name}</p>
              <p className="text-[10px] font-mono text-[#1DB954] truncate uppercase tracking-wider">
                {currentSpotifyTrack.artists?.map(a => a.name).join(', ')}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            <button onClick={() => spotifyPlayer?.previousTrack()}
              className="w-7 h-7 border border-border flex items-center justify-center hover:border-[#1DB954] hover:text-[#1DB954] transition-colors">
              <SkipBack className="w-3 h-3" />
            </button>
            <button
              onClick={() => spotifyPlayer?.togglePlay()}
              className="w-9 h-9 bg-[#1DB954] text-black flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {spotifyPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
            </button>
            <button onClick={() => spotifyPlayer?.nextTrack()}
              className="w-7 h-7 border border-border flex items-center justify-center hover:border-[#1DB954] hover:text-[#1DB954] transition-colors">
              <SkipForward className="w-3 h-3" />
            </button>
          </div>

          {/* Spotify label */}
          <div className="w-56 flex justify-end">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1DB954]/60">Via Spotify</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 h-[72px] bg-background border-t border-border">
      {/* Progress bar — sits flush at the very top of the player */}
      <div className="absolute top-0 left-0 right-0 h-px bg-border overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
        />
      </div>

      <div className="h-full flex items-center px-6 gap-6">

        {/* ── TRACK INFO ── */}
        <div className="flex items-center gap-3 w-56 min-w-0 flex-shrink-0">
          <div className="w-9 h-9 flex-shrink-0 overflow-hidden bg-secondary">
            {currentTrack.cover_art_url ? (
              <img src={currentTrack.cover_art_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{currentTrack.title}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider truncate mt-0.5">
              {currentTrack.genre || 'AI Generated'}
            </p>
          </div>
          {isPlaying && (
            <div className="flex-shrink-0">
              <LiveBars />
            </div>
          )}
        </div>

        {/* ── CONTROLS ── */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* Time + scrubber + time — hardware-style inline */}
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8 text-right flex-shrink-0">
            {formatTime(currentTime)}
          </span>

          {/* Clickable progress bar */}
          <div className="flex-1 max-w-xs relative group cursor-pointer h-6 flex items-center"
            onClick={(e) => {
              if (!duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * duration);
            }}
          >
            <div className="w-full h-px bg-border group-hover:h-0.5 transition-all">
              <div
                className="h-full bg-primary"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8 flex-shrink-0">
            {formatTime(duration)}
          </span>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Skip */}
          <button
            onClick={skipNext}
            className="w-7 h-7 border border-border flex items-center justify-center hover:border-foreground transition-colors flex-shrink-0"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* ── VOLUME ── mixer-strip style */}
        <div className="hidden sm:flex items-center gap-2 w-32 flex-shrink-0 justify-end">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          {/* Vertical fader look via horizontal slider */}
          <div className="flex-1">
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              max={100}
              step={1}
              onValueChange={([v]) => { setVolume(v / 100); setIsMuted(false); }}
              className="flex-1 [&>[role=slider]]:rounded-none [&>[role=slider]]:h-3 [&>[role=slider]]:w-1.5 [&>[role=slider]]:border-0 [&>[role=slider]]:bg-primary"
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-6">
            {isMuted ? '0' : Math.round(volume * 100)}
          </span>
        </div>

      </div>
    </div>
  );
}
