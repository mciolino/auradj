import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMixer } from '@/context/MixerContext';
import { toast } from 'sonner';
import {
  Play, Pause, SkipForward, SkipBack, Loader2,
  Plus, Minus, Music2, Wand2, Volume2,
  Headphones, Radio, Disc3, Circle, Square,
  RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Spinning Vinyl Platter ────────────────────────────────────────────────────
function Platter({ isPlaying, coverUrl, size = 190, bpm = 128, accentColor = '#C8FF00' }) {
  const canvasRef = useRef(null);
  const degRef = useRef(0);
  const rafRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (coverUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imgRef.current = img; };
      img.src = coverUrl;
    } else {
      imgRef.current = null;
    }
  }, [coverUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = size / 2 - 3;
    const rpm = Math.min(bpm / 2, 45);
    const degsPerFrame = (rpm * 360) / (60 * 60);

    const draw = () => {
      if (isPlaying) degRef.current = (degRef.current + degsPerFrame) % 360;
      ctx.clearRect(0, 0, size, size);

      // Vinyl body
      const vGrad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      vGrad.addColorStop(0, '#141414');
      vGrad.addColorStop(0.5, '#0d0d0d');
      vGrad.addColorStop(1, '#1e1e1e');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = vGrad; ctx.fill();

      // Groove rings
      for (let i = r * 0.45; i < r - 2; i += 3) {
        ctx.beginPath(); ctx.arc(cx, cy, i, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1.2; ctx.stroke();
      }

      // Rotating label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((degRef.current * Math.PI) / 180);
      const labelR = r * 0.36;

      ctx.beginPath(); ctx.arc(0, 0, labelR, 0, Math.PI * 2);
      if (imgRef.current) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(imgRef.current, -labelR, -labelR, labelR * 2, labelR * 2);
        ctx.restore();
      } else {
        const lGrad = ctx.createRadialGradient(0, -labelR * 0.2, 0, 0, 0, labelR);
        lGrad.addColorStop(0, accentColor);
        lGrad.addColorStop(0.5, accentColor + 'cc');
        lGrad.addColorStop(1, '#2a2a00');
        ctx.fillStyle = lGrad; ctx.fill();
        // Brand text on label
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = `bold ${Math.round(labelR * 0.22)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('AURA', 0, -4);
        ctx.font = `${Math.round(labelR * 0.16)}px monospace`;
        ctx.fillText('DJ', 0, labelR * 0.28);
      }

      // Spindle
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#333'; ctx.fill();
      ctx.restore();

      // Chrome ring
      const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      ringGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
      ringGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      ringGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad; ctx.lineWidth = 2.5; ctx.stroke();

      // Playing glow ring
      if (isPlaying) {
        ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.strokeStyle = accentColor + '44'; ctx.lineWidth = 4; ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, size, bpm, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: '50%', display: 'block', cursor: 'pointer' }}
    />
  );
}

// ─── Rotary EQ Knob ────────────────────────────────────────────────────────────
function EQKnob({ label, value, onChange, color = '#C8FF00' }) {
  const dragRef = useRef({ active: false, startY: 0, startVal: 0 });

  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { active: true, startY: e.clientY, startVal: value };
    const onMove = (ev) => {
      if (!dragRef.current.active) return;
      const delta = (dragRef.current.startY - ev.clientY) * 0.9;
      onChange(clamp(dragRef.current.startVal + delta, 0, 100));
    };
    const onUp = () => {
      dragRef.current.active = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onTouchStart = (e) => {
    dragRef.current = { active: true, startY: e.touches[0].clientY, startVal: value };
  };
  const onTouchMove = (e) => {
    const delta = (dragRef.current.startY - e.touches[0].clientY) * 0.9;
    onChange(clamp(dragRef.current.startVal + delta, 0, 100));
  };

  // Arc: 0→-135deg, 100→+135deg (270deg travel)
  const RADIUS = 16;
  const CIRC = 2 * Math.PI * RADIUS;
  const travel = (value / 100) * (270 / 360) * CIRC;
  const gap = CIRC - (270 / 360) * CIRC;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div
        className="relative w-10 h-10 rounded-full cursor-ns-resize"
        style={{ background: 'radial-gradient(circle at 35% 30%, #2c2c2c, #0e0e0e)' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onDoubleClick={() => onChange(50)}
      >
        <svg className="absolute inset-0" width="40" height="40" viewBox="0 0 40 40">
          {/* Track */}
          <circle cx="20" cy="20" r={RADIUS} fill="none"
            stroke="rgba(255,255,255,0.08)" strokeWidth="3"
            strokeDasharray={`${(270/360)*CIRC} ${gap}`}
            strokeLinecap="round"
            transform="rotate(135 20 20)" />
          {/* Fill */}
          <circle cx="20" cy="20" r={RADIUS} fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${travel} ${CIRC - travel}`}
            strokeLinecap="round"
            transform="rotate(135 20 20)"
            style={{ filter: `drop-shadow(0 0 3px ${color}88)`, transition: 'stroke-dasharray 0.05s' }} />
        </svg>
        {/* Dot indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              transform: `rotate(${((value / 100) * 270 - 135)}deg) translateY(-11px)`,
              transformOrigin: '50% 50%',
              boxShadow: `0 0 5px ${color}`,
            }}
          />
        </div>
      </div>
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Waveform Strip ────────────────────────────────────────────────────────────
function WaveStrip({ isPlaying, progress = 0, color = '#C8FF00', onSeek, duration = 0 }) {
  const canvasRef = useRef(null);
  const barsRef = useRef(Array.from({ length: 90 }, () => ({
    h: 0.08 + Math.random() * 0.92,
    phase: Math.random() * Math.PI * 2,
    speed: 0.012 + Math.random() * 0.018,
  })));
  const tRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const n = barsRef.current.length;
      const barW = W / n - 0.4;
      const progX = progress * W;

      barsRef.current.forEach((bar, i) => {
        const x = (i / n) * W;
        const anim = isPlaying ? Math.sin(tRef.current * bar.speed * 60 + bar.phase) * 0.1 : 0;
        const bh = Math.max(2, (bar.h + anim) * H * 0.88);
        const y = (H - bh) / 2;
        const played = x < progX;

        const g = ctx.createLinearGradient(x, y, x, y + bh);
        if (played) {
          g.addColorStop(0, color);
          g.addColorStop(1, color + '55');
        } else {
          g.addColorStop(0, 'rgba(255,255,255,0.2)');
          g.addColorStop(1, 'rgba(255,255,255,0.05)');
        }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(x, y, barW, bh, 1); ctx.fill();
      });

      // Playhead
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(progX - 1, 0, 2, H);
      // Playhead glow
      ctx.fillStyle = color + '66';
      ctx.fillRect(progX - 2, 0, 4, H);

      tRef.current++;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, progress, color]);

  const handleClick = (e) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * duration);
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 48, display: 'block', cursor: duration ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  );
}

// ─── Hot Cues ──────────────────────────────────────────────────────────────────
const CUE_COLORS = ['#ff3b3b','#ff9500','#C8FF00','#00d2ff','#a855f7','#ff2d78','#ffffff','#888888'];

function HotCues({ side }) {
  const { deckState, setCue, jumpToCue, clearCue } = useMixer();
  const cues = deckState[side].cues;

  return (
    <div className="grid grid-cols-8 gap-1">
      {CUE_COLORS.map((color, i) => {
        const set = cues[i] !== undefined;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <button
              className="w-full h-7 rounded-[4px] text-[10px] font-black transition-all active:scale-95"
              style={{
                background: set ? color : 'rgba(255,255,255,0.07)',
                color: set ? '#000' : color,
                border: `1px solid ${color}55`,
                boxShadow: set ? `0 0 10px ${color}77` : 'none',
              }}
              onClick={() => set ? jumpToCue(side, i) : setCue(side, i)}
              onContextMenu={(e) => { e.preventDefault(); clearCue(side, i); }}
              title={set ? `Cue ${i+1}: ${formatTime(cues[i])} (right-click to clear)` : `Set cue ${i+1}`}
            >
              {set ? '▶' : '+'}
            </button>
            <span className="text-[8px] font-mono" style={{ color }}>C{i+1}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── FX Pads ──────────────────────────────────────────────────────────────────
const FX_LIST = ['Reverb', 'Echo', 'Chorus', 'Filter', 'Phaser', 'Crush'];

function FXPads({ side }) {
  const { activeFx, toggleFx } = useMixer();
  const active = activeFx[side] || [];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {FX_LIST.map(fx => {
        const on = active.includes(fx);
        return (
          <button
            key={fx}
            onClick={() => toggleFx(side, fx)}
            className="py-1.5 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wide transition-all active:scale-95"
            style={{
              background: on ? '#C8FF00' : 'rgba(255,255,255,0.06)',
              color: on ? '#000' : 'rgba(255,255,255,0.45)',
              border: `1px solid ${on ? '#C8FF00' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: on ? '0 0 14px #C8FF0055' : 'none',
            }}
          >
            {fx}
          </button>
        );
      })}
    </div>
  );
}

// ─── Loop Controls ─────────────────────────────────────────────────────────────
const LOOP_SIZES = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

function LoopControls({ side, accentColor }) {
  const { deckState, toggleLoop, setLoopSize } = useMixer();
  const { loopActive, loopSize } = deckState[side];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => toggleLoop(side)}
        className="px-2.5 py-1 rounded-[4px] text-[10px] font-black font-mono uppercase tracking-wider transition-all"
        style={{
          background: loopActive ? accentColor : 'rgba(255,255,255,0.08)',
          color: loopActive ? '#000' : 'rgba(255,255,255,0.5)',
          border: `1px solid ${loopActive ? accentColor : 'rgba(255,255,255,0.12)'}`,
          boxShadow: loopActive ? `0 0 12px ${accentColor}66` : 'none',
        }}
      >
        LOOP
      </button>
      <div className="flex gap-0.5 flex-wrap">
        {LOOP_SIZES.map(s => (
          <button
            key={s}
            onClick={() => setLoopSize(side, s)}
            className="w-7 py-0.5 rounded-[3px] text-[9px] font-mono transition-all"
            style={{
              background: loopSize === s ? accentColor : 'rgba(255,255,255,0.07)',
              color: loopSize === s ? '#000' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${loopSize === s ? accentColor : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {s < 1 ? `1/${1/s}` : s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Vertical Fader ────────────────────────────────────────────────────────────
function VertFader({ value, onChange, color = '#C8FF00', label, min = 0, max = 100, step = 1, unit = '' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] font-mono text-white/30">{label}</div>
      <div className="relative flex items-center justify-center" style={{ height: 80 }}>
        <div className="absolute w-1 rounded-full" style={{ height: 76, background: 'rgba(255,255,255,0.08)', top: 2 }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="cursor-pointer"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            WebkitAppearance: 'slider-vertical',
            appearance: 'slider-vertical',
            height: 80,
            width: 20,
            accentColor: color,
          }}
        />
      </div>
      <div className="text-[9px] font-mono" style={{ color }}>
        {Number(value).toFixed(step < 1 ? 1 : 0)}{unit}
      </div>
    </div>
  );
}

// ─── Deck Component ────────────────────────────────────────────────────────────
function Deck({ side, allTracks, onGenerate, isGenerating }) {
  const {
    deckState, eq, loadTrack, togglePlay, seek,
    setEQBand, setDeckVolume, setPitch, syncBPM,
  } = useMixer();

  const ds = deckState[side];
  const eqs = eq[side];
  const isLeft = side === 'A';
  const accentColor = isLeft ? '#C8FF00' : '#00d2ff';
  const [showPicker, setShowPicker] = useState(false);

  const progress = ds.duration > 0 ? ds.currentTime / ds.duration : 0;

  return (
    <div className="flex flex-col gap-3 min-w-0">

      {/* ── Track header ── */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono flex-shrink-0"
          style={{ background: accentColor, color: '#000' }}
        >
          {side}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate leading-tight text-white">
            {ds.track?.title || 'No track loaded'}
          </p>
          <p className="text-[10px] text-white/35 font-mono truncate">
            {ds.track?.artist || ds.track?.genre || '—'} · {formatTime(ds.duration)}
          </p>
        </div>
        <button
          onClick={() => setShowPicker(v => !v)}
          className="flex-shrink-0 text-white/30 hover:text-white transition-colors"
          title="Load track"
        >
          <Music2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── Track picker ── */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl border border-white/10 p-2 max-h-40 overflow-y-auto space-y-0.5"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {allTracks.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-white/30 text-xs mb-2">No tracks yet</p>
                  <button
                    onClick={() => { onGenerate(); setShowPicker(false); }}
                    disabled={isGenerating}
                    className="px-3 py-1 rounded-full text-xs font-mono font-bold"
                    style={{ background: accentColor, color: '#000' }}
                  >
                    {isGenerating ? 'Generating…' : '+ Generate'}
                  </button>
                </div>
              )}
              {allTracks.map(t => (
                <button
                  key={t.id}
                  onClick={() => { loadTrack(side, t); setShowPicker(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors"
                >
                  <span className="text-white truncate block">{t.title}</span>
                  <span className="text-white/35 font-mono">{t.bpm || '?'} BPM · {t.genre}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Platter + faders row ── */}
      <div className="flex items-center justify-between gap-2">
        {/* Deck B: faders on left */}
        {!isLeft && (
          <div className="flex gap-2">
            <VertFader
              label="VOL" value={ds.volume}
              onChange={v => setDeckVolume(side, v)}
              color={accentColor}
            />
            <VertFader
              label="PITCH" value={ds.pitch} min={-8} max={8} step={0.1}
              onChange={v => setPitch(side, v)}
              color={accentColor} unit="st"
            />
          </div>
        )}

        {/* Platter */}
        <div className="flex-1 flex justify-center relative">
          <div style={{ filter: `drop-shadow(0 0 24px ${accentColor}33)` }}>
            <Platter
              isPlaying={ds.playing}
              coverUrl={ds.track?.cover_art_url}
              size={180}
              bpm={ds.bpm}
              accentColor={accentColor}
            />
          </div>
          {/* Play overlay */}
          <button
            onClick={() => ds.track && togglePlay(side)}
            disabled={!ds.track || ds.loading}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
              {ds.loading
                ? <Loader2 className="w-6 h-6 animate-spin text-white" />
                : ds.playing
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play className="w-6 h-6 text-white ml-1" />
              }
            </div>
          </button>
        </div>

        {/* Deck A: faders on right */}
        {isLeft && (
          <div className="flex gap-2">
            <VertFader
              label="PITCH" value={ds.pitch} min={-8} max={8} step={0.1}
              onChange={v => setPitch(side, v)}
              color={accentColor} unit="st"
            />
            <VertFader
              label="VOL" value={ds.volume}
              onChange={v => setDeckVolume(side, v)}
              color={accentColor}
            />
          </div>
        )}
      </div>

      {/* ── BPM row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDeckVolume(side, Math.max(0, ds.volume - 5))}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-white/15 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <Minus className="w-3 h-3 text-white/60" />
          </button>
          <div className="text-center w-14">
            <div className="text-lg font-black font-mono leading-none" style={{ color: accentColor }}>
              {ds.bpm}
            </div>
            <div className="text-[8px] text-white/30 font-mono">BPM</div>
          </div>
          <button
            onClick={() => setDeckVolume(side, Math.min(100, ds.volume + 5))}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-white/15 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <Plus className="w-3 h-3 text-white/60" />
          </button>
        </div>
        <button
          onClick={() => syncBPM(side === 'A' ? 'B' : 'A')}
          className="px-3 py-1 rounded-full text-[10px] font-black font-mono uppercase tracking-wider transition-all active:scale-95"
          style={{ background: accentColor, color: '#000', boxShadow: `0 0 10px ${accentColor}55` }}
        >
          SYNC
        </button>
      </div>

      {/* ── Waveform ── */}
      <div
        className="rounded-xl overflow-hidden border border-white/8"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        <div className="p-1.5">
          <WaveStrip
            isPlaying={ds.playing}
            progress={progress}
            color={accentColor}
            onSeek={(t) => seek(side, t)}
            duration={ds.duration}
          />
        </div>
        <div className="flex justify-between px-2 pb-1">
          <span className="text-[9px] font-mono text-white/25">{formatTime(ds.currentTime)}</span>
          <span className="text-[9px] font-mono text-white/25">
            -{formatTime(Math.max(0, ds.duration - ds.currentTime))}
          </span>
        </div>
      </div>

      {/* ── Transport ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onClick={() => ds.track && seek(side, Math.max(0, ds.currentTime - 10))}
        >
          <SkipBack className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={() => ds.track && togglePlay(side)}
          disabled={!ds.track || ds.loading}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          style={{ background: accentColor, boxShadow: ds.playing ? `0 0 20px ${accentColor}88` : `0 0 10px ${accentColor}44` }}
        >
          {ds.loading
            ? <Loader2 className="w-5 h-5 animate-spin text-black" />
            : ds.playing
              ? <Pause className="w-5 h-5 text-black" />
              : <Play className="w-5 h-5 text-black ml-0.5" />
          }
        </button>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onClick={() => ds.track && seek(side, Math.min(ds.duration, ds.currentTime + 10))}
        >
          <SkipForward className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* ── 3-Band EQ ── */}
      <div className="flex justify-around px-1">
        <EQKnob label="HI"  value={eqs.hi}  onChange={v => setEQBand(side, 'hi', v)}  color={accentColor} />
        <EQKnob label="MID" value={eqs.mid} onChange={v => setEQBand(side, 'mid', v)} color={accentColor} />
        <EQKnob label="LOW" value={eqs.low} onChange={v => setEQBand(side, 'low', v)} color={accentColor} />
      </div>

      {/* ── Loop controls ── */}
      <LoopControls side={side} accentColor={accentColor} />

      {/* ── Hot cues ── */}
      <HotCues side={side} />

      {/* ── FX pads ── */}
      <FXPads side={side} />
    </div>
  );
}

// ─── VU Meter ──────────────────────────────────────────────────────────────────
function VUMeter({ isActive }) {
  const [levels, setLevels] = useState([0.3, 0.5, 0.4, 0.6, 0.5, 0.4, 0.5, 0.3]);
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setLevels(prev => prev.map(v =>
        clamp(v + (Math.random() - 0.5) * 0.3, 0.1, 1)
      ));
    }, 100);
    return () => clearInterval(id);
  }, [isActive]);

  return (
    <div className="flex gap-0.5 items-end h-10">
      {levels.map((l, i) => (
        <div key={i} className="w-1.5 rounded-sm overflow-hidden" style={{ height: 40, background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="w-full rounded-sm transition-all duration-100"
            style={{
              height: `${l * 100}%`,
              marginTop: `${(1 - l) * 100}%`,
              background: l > 0.85
                ? '#ff4444'
                : l > 0.65
                  ? '#ffcc00'
                  : '#C8FF00',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Center Mixer Column ───────────────────────────────────────────────────────
function MixerCenter() {
  const {
    deckState, crossfader, masterVolume,
    setCrossfader, setMasterVolume,
    isRecording, startRecording, stopRecording,
  } = useMixer();

  const bpmA = deckState.A.bpm || 128;
  const bpmB = deckState.B.bpm || 128;
  const masterBPM = Math.round((bpmA + bpmB) / 2);
  const eitherPlaying = deckState.A.playing || deckState.B.playing;

  return (
    <div className="flex flex-col items-center gap-3 px-1">
      {/* Master BPM */}
      <div className="text-center">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">MASTER</div>
        <div className="text-2xl font-black font-mono text-white leading-none">{masterBPM}</div>
        <div className="text-[9px] font-mono text-white/30">BPM</div>
      </div>

      {/* VU Meter */}
      <VUMeter isActive={eitherPlaying} />

      {/* Master volume */}
      <div className="w-full">
        <div className="flex justify-between mb-0.5">
          <span className="text-[9px] font-mono text-white/30">MASTER VOL</span>
          <span className="text-[9px] font-mono text-[#C8FF00]">{masterVolume}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={masterVolume}
          onChange={e => setMasterVolume(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: '#C8FF00' }}
        />
      </div>

      {/* Crossfader */}
      <div className="w-full">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-black font-mono" style={{ color: '#C8FF00' }}>A</span>
          <span className="text-[9px] font-mono text-white/25">XFADER</span>
          <span className="text-[10px] font-black font-mono" style={{ color: '#00d2ff' }}>B</span>
        </div>
        <div className="relative">
          <input
            type="range" min={0} max={100} value={crossfader}
            onChange={e => setCrossfader(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: '#ffffff' }}
          />
          {/* Center notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-2 bg-white/20 pointer-events-none" style={{ top: -8 }} />
        </div>
      </div>

      {/* Headphone cue */}
      <div className="w-full">
        <div className="flex items-center gap-1 mb-0.5">
          <Headphones className="w-3 h-3 text-white/30" />
          <span className="text-[9px] font-mono text-white/30">CUE MIX</span>
        </div>
        <input
          type="range" min={0} max={100} defaultValue={50}
          className="w-full cursor-pointer"
          style={{ accentColor: '#C8FF00' }}
        />
      </div>

      {/* Record button */}
      <button
        onClick={() => isRecording ? stopRecording() : startRecording()}
        className="w-full py-1.5 rounded-full text-[10px] font-black font-mono uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
        style={{
          background: isRecording ? '#ff3b3b' : 'rgba(255,255,255,0.08)',
          color: isRecording ? '#fff' : 'rgba(255,255,255,0.5)',
          border: `1px solid ${isRecording ? '#ff3b3b' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isRecording ? '0 0 16px #ff3b3b66' : 'none',
        }}
      >
        {isRecording
          ? <><Square className="w-3 h-3" /> STOP REC</>
          : <><Circle className="w-3 h-3" /> RECORD</>
        }
      </button>
    </div>
  );
}

// ─── Main DJMixer ──────────────────────────────────────────────────────────────
export default function DJMixer({ tracks = [], onGenerate, isGenerating }) {
  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0c0c0c 0%, #000 100%)',
        boxShadow: '0 0 80px rgba(200,255,0,0.04), 0 0 80px rgba(0,210,255,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-2.5 border-b border-white/8"
        style={{ background: 'linear-gradient(90deg, rgba(200,255,0,0.06) 0%, transparent 50%, rgba(0,210,255,0.06) 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-[#C8FF00]" />
          <span className="text-xs font-black font-mono uppercase tracking-widest text-white/60">
            AuraDJ Mixer Pro
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#C8FF00] animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/25">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onGenerate?.()}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono transition-all active:scale-95 disabled:opacity-50"
            style={{ background: '#C8FF00', color: '#000' }}
          >
            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Generate
          </button>
        </div>
      </div>

      {/* 3-column mixer */}
      <div className="grid grid-cols-[1fr_130px_1fr] gap-4 p-4 lg:p-5">
        <Deck side="A" allTracks={tracks} onGenerate={onGenerate} isGenerating={isGenerating} />
        <MixerCenter />
        <Deck side="B" allTracks={tracks} onGenerate={onGenerate} isGenerating={isGenerating} />
      </div>
    </div>
  );
}
