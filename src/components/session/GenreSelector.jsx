import React from 'react';
import { cn } from '@/lib/utils';

const GENRES = [
  'Lo-Fi', 'Electronic', 'Ambient', 'House', 'Techno',
  'Jazz', 'Hip-Hop', 'Drum & Bass', 'Chillwave', 'Classical',
  'Synthwave', 'R&B', 'Indie', 'Trap', 'World'
];

export default function GenreSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GENRES.map((genre) => (
        <button
          key={genre}
          type="button"
          onClick={() => onSelect(selected === genre ? '' : genre)}
          className={cn(
            'px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer transition-all duration-150',
            selected === genre
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50 hover:text-primary'
          )}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}