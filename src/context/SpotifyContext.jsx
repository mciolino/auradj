import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const SpotifyContext = createContext(null);

function loadSpotifySdk() {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.head.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = resolve;
  });
}

export function SpotifyProvider({ children }) {
  const [deviceId, setDeviceId] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const playerRef = useRef(null);
  const tokenRef = useRef(null);
  const initInProgressRef = useRef(false);

  // Fetches a valid (auto-refreshed) token via backend
  const getValidToken = useCallback(async () => {
    const res = await base44.functions.invoke('spotifyAuth', { action: 'getToken' }).catch(() => null);
    if (res?.data?.access_token) {
      tokenRef.current = res.data.access_token;
      return res.data.access_token;
    }
    return null;
  }, []);

  const initSpotify = useCallback(async () => {
    // Prevent concurrent init calls
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    try {
      const token = await getValidToken();
      if (!token) {
        setConnected(false);
        setInitialized(true);
        return;
      }
      setConnected(true);

      // Disconnect existing player before re-init
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
        setSpotifyPlayer(null);
        setDeviceId(null);
        setReady(false);
        setPlayerState(null);
      }

      await loadSpotifySdk();

      const p = new window.Spotify.Player({
        name: 'AuraDJ',
        getOAuthToken: async (cb) => {
          const t = await getValidToken();
          cb(t || '');
        },
        volume: 0.7,
      });

      p.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id);
        setReady(true);
      });
      p.addListener('not_ready', () => setReady(false));
      p.addListener('player_state_changed', (s) => setPlayerState(s || null));
      p.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify] init error:', message);
      });
      p.addListener('authentication_error', async ({ message }) => {
        console.error('[Spotify] auth error:', message);
        const newToken = await getValidToken();
        if (!newToken) {
          toast.error('Spotify session expired. Reconnect in Connected Services.');
          setConnected(false);
          setReady(false);
        }
      });
      p.addListener('account_error', () => {
        toast.error('Spotify Premium is required for in-app playback.');
      });

      await p.connect();
      playerRef.current = p;
      setSpotifyPlayer(p);
    } catch (err) {
      console.error('[Spotify] initSpotify error:', err);
    } finally {
      initInProgressRef.current = false;
      setInitialized(true);
    }
  }, [getValidToken]);

  // Only init once on mount
  useEffect(() => {
    initSpotify();
    return () => { playerRef.current?.disconnect(); };
  }, []);

  const reconnect = useCallback(async () => {
    initInProgressRef.current = false; // allow re-init
    await initSpotify();
  }, [initSpotify]);

  // Play a Spotify URI via Web Playback SDK device
  const playTrack = useCallback(async (uri) => {
    if (!deviceId) return;
    const token = await getValidToken();
    if (!token) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    });
  }, [deviceId, getValidToken]);

  // Server-side search proxy
  const search = useCallback(async (query) => {
    if (!query) return [];
    const res = await base44.functions.invoke('spotifyAuth', { action: 'search', query }).catch(() => null);
    return res?.data?.tracks || [];
  }, []);

  const currentSpotifyTrack = playerState?.track_window?.current_track || null;
  const isPaused = playerState ? playerState.paused : true;

  return (
    <SpotifyContext.Provider value={{
      connected,
      ready,
      deviceId,
      playerState,
      currentSpotifyTrack,
      isPaused,
      playTrack,
      search,
      player: spotifyPlayer,
      reconnect,
      initialized,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}

export const useSpotify = () => {
  const ctx = useContext(SpotifyContext);
  if (!ctx) throw new Error('useSpotify must be used within SpotifyProvider');
  return ctx;
};