import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ExternalLink, Share2 } from 'lucide-react';

const SERVICE_LINKS = {
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png',
    buildUrl: (title) => `https://open.spotify.com/search/${encodeURIComponent(title)}`,
  },
  apple_music: {
    name: 'Apple Music',
    color: '#FA233B',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Apple_Music_icon.svg/200px-Apple_Music_icon.svg.png',
    buildUrl: (title) => `https://music.apple.com/search?term=${encodeURIComponent(title)}`,
  },
  youtube_music: {
    name: 'YouTube Music',
    color: '#FF0000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/200px-Youtube_Music_icon.svg.png',
    buildUrl: (title) => `https://music.youtube.com/search?q=${encodeURIComponent(title)}`,
  },
  soundcloud: {
    name: 'SoundCloud',
    color: '#FF5500',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Antu_soundcloud.svg/200px-Antu_soundcloud.svg.png',
    buildUrl: (title) => `https://soundcloud.com/search?q=${encodeURIComponent(title)}`,
  },
};

export default function ExportToServices({ sessionTitle, sessionTags = [] }) {
  const [connected, setConnected] = useState({});

  useEffect(() => {
    base44.auth.me().catch(() => null).then(me => {
      if (me?.connected_services) setConnected(me.connected_services);
    });
  }, []);

  const handleOpen = (serviceId, service) => {
    const url = service.buildUrl(sessionTitle);
    window.open(url, '_blank');
    toast.success(`Opening in ${service.name}`);
  };

  const connectedServices = Object.entries(SERVICE_LINKS).filter(([id]) => connected[id]);
  const allServices = Object.entries(SERVICE_LINKS);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Share2 className="w-4 h-4 text-primary" />
        Listen on
      </h3>

      <div className="space-y-2">
        {(connectedServices.length > 0 ? connectedServices : allServices).map(([id, service]) => (
          <button
            key={id}
            onClick={() => handleOpen(id, service)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary transition-colors duration-150 group"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-border/40 flex-shrink-0">
              <img src={service.logo} alt={service.name} className="w-5 h-5 object-contain" />
            </div>
            <span className="text-sm font-medium flex-1 text-left">{service.name}</span>
            {connected[id] && (
              <span className="text-xs text-primary">Connected</span>
            )}
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        ))}
      </div>

      {connectedServices.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          <a href="/services" className="text-primary hover:underline">Connect your accounts</a> to sync playlists
        </p>
      )}
    </div>
  );
}