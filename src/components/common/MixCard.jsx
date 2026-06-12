import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MixCard — record sleeve aesthetic.
 * Square full-bleed art. On hover: dark overlay with metadata in stark mono type.
 * No rounded corners. No badge chips. No drop shadows.
 */
export default function MixCard({ session, className, creatorName, creatorId }) {
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer();
  const isCurrentSession = currentTrack?.session_id === session.id;
  const isActiveAndPlaying = isCurrentSession && isPlaying;

  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrentSession) togglePlay();
    else play({
      id: session.id,
      session_id: session.id,
      title: session.title,
      cover_art_url: session.cover_art_url,
      genre: session.genre,
      audio_url: null,
    }, []);
  };

  return (
    <Link to={`/mix/${session.id}`} className={cn('block group', className)}>
      {/* ── Sleeve art ── */}
      <div className="relative aspect-square overflow-hidden bg-secondary">

        {/* Art */}
        {session.cover_art_url ? (
          <img
            src={session.cover_art_url}
            alt={session.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Music className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}

        {/* Hover overlay — full black takeover with grid data */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/80 transition-all duration-200 flex flex-col justify-between p-3 pointer-events-none group-hover:pointer-events-auto">

          {/* Top meta */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
            {session.genre && (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">
                {session.genre}
              </span>
            )}
            {session.bpm && (
              <p className="font-mono text-[9px] text-white/50 mt-0.5">{session.bpm} BPM</p>
            )}
          </div>

          {/* Center play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={handlePlay}
              className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
              aria-label={isActiveAndPlaying ? 'Pause' : 'Play'}
            >
              {isActiveAndPlaying
                ? <Pause className="w-4 h-4" />
                : <Play className="w-4 h-4 ml-0.5" />
              }
            </button>
          </div>

          {/* Bottom creator */}
          {creatorName && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 self-end">
              <p className="font-mono text-[9px] text-white/50 uppercase tracking-wider truncate">
                {creatorName}
              </p>
            </div>
          )}
        </div>

        {/* Playing indicator — top-left lime bar */}
        {isActiveAndPlaying && (
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        )}
      </div>

      {/* ── Below sleeve — minimal label-style text ── */}
      <div className="pt-2 pb-0">
        <p className="font-mono text-[11px] font-bold uppercase tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
          {session.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {session.mood && (
            <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
              {session.mood}
            </span>
          )}
          {session.play_count > 0 && (
            <span className="font-mono text-[9px] text-muted-foreground">
              {session.play_count.toLocaleString()} plays
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
