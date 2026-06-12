import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SERVICE_META = {
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png',
  },
  apple_music: {
    name: 'Apple Music',
    color: '#FA233B',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Apple_Music_icon.svg/200px-Apple_Music_icon.svg.png',
  },
  youtube_music: {
    name: 'YouTube Music',
    color: '#FF0000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/200px-Youtube_Music_icon.svg.png',
  },
  soundcloud: {
    name: 'SoundCloud',
    color: '#FF5500',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Antu_soundcloud.svg/200px-Antu_soundcloud.svg.png',
  },
  tidal: {
    name: 'Tidal',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Tidal_logo.svg/200px-Tidal_logo.svg.png',
  },
};

export default function ServiceBadges({ connectedServices = {} }) {
  const ids = Object.keys(connectedServices);
  if (ids.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {ids.map(id => {
          const meta = SERVICE_META[id];
          if (!meta) return null;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <div className="w-6 h-6 rounded-full bg-white border border-border/60 flex items-center justify-center shadow-sm overflow-hidden cursor-default">
                  <img src={meta.logo} alt={meta.name} className="w-4 h-4 object-contain" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{meta.name} connected</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}