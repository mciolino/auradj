import React from 'react';
import { cn } from '@/lib/utils';

const MOODS = [
  { label: 'Late Night Chill', emoji: '🌙', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  { label: 'Energy Boost', emoji: '⚡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800' },
  { label: 'Deep Focus', emoji: '🧠', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  { label: 'Rooftop Party', emoji: '🎉', color: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800' },
  { label: 'Melancholy', emoji: '🌧️', color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700' },
  { label: 'Sunrise Run', emoji: '🌅', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
];

export default function MoodSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood.label}
          onClick={() => onSelect(selected === mood.label ? '' : mood.label)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer transition-all duration-200',
            mood.color,
            selected === mood.label ? 'ring-2 ring-primary ring-offset-1' : 'opacity-80 hover:opacity-100'
          )}
        >
          <span>{mood.emoji}</span>
          <span>{mood.label}</span>
        </button>
      ))}
    </div>
  );
}