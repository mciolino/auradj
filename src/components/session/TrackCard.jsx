import React from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, Music, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TrackCard({ track, index }) {
  const { currentTrack, isPlaying, play, togglePlay, addToQueue } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id || currentTrack?.tempId === track.tempId;
  const isActiveAndPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (isCurrentTrack) togglePlay();
    else play(track, []);
  };

  return (
    <div className={cn(
      'group flex items-center gap-3 p-3 rounded-xl transition-colors duration-150',
      isCurrentTrack ? 'bg-accent' : 'hover:bg-secondary'
    )}>
      <span className="w-5 text-center text-xs text-muted-foreground tabular-nums flex-shrink-0">
        {isActiveAndPlaying ? (
          <span className="flex items-end justify-center gap-0.5 h-4">
            {[...Array(3)].map((_, i) => (
              <span key={i} className="wave-bar w-0.5 bg-primary rounded-full h-4 inline-block" />
            ))}
          </span>
        ) : (
          <span>{index + 1}</span>
        )}
      </span>

      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
        {track.cover_art_url ? (
          <img src={track.cover_art_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isCurrentTrack && 'text-primary')}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {[track.genre, track.mood, track.bpm && `${track.bpm} BPM`].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button size="icon" variant="ghost" onClick={handlePlay} className="w-8 h-8" aria-label="Play">
          {isActiveAndPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => addToQueue(track)} className="w-8 h-8" aria-label="Add to queue">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}