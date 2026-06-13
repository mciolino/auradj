import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

/**
 * MixerContext — Tone.js powered dual-deck DJ audio engine
 * Architecture based on mixmi-mixer-architecture skill pattern
 *
 * Signal flow per deck:
 *   Player → EQ (High/Mid/Low filters) → FX chain → DeckGain → Crossfader gain → Master
 *
 * Features:
 *   - Dual independent decks (A + B)
 *   - Real-time 3-band EQ (shelving filters)
 *   - Crossfader with linear/scratch curves
 *   - BPM sync (playback rate adjustment)
 *   - Loop engine (beat-accurate)
 *   - Hot cues (seek points)
 *   - FX: Reverb, Delay, Filter sweep, Chorus, Distortion, Phaser
 *   - Mix recording (MediaRecorder → webm download)
 *   - Proper Tone.js memory cleanup on unmount
 */

const MixerContext = createContext(null);

export function MixerProvider({ children }) {
  const toneRef = useRef(null);   // Tone module (lazy-loaded)
  const initialized = useRef(false);

  // ── Per-deck refs ────────────────────────────────────────────────────────────
  const deckRefs = useRef({
    A: { player: null, eq: null, fxChain: null, deckGain: null, xGain: null, activeFx: {}, loopTimer: null },
    B: { player: null, eq: null, fxChain: null, deckGain: null, xGain: null, activeFx: {}, loopTimer: null },
  });

  // Master
  const masterGainRef = useRef(null);
  const recDestRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);

  // ── React state (UI layer) ────────────────────────────────────────────────────
  const [deckState, setDeckState] = useState({
    A: { track: null, playing: false, loading: false, currentTime: 0, duration: 0, bpm: 128, pitch: 0, volume: 85, loopActive: false, loopSize: 4, cues: {} },
    B: { track: null, playing: false, loading: false, currentTime: 0, duration: 0, bpm: 128, pitch: 0, volume: 85, loopActive: false, loopSize: 4, cues: {} },
  });
  const [eq, setEq] = useState({
    A: { high: 50, mid: 50, low: 50 },
    B: { high: 50, mid: 50, low: 50 },
  });
  const [activeFx, setActiveFx] = useState({ A: [], B: [] });
  const [crossfader, setCrossfaderState] = useState(50);
  const [masterVolume, setMasterVolumeState] = useState(80);
  const [isRecording, setIsRecording] = useState(false);

  const xfadeRef = useRef(50);
  const masterVolRef = useRef(80);

  // ── Lazy Tone.js init ──────────────────────────────────────────────────────────
  const initTone = useCallback(async () => {
    if (initialized.current) return toneRef.current;
    const Tone = await import('tone');
    await Tone.start();
    toneRef.current = Tone;

    // Master gain → destination
    const master = new Tone.Gain(0.8).toDestination();
    masterGainRef.current = master;

    // Recording destination (taps master)
    const recDest = Tone.context.createMediaStreamDestination();
    master.connect(recDest);
    recDestRef.current = recDest;

    // Init both decks
    for (const side of ['A', 'B']) {
      const d = deckRefs.current[side];

      // 3-band EQ: high shelf, mid peaking, low shelf
      const hiFilter = new Tone.Filter({ type: 'highshelf', frequency: 8000, gain: 0 });
      const midFilter = new Tone.Filter({ type: 'peaking', frequency: 1000, Q: 1, gain: 0 });
      const lowFilter = new Tone.Filter({ type: 'lowshelf', frequency: 250, gain: 0 });

      // FX nodes (always in chain, bypassed by default via wet=0)
      const reverb = new Tone.Reverb({ decay: 2.5, wet: 0 });
      const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 0 });
      const chorus = new Tone.Chorus({ frequency: 4, delayTime: 2.5, depth: 0.5, wet: 0 }).start();
      const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 3, wet: 0 });
      const dist = new Tone.Distortion({ distortion: 0.4, wet: 0 });
      const autoFilter = new Tone.AutoFilter({ frequency: 1, wet: 0 }).start();

      // Deck gain (volume) + crossfader gain
      const dGain = new Tone.Gain(0.85);
      const xGain = new Tone.Gain(1.0);

      // Wire signal chain
      await reverb.generate();
      hiFilter.chain(midFilter, lowFilter, reverb, delay, chorus, phaser, dist, autoFilter, dGain, xGain, master);

      d.eq = { hi: hiFilter, mid: midFilter, low: lowFilter };
      d.fxChain = { reverb, delay, chorus, phaser, dist, autoFilter };
      d.deckGain = dGain;
      d.xGain = xGain;
    }

    initialized.current = true;
    return Tone;
  }, []);

  // ── Load track onto a deck ────────────────────────────────────────────────────
  const loadTrack = useCallback(async (side, track) => {
    if (!track?.audio_url) return;
    const Tone = await initTone();
    const d = deckRefs.current[side];

    // Cleanup existing player
    if (d.player) {
      d.player.stop();
      d.player.disconnect();
      d.player.dispose();
      d.player = null;
    }

    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading: true, track, playing: false, currentTime: 0, duration: 0 } }));

    try {
      const player = new Tone.Player({
        url: track.audio_url,
        loop: false,
        autostart: false,
        onload: () => {
          setDeckState(prev => ({
            ...prev,
            [side]: { ...prev[side], loading: false, duration: player.buffer?.duration || 0, bpm: track.bpm || 128 }
          }));
        },
        onerror: () => {
          setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading: false } }));
        }
      });

      // Connect player into EQ input
      player.connect(d.eq.hi);
      d.player = player;

      // Apply current pitch
      const currentPitch = deckState[side].pitch;
      player.playbackRate = Math.pow(2, currentPitch / 12);

    } catch (err) {
      console.error('[MixerContext] loadTrack error', err);
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading: false } }));
    }
  }, [initTone, deckState]);

  // ── Play / Pause ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async (side) => {
    const Tone = await initTone();
    const d = deckRefs.current[side];
    if (!d.player || d.player.state === 'loading') return;

    if (d.player.state === 'started') {
      d.player.stop();
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], playing: false } }));
    } else {
      if (Tone.context.state === 'suspended') await Tone.context.resume();
      d.player.start();
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], playing: true } }));
    }
  }, [initTone]);

  // ── Seek ──────────────────────────────────────────────────────────────────────
  const seek = useCallback((side, time) => {
    const d = deckRefs.current[side];
    if (!d.player) return;
    const wasPlaying = d.player.state === 'started';
    if (wasPlaying) d.player.stop();
    d.player.start(Tone.now(), time);
    if (!wasPlaying) d.player.stop();
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], currentTime: time } }));
  }, []);

  // ── EQ ────────────────────────────────────────────────────────────────────────
  const setEQBand = useCallback(async (side, band, value) => {
    await initTone();
    const d = deckRefs.current[side];
    if (!d.eq) return;
    // value 0-100 → gain -15 to +15 dB (center 50 = 0 dB)
    const gainDb = ((value - 50) / 50) * 15;
    d.eq[band].gain.rampTo(gainDb, 0.05);
    setEq(prev => ({ ...prev, [side]: { ...prev[side], [band]: value } }));
  }, [initTone]);

  // ── Volume ────────────────────────────────────────────────────────────────────
  const setDeckVolume = useCallback(async (side, value) => {
    await initTone();
    const d = deckRefs.current[side];
    if (!d.deckGain) return;
    d.deckGain.gain.rampTo(value / 100, 0.05);
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], volume: value } }));
  }, [initTone]);

  // ── Crossfader ────────────────────────────────────────────────────────────────
  const setCrossfader = useCallback(async (value) => {
    await initTone();
    xfadeRef.current = value;
    setCrossfaderState(value);
    // Linear curve: A fades out right→, B fades in left→
    const gainA = Math.cos((value / 100) * (Math.PI / 2));
    const gainB = Math.sin((value / 100) * (Math.PI / 2));
    const dA = deckRefs.current.A;
    const dB = deckRefs.current.B;
    if (dA.xGain) dA.xGain.gain.rampTo(gainA, 0.02);
    if (dB.xGain) dB.xGain.gain.rampTo(gainB, 0.02);
  }, [initTone]);

  // ── Master volume ─────────────────────────────────────────────────────────────
  const setMasterVolume = useCallback(async (value) => {
    await initTone();
    masterVolRef.current = value;
    setMasterVolumeState(value);
    if (masterGainRef.current) masterGainRef.current.gain.rampTo(value / 100, 0.05);
  }, [initTone]);

  // ── Pitch ─────────────────────────────────────────────────────────────────────
  const setPitch = useCallback(async (side, semitones) => {
    await initTone();
    const d = deckRefs.current[side];
    if (d.player) d.player.playbackRate = Math.pow(2, semitones / 12);
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], pitch: semitones } }));
  }, [initTone]);

  // ── BPM Sync ──────────────────────────────────────────────────────────────────
  const syncBPM = useCallback(async (sourceSide) => {
    await initTone();
    const sourceBPM = deckState[sourceSide].bpm;
    const targetSide = sourceSide === 'A' ? 'B' : 'A';
    const targetBPM = deckState[targetSide].bpm;
    if (!targetBPM || !sourceBPM) return;
    const ratio = sourceBPM / targetBPM;
    const dTarget = deckRefs.current[targetSide];
    if (dTarget.player) dTarget.player.playbackRate = ratio;
    setDeckState(prev => ({ ...prev, [targetSide]: { ...prev[targetSide], bpm: sourceBPM } }));
  }, [initTone, deckState]);

  // ── Loop ──────────────────────────────────────────────────────────────────────
  const toggleLoop = useCallback(async (side) => {
    await initTone();
    const d = deckRefs.current[side];
    const current = deckState[side];

    if (!d.player) return;

    if (current.loopActive) {
      // Disable loop
      d.player.loop = false;
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopActive: false } }));
    } else {
      // Enable loop — set loop points from current position
      const bpm = current.bpm || 128;
      const loopBars = current.loopSize || 4;
      const loopDuration = (loopBars * 4 * 60) / bpm;
      const startPos = d.player.immediate?.() || 0;

      d.player.loop = true;
      d.player.loopStart = startPos;
      d.player.loopEnd = startPos + loopDuration;
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopActive: true } }));
    }
  }, [initTone, deckState]);

  const setLoopSize = useCallback((side, bars) => {
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopSize: bars } }));
  }, []);

  // ── Hot Cues ──────────────────────────────────────────────────────────────────
  const setCue = useCallback((side, index) => {
    const d = deckRefs.current[side];
    const time = d.player ? (d.player.currentTime || 0) : 0;
    setDeckState(prev => ({
      ...prev,
      [side]: { ...prev[side], cues: { ...prev[side].cues, [index]: time } }
    }));
  }, []);

  const jumpToCue = useCallback(async (side, index) => {
    await initTone();
    const cueTime = deckState[side].cues[index];
    if (cueTime === undefined) return;
    const d = deckRefs.current[side];
    if (!d.player) return;
    const wasPlaying = d.player.state === 'started';
    d.player.stop();
    if (wasPlaying) d.player.start('+0', cueTime);
  }, [initTone, deckState]);

  const clearCue = useCallback((side, index) => {
    setDeckState(prev => {
      const cues = { ...prev[side].cues };
      delete cues[index];
      return { ...prev, [side]: { ...prev[side], cues } };
    });
  }, []);

  // ── FX Toggle ─────────────────────────────────────────────────────────────────
  const toggleFx = useCallback(async (side, fxName) => {
    await initTone();
    const d = deckRefs.current[side];
    if (!d.fxChain) return;

    const FX_MAP = {
      'Reverb':  { node: d.fxChain.reverb,     wet: 0.45 },
      'Echo':    { node: d.fxChain.delay,       wet: 0.4  },
      'Chorus':  { node: d.fxChain.chorus,      wet: 0.5  },
      'Phaser':  { node: d.fxChain.phaser,      wet: 0.6  },
      'Crush':   { node: d.fxChain.dist,        wet: 0.5  },
      'Filter':  { node: d.fxChain.autoFilter,  wet: 0.7  },
    };

    const fx = FX_MAP[fxName];
    if (!fx) return;

    setActiveFx(prev => {
      const current = prev[side];
      const isOn = current.includes(fxName);
      fx.node.wet.rampTo(isOn ? 0 : fx.wet, 0.1);
      return { ...prev, [side]: isOn ? current.filter(f => f !== fxName) : [...current, fxName] };
    });
  }, [initTone]);

  // ── Mix Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    await initTone();
    if (!recDestRef.current) return;
    recChunksRef.current = [];
    const recorder = new MediaRecorder(recDestRef.current.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 192000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auradj-mix-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [initTone]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ── Time polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      for (const side of ['A', 'B']) {
        const d = deckRefs.current[side];
        if (d.player?.state === 'started') {
          const ct = d.player.immediate?.() ?? 0;
          setDeckState(prev => {
            if (Math.abs((prev[side].currentTime || 0) - ct) < 0.05) return prev;
            return { ...prev, [side]: { ...prev[side], currentTime: ct, playing: true } };
          });
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      for (const side of ['A', 'B']) {
        const d = deckRefs.current[side];
        d.player?.stop(); d.player?.disconnect(); d.player?.dispose();
        Object.values(d.eq || {}).forEach(n => { try { n.disconnect(); n.dispose(); } catch {} });
        Object.values(d.fxChain || {}).forEach(n => { try { n.disconnect(); n.dispose(); } catch {} });
        d.deckGain?.disconnect(); d.deckGain?.dispose();
        d.xGain?.disconnect(); d.xGain?.dispose();
      }
      masterGainRef.current?.disconnect(); masterGainRef.current?.dispose();
    };
  }, []);

  const value = {
    // State
    deckState, eq, activeFx, crossfader, masterVolume, isRecording,
    // Actions
    loadTrack, togglePlay, seek,
    setEQBand, setDeckVolume, setPitch, setCrossfader, setMasterVolume,
    syncBPM, toggleLoop, setLoopSize,
    setCue, jumpToCue, clearCue,
    toggleFx,
    startRecording, stopRecording,
    // Init (call on first user interaction)
    initTone,
  };

  return <MixerContext.Provider value={value}>{children}</MixerContext.Provider>;
}

export const useMixer = () => {
  const ctx = useContext(MixerContext);
  if (!ctx) throw new Error('useMixer must be used within MixerProvider');
  return ctx;
};
