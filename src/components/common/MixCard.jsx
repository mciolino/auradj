import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '@/context/PlayerContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, Heart, Music, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function MixCard({ session, className, creatorName, creatorId }) {
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer();
  const isCurrentSession = currentTrack?.session_id === session.id;
  const isActiveAndPlaying = isCurrentSession && isPlaying;

  const handlePlay = (e) => {
    e.preventDefault();
    if (isCurrentSession) togglePlay();
    else if (session.track_ids?.length > 0) {
      play({ id: session.id, session_id: session.id, title: session.title, cover_art_url: session.cover_art_url, genre: session.genre, audio_url: null }, []);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Link to={`/mix/${session.id}`} className={cn('block group', className)}>
        {/* Cover art */}
        <div className="relative rounded-xl overflow-hidden bg-secondary aspect-square mb-3 mix-card-glow transition-all duration-300">
          {session.cover_art_url ? (
            <img
              src={session.cover_art_url}
              alt={session.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5">
              <Music className="w-12 h-12 text-primary/40" />
            </div>
          )}

          {/* Dark scrim + play button */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end justify-end p-2 pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={isActiveAndPlaying ? { scale: 1, opacity: 1 } : {}}
              whileHover={{ scale: 1.1 }}
              className="pointer-events-auto"
            >
              <Button
                size="icon"
                onClick={handlePlay}
                className={cn(
                  'w-11 h-11 rounded-full shadow-xl transition-all duration-200 pointer-events-auto',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'hover:scale-105',
                  isActiveAndPlaying
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                )}
                style={{ transition: 'opacity 0.2s, transform 0.2s' }}
                aria-label={isActiveAndPlaying ? 'Pause' : 'Play'}
              >
                {isActiveAndPlaying
                  ? <Pause className="w-4 h-4" />
                  : <Play className="w-4 h-4 ml-0.5" />
                }
              </Button>
            </motion.div>
          </div>

          {/* Active playing indicator — pulsing ring */}
          {isActiveAndPlaying && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary/60 pointer-events-none" />
          )}

          {/* Duration badge */}
          {session.duration_minutes > 0 && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80 font-medium">
              {session.duration_minutes}m
            </div>
          )}
        </div>

        {/* Metadata */}
        <div>
          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors duration-150 leading-tight">
            {session.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {session.genre && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent/60 text-accent-foreground text-[10px] font-medium">
                {session.genre}
              </span>
            )}
            {session.bpm > 0 && <span>{session.bpm} BPM</span>}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
            {session.play_count > 0 && (
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> {session.play_count.toLocaleString()}
              </span>
            )}
            {session.likes > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" /> {session.likes.toLocaleString()}
              </span>
            )}
          </div>

          {creatorName && creatorId && (
            <Link
              to={`/profile/${creatorId}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 mt-2 group/creator"
            >
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-primary">{creatorName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-[11px] text-muted-foreground group-hover/creator:text-primary transition-colors truncate">
                {creatorName}
              </span>
            </Link>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
