import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/context/PlayerContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Play, Pause, SkipForward, SkipBack, Loader2,
  Shuffle, Repeat, Zap, Music2, Settings2,
  RotateCcw, Plus, Minus, ChevronUp, ChevronDown,
  Headphones, Radio, Wand2, Volume2, VolumeX
} from 'lucide-react';

// ─── Utility ───────────────────────────────────────────────────────────────────
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Turntable Platter ─────────────────────────────────────────────────────────
function Platter({ isPlaying, coverUrl, size = 200, bpm = 120 }) {
  const deg = useRef(0);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const r = W / 2 - 4;
    // rpm = bpm / 2 for visual feel, capped at 33.3rpm
    const rpm = Math.min(bpm / 2, 45);
    const degsPerFrame = (rpm * 360) / (60 * 60); // at 60fps

    let img = null;
    if (coverUrl) {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => { img = image; };
      image.src = coverUrl;
    }

    const draw = () => {
      if (isPlaying) deg.current = (deg.current + degsPerFrame) % 360;

      ctx.clearRect(0, 0, W, H);

      // Outer ring — grooves
      const outerGrad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
      outerGrad.addColorStop(0, '#111');
      outerGrad.addColorStop(0.4, '#1a1a1a');
      outerGrad.addColorStop(0.7, '#0d0d0d');
      outerGrad.addColorStop(1, '#222');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Vinyl grooves (concentric rings)
      for (let i = 20; i < r - 2; i += 3.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, i, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Rotating label area
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((deg.current * Math.PI) / 180);

      // Label disc
      const labelR = r * 0.38;
      ctx.beginPath();
      ctx.arc(0, 0, labelR, 0, Math.PI * 2);
      if (img) {
        const pat = ctx.createPattern(img, 'no-repeat') || '#1a1a1a';
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        // draw image clipped to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, labelR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -labelR, -labelR, labelR * 2, labelR * 2);
        ctx.restore();
      } else {
        // Electric lime label
        const lGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, labelR);
        lGrad.addColorStop(0, '#C8FF00');
        lGrad.addColorStop(0.6, '#a0cc00');
        lGrad.addColorStop(1, '#6a8a00');
        ctx.fillStyle = lGrad;
        ctx.fill();
      }

      // Spindle hole
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      ctx.restore();

      // Tone arm hint (static)
      ctx.beginPath();
      ctx.moveTo(cx + r - 12, cy - r + 8);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.3);
      ctx.strokeStyle = 'rgba(200,255,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer chrome ring
      const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      ringGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      ringGrad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
      ringGrad.addColorStop(1, 'rgba(255,255,255,0.12)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, coverUrl, bpm]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', display: 'block' }}
    />
  );
}

// ─── EQ Knob ──────────────────────────────────────────────────────────────────
function EQKnob({ label, value, onChange, color = '#C8FF00' }) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const angle = ((value - 50) / 50) * 135; // -135° to +135°

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const delta = (startY.current - e.clientY) * 0.8;
    onChange(clamp(startVal.current + delta, 0, 100));
  }, [onChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Touch support
  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    startVal.current = value;
  };
  const handleTouchMove = (e) => {
    const delta = (startY.current - e.touches[0].clientY) * 0.8;
    onChange(clamp(startVal.current + delta, 0, 100));
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        className="relative w-11 h-11 rounded-full cursor-ns-resize"
        style={{ background: 'radial-gradient(circle at 35% 35%, #2a2a2a, #111)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Ring track */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="22" cy="22" r="18"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${(value / 100) * 113} 113`}
            strokeLinecap="round"
            transform="rotate(-225 22 22)"
            style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
        </svg>
        {/* Indicator dot */}
        <div
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: color,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-14px)`,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        {/* Double-click to reset */}
        <div
          className="absolute inset-0 rounded-full"
          onDoubleClick={() => onChange(50)}
        />
      </div>
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Waveform Strip ────────────────────────────────────────────────────────────
function WaveStrip({ isPlaying, progress = 0, color = '#C8FF00', height = 48 }) {
  const canvasRef = useRef(null);
  const barsRef = useRef(
    Array.from({ length: 80 }, () => ({
      h: 0.1 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.02,
    }))
  );
  const tRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barW = W / 80 - 0.5;
      const progX = progress * W;

      barsRef.current.forEach((bar, i) => {
        const x = (i / 80) * W;
        const anim = isPlaying ? Math.sin(tRef.current * bar.speed * 60 + bar.phase) * 0.12 : 0;
        const barH = Math.max(2, (bar.h + anim) * H * 0.85);
        const y = (H - barH) / 2;
        const played = x < progX;

        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        if (played) {
          grad.addColorStop(0, color);
          grad.addColorStop(1, color + '55');
        } else {
          grad.addColorStop(0, 'rgba(255,255,255,0.25)');
          grad.addColorStop(1, 'rgba(255,255,255,0.06)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1);
        ctx.fill();
      });

      // Playhead
      ctx.fillStyle = '#fff';
      ctx.fillRect(progX - 1, 0, 2, H);

      tRef.current += 1;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, progress, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block', cursor: 'pointer' }}
      aria-hidden="true"
    />
  );
}

// ─── Loop Controls ─────────────────────────────────────────────────────────────
function LoopControls({ active, onToggle, loopSize, onLoopSize }) {
  const sizes = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggle}
        className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${active ? 'bg-[#C8FF00] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
      >
        LOOP
      </button>
      <div className="flex gap-0.5">
        {sizes.map(s => (
          <button
            key={s}
            onClick={() => onLoopSize(s)}
            className={`w-7 py-1 rounded text-[9px] font-mono transition-all ${loopSize === s ? 'bg-[#C8FF00] text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
          >
            {s < 1 ? `1/${1/s}` : s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Hot Cues ──────────────────────────────────────────────────────────────────
const CUE_COLORS = ['#ff4d4d', '#ff9900', '#C8FF00', '#00cfff', '#a855f7', '#ff69b4', '#fff', '#888'];
function HotCues({ cues, onSet, onJump, onClear }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {CUE_COLORS.map((color, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <button
            className="h-7 rounded text-[9px] font-mono font-bold transition-all active:scale-95"
            style={{
              background: cues[i] !== undefined ? color : 'rgba(255,255,255,0.08)',
              color: cues[i] !== undefined ? '#000' : color,
              border: `1px solid ${color}44`,
              boxShadow: cues[i] !== undefined ? `0 0 8px ${color}88` : 'none',
            }}
            onClick={() => cues[i] !== undefined ? onJump(i) : onSet(i)}
            onContextMenu={(e) => { e.preventDefault(); onClear(i); }}
          >
            {cues[i] !== undefined ? `▶` : `+`}
          </button>
          <span className="text-[8px] text-center font-mono" style={{ color }}>C{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FX Pad ────────────────────────────────────────────────────────────────────
const FX_LIST = ['Echo', 'Flanger', 'Reverb', 'Filter', 'Phaser', 'Crush', 'Pitch', 'Gate'];
function FXPad({ activeFx, onToggle }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {FX_LIST.map((fx, i) => (
        <button
          key={fx}
          onClick={() => onToggle(fx)}
          className={`py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide transition-all active:scale-95 ${
            activeFx.includes(fx)
              ? 'bg-[#C8FF00] text-black shadow-[0_0_12px_#C8FF0066]'
              : 'bg-white/8 text-white/50 border border-white/10 hover:border-[#C8FF00]/40 hover:text-white/80'
          }`}
        >
          {fx}
        </button>
      ))}
    </div>
  );
}

// ─── Deck ──────────────────────────────────────────────────────────────────────
function Deck({ side, track, isPlaying, isLoading, onPlay, onLoad, allTracks, progress, currentTime, duration }) {
  const [bpm, setBpm] = useState(track?.bpm || 128);
  const [pitch, setPitch] = useState(0); // semitones
  const [vol, setVol] = useState(85);
  const [eqHigh, setEqHigh] = useState(50);
  const [eqMid, setEqMid] = useState(50);
  const [eqLow, setEqLow] = useState(50);
  const [loopActive, setLoopActive] = useState(false);
  const [loopSize, setLoopSize] = useState(4);
  const [cues, setCues] = useState({});
  const [activeFx, setActiveFx] = useState([]);
  const [showTracks, setShowTracks] = useState(false);

  useEffect(() => { if (track?.bpm) setBpm(track.bpm); }, [track]);

  const isLeft = side === 'A';
  const accentColor = isLeft ? '#C8FF00' : '#00cfff';

  const toggleFx = (fx) => {
    setActiveFx(prev => prev.includes(fx) ? prev.filter(f => f !== fx) : [...prev, fx]);
    toast(`${fx} ${activeFx.includes(fx) ? 'off' : 'on'}`, { duration: 900 });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Deck header */}
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black font-mono"
          style={{ background: accentColor, color: '#000' }}
        >
          {side}
        </div>
        <div className="flex-1 mx-3 min-w-0">
          <p className="text-sm font-semibold truncate leading-none">
            {track?.title || 'Load Track'}
          </p>
          <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate">
            {track?.artist || track?.genre || '—'} · {formatTime(duration)}
          </p>
        </div>
        <button
          onClick={() => setShowTracks(v => !v)}
          className="text-white/40 hover:text-white transition-colors"
        >
          <Music2 className="w-4 h-4" />
        </button>
      </div>

      {/* Track picker dropdown */}
      <AnimatePresence>
        {showTracks && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 rounded-xl border border-white/10 p-2 max-h-36 overflow-y-auto space-y-1">
              {allTracks.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onLoad(t); setShowTracks(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors truncate"
                >
                  {t.title} <span className="text-white/40">· {t.bpm || '?'} BPM</span>
                </button>
              ))}
              {allTracks.length === 0 && (
                <p className="text-white/30 text-xs text-center py-2">Generate tracks first</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platter */}
      <div className="flex justify-center relative">
        <div style={{ filter: `drop-shadow(0 0 20px ${accentColor}33)` }}>
          <Platter isPlaying={isPlaying} coverUrl={track?.cover_art_url} size={180} bpm={bpm} />
        </div>
        {/* Play button overlay */}
        <button
          onClick={onPlay}
          disabled={!track || isLoading}
          className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin text-white" />
              : isPlaying
                ? <Pause className="w-5 h-5 text-white" />
                : <Play className="w-5 h-5 text-white ml-0.5" />
            }
          </div>
        </button>
      </div>

      {/* BPM + Pitch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setBpm(b => Math.max(60, b - 1))} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20">
            <Minus className="w-3 h-3" />
          </button>
          <div className="text-center">
            <div className="text-sm font-black font-mono" style={{ color: accentColor }}>{bpm}</div>
            <div className="text-[8px] text-white/40 font-mono">BPM</div>
          </div>
          <button onClick={() => setBpm(b => Math.min(200, b + 1))} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Pitch slider vertical */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => setPitch(0)} className="text-[8px] font-mono text-white/40 hover:text-white">RESET</button>
          <input
            type="range" min={-8} max={8} step={0.1} value={pitch}
            onChange={e => setPitch(Number(e.target.value))}
            className="h-20 cursor-pointer accent-[#C8FF00]"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
          />
          <div className="text-[9px] font-mono" style={{ color: accentColor }}>
            {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}
          </div>
        </div>

        {/* Volume */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-[9px] font-mono text-white/40">VOL</div>
          <input
            type="range" min={0} max={100} value={vol}
            onChange={e => setVol(Number(e.target.value))}
            className="h-20 cursor-pointer accent-[#C8FF00]"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
          />
          <div className="text-[9px] font-mono" style={{ color: accentColor }}>{vol}</div>
        </div>
      </div>

      {/* Waveform */}
      <div className="rounded-xl overflow-hidden bg-black/40 border border-white/10 p-1">
        <WaveStrip isPlaying={isPlaying} progress={duration > 0 ? currentTime / duration : 0} color={accentColor} height={44} />
        <div className="flex justify-between px-1 mt-0.5">
          <span className="text-[9px] font-mono text-white/30">{formatTime(currentTime)}</span>
          <span className="text-[9px] font-mono text-white/30">-{formatTime(Math.max(0, duration - currentTime))}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2">
        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95">
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={onPlay}
          disabled={!track || isLoading}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
          style={{ background: accentColor, boxShadow: `0 0 16px ${accentColor}66` }}
        >
          {isLoading
            ? <Loader2 className="w-5 h-5 animate-spin text-black" />
            : isPlaying
              ? <Pause className="w-5 h-5 text-black" />
              : <Play className="w-5 h-5 text-black ml-0.5" />
          }
        </button>
        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* EQ Knobs */}
      <div className="flex justify-around px-2">
        <EQKnob label="HI" value={eqHigh} onChange={setEqHigh} color={accentColor} />
        <EQKnob label="MID" value={eqMid} onChange={setEqMid} color={accentColor} />
        <EQKnob label="LOW" value={eqLow} onChange={setEqLow} color={accentColor} />
      </div>

      {/* Loop controls */}
      <div className="overflow-x-auto">
        <LoopControls
          active={loopActive}
          onToggle={() => setLoopActive(v => !v)}
          loopSize={loopSize}
          onLoopSize={setLoopSize}
        />
      </div>

      {/* Hot cues */}
      <HotCues
        cues={cues}
        onSet={i => setCues(prev => ({ ...prev, [i]: currentTime }))}
        onJump={i => toast(`Jump to cue ${i + 1}: ${formatTime(cues[i])}`, { duration: 800 })}
        onClear={i => setCues(prev => { const n = { ...prev }; delete n[i]; return n; })}
      />

      {/* FX Pads */}
      <FXPad activeFx={activeFx} onToggle={toggleFx} />
    </div>
  );
}

// ─── Crossfader + Mixer Center ─────────────────────────────────────────────────
function MixerCenter({ crossfader, onCrossfader, onSync, bpmA, bpmB }) {
  const [masterVol, setMasterVol] = useState(80);
  const [headphoneVol, setHeadphoneVol] = useState(70);
  const [cueMix, setCueMix] = useState(50);

  return (
    <div className="flex flex-col items-center gap-4 px-2">
      {/* Master BPM display */}
      <div className="text-center">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Master</div>
        <div className="text-2xl font-black font-mono text-white">
          {Math.round((bpmA + bpmB) / 2)}
        </div>
        <div className="text-[9px] font-mono text-white/30">BPM</div>
      </div>

      {/* Sync button */}
      <button
        onClick={onSync}
        className="w-14 h-8 rounded-full text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95"
        style={{ background: '#C8FF00', color: '#000', boxShadow: '0 0 12px #C8FF0055' }}
      >
        SYNC
      </button>

      {/* Master volume */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="text-[9px] font-mono text-white/40">MASTER</div>
        <input
          type="range" min={0} max={100} value={masterVol}
          onChange={e => setMasterVol(Number(e.target.value))}
          className="w-full cursor-pointer accent-[#C8FF00]"
        />
        <div className="text-[9px] font-mono text-[#C8FF00]">{masterVol}%</div>
      </div>

      {/* Crossfader */}
      <div className="w-full">
        <div className="flex justify-between text-[9px] font-mono mb-1">
          <span className="text-[#C8FF00]">A</span>
          <span className="text-white/30">XFADER</span>
          <span className="text-[#00cfff]">B</span>
        </div>
        <div className="relative">
          <input
            type="range" min={0} max={100} value={crossfader}
            onChange={e => onCrossfader(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: '#C8FF00' }}
          />
          {/* Center notch indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/20 pointer-events-none" />
        </div>
      </div>

      {/* Headphone cue */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="flex items-center gap-1">
          <Headphones className="w-3 h-3 text-white/40" />
          <span className="text-[9px] font-mono text-white/40">CUE MIX</span>
        </div>
        <input
          type="range" min={0} max={100} value={cueMix}
          onChange={e => setCueMix(Number(e.target.value))}
          className="w-full cursor-pointer accent-[#C8FF00]"
        />
      </div>

      {/* Headphone volume */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="flex items-center gap-1">
          <Volume2 className="w-3 h-3 text-white/40" />
          <span className="text-[9px] font-mono text-white/40">HP VOL</span>
        </div>
        <input
          type="range" min={0} max={100} value={headphoneVol}
          onChange={e => setHeadphoneVol(Number(e.target.value))}
          className="w-full cursor-pointer accent-[#C8FF00]"
        />
      </div>

      {/* VU meters */}
      <div className="flex gap-2 items-end">
        {[...Array(8)].map((_, i) => {
          const h = Math.random() * 100;
          return (
            <div key={i} className="flex flex-col gap-0.5 items-center">
              <div
                className="w-1.5 rounded-sm transition-all duration-75"
                style={{
                  height: 40,
                  background: `linear-gradient(to top, #C8FF00, #ffcc00 60%, #ff4444)`,
                  clipPath: `inset(${100 - h}% 0 0 0)`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main DJMixer Export ───────────────────────────────────────────────────────
export default function DJMixer({ tracks = [], onGenerate, isGenerating }) {
  const { play, isPlaying, currentTrack, togglePlay, currentTime, duration } = usePlayer();
  const [deckA, setDeckA] = useState(tracks[0] || null);
  const [deckB, setDeckB] = useState(tracks[1] || null);
  const [activeDeck, setActiveDeck] = useState('A');
  const [crossfader, setCrossfader] = useState(50);
  const [loadingDeck, setLoadingDeck] = useState(null);

  useEffect(() => {
    if (tracks[0] && !deckA) setDeckA(tracks[0]);
    if (tracks[1] && !deckB) setDeckB(tracks[1]);
  }, [tracks]);

  const isPlayingA = isPlaying && currentTrack?.id === deckA?.id;
  const isPlayingB = isPlaying && currentTrack?.id === deckB?.id;

  const handlePlayDeck = (deck, track) => {
    if (!track) return;
    if (deck === 'A') {
      setActiveDeck('A');
      if (isPlayingA) togglePlay();
      else play(track, []);
    } else {
      setActiveDeck('B');
      if (isPlayingB) togglePlay();
      else play(track, []);
    }
  };

  const handleSync = () => {
    toast('BPM synced! ⚡', { duration: 1000 });
  };

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8"
        style={{ background: 'linear-gradient(90deg, #C8FF0012, transparent, #00cfff12)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#C8FF00] animate-pulse" />
          <span className="text-xs font-black font-mono uppercase tracking-widest text-white/70">AuraDJ Mixer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onGenerate?.()}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all active:scale-95"
            style={{ background: '#C8FF00', color: '#000' }}
          >
            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Generate
          </button>
          <Radio className="w-4 h-4 text-white/30" />
        </div>
      </div>

      {/* Three-column mixer layout */}
      <div className="grid grid-cols-[1fr_140px_1fr] gap-0 p-4 gap-x-3">
        {/* Deck A */}
        <Deck
          side="A"
          track={deckA}
          isPlaying={isPlayingA}
          isLoading={loadingDeck === 'A'}
          onPlay={() => handlePlayDeck('A', deckA)}
          onLoad={(t) => setDeckA(t)}
          allTracks={tracks}
          progress={isPlayingA && duration > 0 ? currentTime / duration : 0}
          currentTime={isPlayingA ? currentTime : 0}
          duration={isPlayingA ? duration : deckA?.duration_seconds || 0}
        />

        {/* Center mixer */}
        <MixerCenter
          crossfader={crossfader}
          onCrossfader={setCrossfader}
          onSync={handleSync}
          bpmA={deckA?.bpm || 128}
          bpmB={deckB?.bpm || 128}
        />

        {/* Deck B */}
        <Deck
          side="B"
          track={deckB}
          isPlaying={isPlayingB}
          isLoading={loadingDeck === 'B'}
          onPlay={() => handlePlayDeck('B', deckB)}
          onLoad={(t) => setDeckB(t)}
          allTracks={tracks}
          progress={isPlayingB && duration > 0 ? currentTime / duration : 0}
          currentTime={isPlayingB ? currentTime : 0}
          duration={isPlayingB ? duration : deckB?.duration_seconds || 0}
        />
      </div>
    </div>
  );
}
