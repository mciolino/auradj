import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const PlayerContext = createContext(null);

const TARGET_LOUDNESS_DB = -14;
const TARGET_AMPLITUDE = Math.pow(10, TARGET_LOUDNESS_DB / 20);
const CROSSFADE_DURATION = 3; // seconds

async function measureRmsAmplitude(audioCtx, url) {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    let sum = 0;
    const step = 4;
    const count = Math.floor(data.length / step);
    for (let i = 0; i < data.length; i += step) sum += data[i] * data[i];
    return Math.sqrt(sum / count);
  } catch {
    return null;
  }
}

function getNormalizationGain(rms) {
  if (!rms || rms <= 0) return 1;
  return Math.min(TARGET_AMPLITUDE / rms, 4);
}

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Two audio elements for crossfade — we swap between them
  const audioA = useRef(null);
  const audioB = useRef(null);
  const activeRef = useRef('a'); // which slot is currently "main"

  const audioCtxRef = useRef(null);
  const gainA = useRef(null);
  const gainB = useRef(null);

  const crossfadeTimerRef = useRef(null);
  const volumeRef = useRef(0.8);
  const mutedRef = useRef(false);

  // Keep refs in sync so callbacks always see latest value
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);

  const getActiveAudio = () => activeRef.current === 'a' ? audioA.current : audioB.current;
  const getInactiveAudio = () => activeRef.current === 'a' ? audioB.current : audioA.current;
  const getActiveGain = () => activeRef.current === 'a' ? gainA.current : gainB.current;
  const getInactiveGain = () => activeRef.current === 'a' ? gainB.current : gainA.current;

  // Initialize Web Audio context and wire both elements
  const initAudioGraph = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const gA = ctx.createGain(); gA.gain.value = 0;
    const gB = ctx.createGain(); gB.gain.value = 0;

    const srcA = ctx.createMediaElementSource(audioA.current);
    const srcB = ctx.createMediaElementSource(audioB.current);

    srcA.connect(gA); gA.connect(ctx.destination);
    srcB.connect(gB); gB.connect(ctx.destination);

    audioCtxRef.current = ctx;
    gainA.current = gA;
    gainB.current = gB;
  }, []);

  // Load a track onto the inactive slot, then crossfade to it
  const crossfadeTo = useCallback(async (track) => {
    if (!track?.audio_url) return;

    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();

    const incomingAudio = getInactiveAudio();
    const incomingGain = getInactiveGain();
    const outgoingAudio = getActiveAudio();
    const outgoingGain = getActiveGain();

    // Prepare incoming
    incomingAudio.src = track.audio_url;
    incomingAudio.volume = 1;
    incomingAudio.crossOrigin = 'anonymous';
    incomingAudio.load();

    // Normalize incoming
    const rms = await measureRmsAmplitude(ctx, track.audio_url);
    const normGain = getNormalizationGain(rms);
    const masterVol = mutedRef.current ? 0 : volumeRef.current;
    const targetGain = normGain * masterVol;

    // Clear any pending crossfade
    if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);

    await incomingAudio.play();

    const now = ctx.currentTime;

    // Fade out outgoing
    outgoingGain.gain.cancelScheduledValues(now);
    outgoingGain.gain.setValueAtTime(outgoingGain.gain.value, now);
    outgoingGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_DURATION);

    // Fade in incoming
    incomingGain.gain.cancelScheduledValues(now);
    incomingGain.gain.setValueAtTime(0, now);
    incomingGain.gain.linearRampToValueAtTime(targetGain, now + CROSSFADE_DURATION);

    // Swap active slot
    activeRef.current = activeRef.current === 'a' ? 'b' : 'a';

    // Stop outgoing after fade completes
    crossfadeTimerRef.current = setTimeout(() => {
      outgoingAudio.pause();
      outgoingAudio.src = '';
      outgoingGain.gain.cancelScheduledValues(ctx.currentTime);
      outgoingGain.gain.setValueAtTime(0, ctx.currentTime);
    }, CROSSFADE_DURATION * 1000 + 100);

    setIsPlaying(true);
  }, []);

  // Bootstrap: create audio elements once
  useEffect(() => {
    audioA.current = new Audio();
    audioB.current = new Audio();
    audioA.current.crossOrigin = 'anonymous';
    audioB.current.crossOrigin = 'anonymous';

    return () => {
      audioCtxRef.current?.close();
      if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
    };
  }, []);

  // Track time/duration from the active element
  useEffect(() => {
    const interval = setInterval(() => {
      const audio = getActiveAudio();
      if (!audio) return;
      setCurrentTime(audio.currentTime || 0);
      if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-advance queue: start crossfade when track is near its end
  useEffect(() => {
    if (queue.length === 0) return;
    const audio = getActiveAudio();
    if (!audio) return;

    const onTimeUpdate = () => {
      const remaining = (audio.duration || 0) - audio.currentTime;
      if (remaining > 0 && remaining <= CROSSFADE_DURATION && !audio._crossfadeStarted) {
        audio._crossfadeStarted = true;
        const [next, ...rest] = queue;
        setCurrentTrack(next);
        setQueue(rest);
      }
    };

    const onEnded = () => {
      audio._crossfadeStarted = false;
      if (queue.length === 0) setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [queue]);

  // Trigger crossfade when currentTrack changes
  useEffect(() => {
    if (!currentTrack?.audio_url) return;
    initAudioGraph();
    crossfadeTo(currentTrack);
  }, [currentTrack]);

  // Volume/mute: update the active gain node
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const gain = getActiveGain();
    if (!ctx || !gain) return;
    // Adjust master volume by scaling current gain proportionally
    // We just update the gain value; normalization multiplier stays embedded
    const masterVol = isMuted ? 0 : volume;
    gain.gain.setTargetAtTime(gain.gain.value * (masterVol / (volumeRef.current || 1)), ctx.currentTime, 0.05);
  }, [volume, isMuted]);

  // Simpler: directly set audio element volume as fallback when context not ready
  useEffect(() => {
    [audioA, audioB].forEach(ref => {
      if (ref.current) ref.current.volume = isMuted ? 0 : volume;
    });
  }, [volume, isMuted]);

  const play = useCallback((track, newQueue = []) => {
    setQueue(newQueue);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const ctx = audioCtxRef.current;
      if (ctx?.state === 'suspended') ctx.resume();
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seek = useCallback((time) => {
    const audio = getActiveAudio();
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipNext = useCallback(() => {
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentTrack(next);
      setQueue(rest);
    }
  }, [queue]);

  const addToQueue = useCallback((track) => {
    setQueue(q => [...q, track]);
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, isPlaying, currentTime, duration, volume, isMuted,
      play, togglePlay, seek, skipNext, addToQueue,
      setVolume, setIsMuted,
      normalizationActive: !!audioCtxRef.current
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};