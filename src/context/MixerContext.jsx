import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

/**
 * MixerContext — Tone.js powered dual-deck DJ audio engine
 *
 * Signal flow per deck:
 *   Player → FFT Analyser (tap) → EQ (Hi/Mid/Low shelves) → FX chain → DeckGain → XfadeGain → Master → Speakers
 *                                                                                                      ↓
 *                                                                                              RecordingDest
 *
 * Audio-reactive data exposed:
 *   getAnalysis(side) → { bass, mid, high, overall, isBeat, fftRaw }
 */

const MixerContext = createContext(null);

// ── Audio-reactive helpers (from audio-analysis + audio-reactive skills) ─────
class Smoother {
  constructor(factor = 0.88) { this.factor = factor; this.value = 0; }
  update(v) { this.value = this.factor * this.value + (1 - this.factor) * v; return this.value; }
}

class BeatDetector {
  constructor(threshold = 0.68, decay = 0.97) {
    this.threshold = threshold; this.decay = decay;
    this.peak = 0; this.lastBeat = 0; this.minInterval = 220;
  }
  detect(bassEnergy) {
    this.peak *= this.decay;
    if (bassEnergy > this.peak) this.peak = bassEnergy;
    const now = Date.now();
    if (bassEnergy > this.peak * this.threshold && now - this.lastBeat > this.minInterval) {
      this.lastBeat = now;
      return true;
    }
    return false;
  }
}

function avgRange(data, startFrac, endFrac) {
  const start = Math.floor(data.length * startFrac);
  const end   = Math.floor(data.length * endFrac);
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start);
}

function normDB(db) { return Math.max(0, Math.min(1, (db + 100) / 100)); }

export function MixerProvider({ children }) {
  const toneRef       = useRef(null);
  const initialized   = useRef(false);

  // Per-deck audio nodes
  const deckRefs = useRef({
    A: { player: null, analyser: null, eq: null, fx: null, deckGain: null, xGain: null,
         smoothers: { bass: new Smoother(0.82), mid: new Smoother(0.88), high: new Smoother(0.92), overall: new Smoother(0.85) },
         beatDetector: new BeatDetector(), lastAnalysis: { bass:0, mid:0, high:0, overall:0, isBeat:false, fftRaw:null } },
    B: { player: null, analyser: null, eq: null, fx: null, deckGain: null, xGain: null,
         smoothers: { bass: new Smoother(0.82), mid: new Smoother(0.88), high: new Smoother(0.92), overall: new Smoother(0.85) },
         beatDetector: new BeatDetector(), lastAnalysis: { bass:0, mid:0, high:0, overall:0, isBeat:false, fftRaw:null } },
  });

  const masterGainRef = useRef(null);
  const recDestRef    = useRef(null);
  const recorderRef   = useRef(null);
  const recChunksRef  = useRef([]);

  // ── React state ─────────────────────────────────────────────────────────────
  const [deckState, setDeckState] = useState({
    A: { track:null, playing:false, loading:false, currentTime:0, duration:0, bpm:128, pitch:0, volume:85, loopActive:false, loopSize:4, cues:{} },
    B: { track:null, playing:false, loading:false, currentTime:0, duration:0, bpm:128, pitch:0, volume:85, loopActive:false, loopSize:4, cues:{} },
  });
  const [eq, setEq] = useState({
    A: { hi:50, mid:50, low:50 },
    B: { hi:50, mid:50, low:50 },
  });
  const [activeFx,      setActiveFx]      = useState({ A:[], B:[] });
  const [crossfader,    setCrossfaderUI]  = useState(50);
  const [masterVolume,  setMasterVolumeUI]= useState(80);
  const [isRecording,   setIsRecording]   = useState(false);

  // ── Init Tone.js ─────────────────────────────────────────────────────────────
  const initTone = useCallback(async () => {
    if (initialized.current) return toneRef.current;
    const Tone = await import('tone');
    await Tone.start();
    toneRef.current = Tone;

    // Master → speakers + recording tap
    const master = new Tone.Gain(0.8).toDestination();
    masterGainRef.current = master;
    const recDest = Tone.context.createMediaStreamDestination();
    master.connect(recDest);
    recDestRef.current = recDest;

    for (const side of ['A','B']) {
      const d = deckRefs.current[side];

      // FFT analyser tap (256 bins, 0.8 smoothing) — wired BEFORE EQ so we read dry signal
      const analyser = new Tone.Analyser({ type:'fft', size:256, smoothing:0.8 });
      d.analyser = analyser;

      // 3-band EQ
      const hi  = new Tone.Filter({ type:'highshelf', frequency:8000, gain:0 });
      const mid = new Tone.Filter({ type:'peaking',   frequency:1000, Q:1.2, gain:0 });
      const low = new Tone.Filter({ type:'lowshelf',  frequency:250,  gain:0 });
      d.eq = { hi, mid, low };

      // FX chain (all wet=0 until toggled)
      await (async () => {
        const reverb    = new Tone.Reverb({ decay:2.5, wet:0 });
        await reverb.generate();
        const delay     = new Tone.FeedbackDelay({ delayTime:'8n', feedback:0.4, wet:0 });
        const chorus    = new Tone.Chorus({ frequency:4, delayTime:2.5, depth:0.5, wet:0 }).start();
        const phaser    = new Tone.Phaser({ frequency:0.5, octaves:3, wet:0 });
        const dist      = new Tone.Distortion({ distortion:0.4, wet:0 });
        const autoFilt  = new Tone.AutoFilter({ frequency:1, wet:0 }).start();
        d.fx = { reverb, delay, chorus, phaser, dist, autoFilt };
      })();

      // Deck & crossfader gains
      const dGain = new Tone.Gain(0.85);
      const xGain = new Tone.Gain(side === 'A' ? 1 : 1); // set by setCrossfader
      d.deckGain = dGain; d.xGain = xGain;

      // Wire: analyser tap ← (player will connect here later)
      // Full chain: [player] → analyser → hi → mid → low → reverb → delay → chorus → phaser → dist → autoFilt → dGain → xGain → master
      analyser.connect(hi);
      hi.chain(mid, low, d.fx.reverb, d.fx.delay, d.fx.chorus, d.fx.phaser, d.fx.dist, d.fx.autoFilt, dGain, xGain, master);
    }

    // Init crossfader to center
    const A = deckRefs.current.A, B = deckRefs.current.B;
    if (A.xGain) A.xGain.gain.value = Math.cos(0.5 * Math.PI / 2);
    if (B.xGain) B.xGain.gain.value = Math.sin(0.5 * Math.PI / 2);

    initialized.current = true;
    return Tone;
  }, []);

  // ── getAnalysis — called every animation frame by UI components ──────────────
  const getAnalysis = useCallback((side) => {
    const d = deckRefs.current[side];
    if (!d.analyser || !d.player || d.player.state !== 'started') return d.lastAnalysis;

    try {
      const fft = d.analyser.getValue(); // Float32Array, dB values
      const rawBass    = avgRange(fft, 0,    0.08);
      const rawMid     = avgRange(fft, 0.08, 0.45);
      const rawHigh    = avgRange(fft, 0.45, 1.0);
      const rawOverall = avgRange(fft, 0,    1.0);

      const bass    = d.smoothers.bass.update(normDB(rawBass));
      const mid     = d.smoothers.mid.update(normDB(rawMid));
      const high    = d.smoothers.high.update(normDB(rawHigh));
      const overall = d.smoothers.overall.update(normDB(rawOverall));
      const isBeat  = d.beatDetector.detect(bass);

      d.lastAnalysis = { bass, mid, high, overall, isBeat, fftRaw: fft };
    } catch (_) {}
    return d.lastAnalysis;
  }, []);

  // ── Load track ────────────────────────────────────────────────────────────────
  const loadTrack = useCallback(async (side, track) => {
    if (!track?.audio_url) return;
    const Tone = await initTone();
    const d = deckRefs.current[side];

    if (d.player) {
      try { d.player.stop(); d.player.disconnect(); d.player.dispose(); } catch {}
      d.player = null;
    }

    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading:true, track, playing:false, currentTime:0, duration:0 } }));

    try {
      const player = new Tone.Player({
        url: track.audio_url,
        loop: false,
        autostart: false,
        onload: () => setDeckState(prev => ({
          ...prev, [side]: { ...prev[side], loading:false, duration: player.buffer?.duration || 0, bpm: track.bpm || 128 }
        })),
        onerror: () => setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading:false } })),
      });
      // Connect player → analyser (which is already wired into the rest of the chain)
      player.connect(d.analyser);
      d.player = player;
      player.playbackRate = Math.pow(2, (deckState[side]?.pitch || 0) / 12);
    } catch (err) {
      console.error('[Mixer] loadTrack', err);
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loading:false } }));
    }
  }, [initTone, deckState]);

  // ── Play / Pause ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async (side) => {
    const Tone = await initTone();
    const d = deckRefs.current[side];
    if (!d.player) return;
    if (d.player.state === 'started') {
      d.player.stop();
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], playing:false } }));
    } else {
      if (Tone.context.state === 'suspended') await Tone.context.resume();
      d.player.start();
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], playing:true } }));
    }
  }, [initTone]);

  // ── Seek ──────────────────────────────────────────────────────────────────────
  const seek = useCallback(async (side, time) => {
    await initTone();
    const d = deckRefs.current[side];
    if (!d.player) return;
    const wasPlaying = d.player.state === 'started';
    if (wasPlaying) d.player.stop();
    if (wasPlaying) d.player.start('+0.01', time);
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], currentTime: time } }));
  }, [initTone]);

  // ── EQ ────────────────────────────────────────────────────────────────────────
  const setEQBand = useCallback(async (side, band, value) => {
    await initTone();
    const node = deckRefs.current[side].eq?.[band];
    if (node) node.gain.rampTo(((value - 50) / 50) * 15, 0.05);
    setEq(prev => ({ ...prev, [side]: { ...prev[side], [band]: value } }));
  }, [initTone]);

  // ── Volume ────────────────────────────────────────────────────────────────────
  const setDeckVolume = useCallback(async (side, value) => {
    await initTone();
    const g = deckRefs.current[side].deckGain;
    if (g) g.gain.rampTo(value / 100, 0.05);
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], volume: value } }));
  }, [initTone]);

  // ── Crossfader (cosine law = pro DJ curve) ────────────────────────────────────
  const setCrossfader = useCallback(async (value) => {
    await initTone();
    const t = value / 100;
    const gA = Math.cos(t * (Math.PI / 2));
    const gB = Math.sin(t * (Math.PI / 2));
    const A = deckRefs.current.A, B = deckRefs.current.B;
    if (A.xGain) A.xGain.gain.rampTo(gA, 0.02);
    if (B.xGain) B.xGain.gain.rampTo(gB, 0.02);
    setCrossfaderUI(value);
  }, [initTone]);

  // ── Master volume ─────────────────────────────────────────────────────────────
  const setMasterVolume = useCallback(async (value) => {
    await initTone();
    if (masterGainRef.current) masterGainRef.current.gain.rampTo(value / 100, 0.05);
    setMasterVolumeUI(value);
  }, [initTone]);

  // ── Pitch ─────────────────────────────────────────────────────────────────────
  const setPitch = useCallback(async (side, semitones) => {
    await initTone();
    const d = deckRefs.current[side];
    if (d.player) d.player.playbackRate = Math.pow(2, semitones / 12);
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], pitch: semitones } }));
  }, [initTone]);

  // ── BPM sync ──────────────────────────────────────────────────────────────────
  const syncBPM = useCallback(async (fromSide) => {
    await initTone();
    const toSide = fromSide === 'A' ? 'B' : 'A';
    const srcBPM = deckState[fromSide]?.bpm;
    const dstBPM = deckState[toSide]?.bpm;
    if (!srcBPM || !dstBPM) return;
    const d = deckRefs.current[toSide];
    if (d.player) d.player.playbackRate = srcBPM / dstBPM;
    setDeckState(prev => ({ ...prev, [toSide]: { ...prev[toSide], bpm: srcBPM } }));
  }, [initTone, deckState]);

  // ── Loop ──────────────────────────────────────────────────────────────────────
  const toggleLoop = useCallback(async (side) => {
    await initTone();
    const d = deckRefs.current[side];
    const s = deckState[side];
    if (!d.player) return;
    if (s.loopActive) {
      d.player.loop = false;
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopActive:false } }));
    } else {
      const dur = (s.loopSize * 4 * 60) / (s.bpm || 128);
      d.player.loop = true;
      d.player.loopStart = s.currentTime || 0;
      d.player.loopEnd   = (s.currentTime || 0) + dur;
      setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopActive:true } }));
    }
  }, [initTone, deckState]);

  const setLoopSize = useCallback((side, bars) => {
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], loopSize:bars } }));
  }, []);

  // ── Hot cues ──────────────────────────────────────────────────────────────────
  const setCue = useCallback((side, index) => {
    const t = deckState[side]?.currentTime || 0;
    setDeckState(prev => ({ ...prev, [side]: { ...prev[side], cues: { ...prev[side].cues, [index]: t } } }));
  }, [deckState]);

  const jumpToCue = useCallback(async (side, index) => {
    const t = deckState[side]?.cues[index];
    if (t === undefined) return;
    await seek(side, t);
  }, [seek, deckState]);

  const clearCue = useCallback((side, index) => {
    setDeckState(prev => {
      const cues = { ...prev[side].cues }; delete cues[index];
      return { ...prev, [side]: { ...prev[side], cues } };
    });
  }, []);

  // ── FX toggle ─────────────────────────────────────────────────────────────────
  const FX_WET = { Reverb:0.45, Echo:0.4, Chorus:0.5, Phaser:0.6, Crush:0.5, Filter:0.7 };
  const FX_KEY = { Reverb:'reverb', Echo:'delay', Chorus:'chorus', Phaser:'phaser', Crush:'dist', Filter:'autoFilt' };

  const toggleFx = useCallback(async (side, fxName) => {
    await initTone();
    const node = deckRefs.current[side].fx?.[FX_KEY[fxName]];
    if (!node) return;
    setActiveFx(prev => {
      const on = prev[side].includes(fxName);
      node.wet.rampTo(on ? 0 : (FX_WET[fxName] || 0.4), 0.1);
      return { ...prev, [side]: on ? prev[side].filter(f => f !== fxName) : [...prev[side], fxName] };
    });
  }, [initTone]);

  // ── Recording ─────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    await initTone();
    if (!recDestRef.current) return;
    recChunksRef.current = [];
    const rec = new MediaRecorder(recDestRef.current.stream, { mimeType:'audio/webm;codecs=opus', audioBitsPerSecond:192000 });
    rec.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type:'audio/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `auradj-mix-${Date.now()}.webm`; a.click();
      URL.revokeObjectURL(url);
    };
    rec.start(100);
    recorderRef.current = rec;
    setIsRecording(true);
  }, [initTone]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  // ── Time polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      for (const side of ['A','B']) {
        const d = deckRefs.current[side];
        if (!d.player || d.player.state !== 'started') continue;
        // Tone.Player exposes currentTime via .immediate() — fallback gracefully
        try {
          const ct = d.player.toSeconds(d.player.now?.() ?? 0);
          setDeckState(prev => {
            if (Math.abs((prev[side].currentTime || 0) - ct) < 0.1) return prev;
            return { ...prev, [side]: { ...prev[side], currentTime: ct, playing: true } };
          });
        } catch {}
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      for (const side of ['A','B']) {
        const d = deckRefs.current[side];
        try { d.player?.stop(); d.player?.disconnect(); d.player?.dispose(); } catch {}
        try { d.analyser?.disconnect(); d.analyser?.dispose(); } catch {}
        try { Object.values(d.eq  || {}).forEach(n => { n.disconnect(); n.dispose(); }); } catch {}
        try { Object.values(d.fx  || {}).forEach(n => { n.disconnect(); n.dispose(); }); } catch {}
        try { d.deckGain?.disconnect(); d.deckGain?.dispose(); } catch {}
        try { d.xGain?.disconnect();   d.xGain?.dispose();   } catch {}
      }
      try { masterGainRef.current?.disconnect(); masterGainRef.current?.dispose(); } catch {}
    };
  }, []);

  const value = {
    deckState, setDeckState, eq, activeFx, crossfader, masterVolume, isRecording,
    loadTrack, togglePlay, seek,
    setEQBand, setDeckVolume, setPitch, setCrossfader, setMasterVolume,
    syncBPM, toggleLoop, setLoopSize,
    setCue, jumpToCue, clearCue,
    toggleFx,
    startRecording, stopRecording,
    getAnalysis,
    initTone,
  };

  return <MixerContext.Provider value={value}>{children}</MixerContext.Provider>;
}

export const useMixer = () => {
  const ctx = useContext(MixerContext);
  if (!ctx) throw new Error('useMixer must be used within MixerProvider');
  return ctx;
};
