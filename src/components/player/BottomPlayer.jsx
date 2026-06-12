import React from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useSpotify } from '@/context/SpotifyContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, ListMusic } from 'lucide-react';
import WaveVisualizer from './WaveVisualizer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function BottomPlayer() {
  const { currentTrack, isPlaying, currentTime, duration, volume, isMuted, togglePlay, seek, skipNext, setVolume, setIsMuted } = usePlayer();
  const { currentSpotifyTrack, isPaused: spotifyPaused, player: spotifyPlayer } = useSpotify();

  // Spotify bar
  if (currentSpotifyTrack) {
    return (
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-[#1DB954]/20 h-[88px]"
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-4">
          <div className="flex items-center gap-3 w-56 min-w-0 flex-shrink-0">
            <img
              src={currentSpotifyTrack.album?.images?.[0]?.url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-lg"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{currentSpotifyTrack.name}</p>
              <p className="text-xs text-[#1DB954] truncate flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current inline-block flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                {currentSpotifyTrack.artists?.map(a => a.name).join(', ')}
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center gap-3">
            <Button size="icon" variant="ghost" className="w-9 h-9 rounded-full" onClick={() => spotifyPlayer?.previousTrack()}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className="w-11 h-11 rounded-full bg-[#1DB954] hover:bg-[#1DB954]/90 text-white shadow-lg shadow-[#1DB954]/20"
              onClick={() => spotifyPlayer?.togglePlay()}
            >
              {spotifyPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="w-9 h-9 rounded-full" onClick={() => spotifyPlayer?.nextTrack()}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
          <div className="w-32 flex-shrink-0" />
        </div>
      </motion.div>
    );
  }

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        key="player"
        initial={{ y: 88 }}
        animate={{ y: 0 }}
        exit={{ y: 88 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border/60 h-[88px]"
      >
        {/* Progress bar — full width at very top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/40">
          <motion.div
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 w-56 min-w-0 flex-shrink-0">
            <div className={cn(
              'w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted shadow-lg',
              isPlaying && 'ring-2 ring-primary/40'
            )}>
              {currentTrack.cover_art_url ? (
                <img
                  src={currentTrack.cover_art_url}
                  alt=""
                  className={cn('w-full h-full object-cover', isPlaying && 'vinyl-spin')}
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.genre || 'AI Generated'}</p>
            </div>
          </div>

          {/* Controls + scrubber */}
          <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground" onClick={skipNext}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlay}
                className="w-11 h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground" onClick={skipNext}>
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Scrubber */}
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 1}
                step={1}
                onValueChange={([v]) => seek(v)}
                className="flex-1 h-1 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: waveform + volume */}
          <div className="hidden md:flex items-center gap-3 w-48 flex-shrink-0">
            {/* Mini wave visualizer */}
            <div className="w-16 flex-shrink-0">
              <WaveVisualizer isPlaying={isPlaying} barCount={12} height={28} />
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Toggle mute"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([v]) => { setVolume(v / 100); setIsMuted(false); }}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
