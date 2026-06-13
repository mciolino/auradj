import { useEffect, useRef } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { useMixer } from '@/context/MixerContext';

/**
 * SpotifyDeckBridge
 *
 * Invisible component that syncs Spotify Web Playback SDK state
 * back into MixerContext so the deck UI (waveform, progress, BPM, etc.)
 * stays in sync whether a track is playing via Tone.js or the Spotify SDK.
 *
 * Mounted once inside DJMixer. No rendered output.
 *
 * How it works:
 * - Listens to SpotifyContext.playerState changes
 * - When a Spotify track is active on a deck (tracked via spotifyDeckRef),
 *   it updates deckState.currentTime, playing, and duration in MixerContext
 *   so all the deck UI components render correctly.
 */
export default function SpotifyDeckBridge({ spotifyDeckRef }) {
  const { playerState, player } = useSpotify();
  const { setDeckState } = useMixer();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!playerState) return;

    const side = spotifyDeckRef.current;
    if (!side) return;

    const track    = playerState.track_window?.current_track;
    const paused   = playerState.paused;
    const position = playerState.position / 1000; // ms → seconds
    const duration = track?.duration_ms ? track.duration_ms / 1000 : 0;

    setDeckState(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        playing:     !paused,
        currentTime: position,
        duration,
        loading:     false,
      }
    }));
  }, [playerState]);

  // Poll position while playing (Spotify SDK doesn't emit every tick)
  useEffect(() => {
    clearInterval(intervalRef.current);
    const side = spotifyDeckRef.current;
    if (!side || !player) return;

    intervalRef.current = setInterval(async () => {
      const state = await player.getCurrentState().catch(() => null);
      if (!state) return;
      const position = state.position / 1000;
      setDeckState(prev => ({
        ...prev,
        [side]: { ...prev[side], currentTime: position, playing: !state.paused }
      }));
    }, 800);

    return () => clearInterval(intervalRef.current);
  }, [player, spotifyDeckRef.current]);

  return null;
}
