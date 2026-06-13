import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMixer } from '@/context/MixerContext';
import { toast } from 'sonner';
import {
  Play, Pause, SkipForward, SkipBack, Loader2,
  Plus, Minus, Music2, Wand2, Volume2,
  Headphones, Disc3, Circle, Square,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (s) => (!s || isNaN(s)) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// ─── Spinning Vinyl Platter (audio-reactive glow on beat) ─────────────────────
function Platter({ side, size = 182, accentColor }) {
  const { deckState, getAnalysis } = useMixer();
  const ds = deckState[side];
  const canvasRef = useRef(null);
  const degRef    = useRef(0);
  const rafRef    = useRef(null);
  const imgRef    = useRef(null);
  const glowRef   = useRef(0);

  useEffect(() => {
    const url = ds.track?.cover_art_url;
    if (url) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { imgRef.current = img; };
      img.src = url;
    } else { imgRef.current = null; }
  }, [ds.track?.cover_art_url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = size/2, cy = size/2, r = size/2 - 3;
    const rpm = Math.min((ds.bpm || 128) / 2, 45);
    const dpf = (rpm * 360) / (60 * 60);

    const draw = () => {
      // Audio-reactive data
      const analysis = getAnalysis(side);
      const bass = analysis.bass || 0;
      const isBeat = analysis.isBeat;

      // Glow pulse on beat
      if (isBeat) glowRef.current = 1.0;
      glowRef.current *= 0.88;

      if (ds.playing) degRef.current = (degRef.current + dpf) % 360;
      ctx.clearRect(0, 0, size, size);

      // Beat glow ring (outer)
      if (glowRef.current > 0.02) {
        const glowAlpha = glowRef.current * 0.7;
        ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI*2);
        ctx.strokeStyle = accentColor + Math.round(glowAlpha * 255).toString(16).padStart(2,'0');
        ctx.lineWidth = 6; ctx.stroke();
      }

      // Vinyl body
      const vg = ctx.createRadialGradient(cx, cy, r*0.5, cx, cy, r);
      vg.addColorStop(0, '#161616'); vg.addColorStop(0.55, '#0d0d0d'); vg.addColorStop(1, '#1c1c1c');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = vg; ctx.fill();

      // Groove rings
      for (let i = r*0.42; i < r-1; i += 3.2) {
        ctx.beginPath(); ctx.arc(cx, cy, i, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.032)'; ctx.lineWidth = 1.1; ctx.stroke();
      }

      // Bass-reactive groove highlight
      if (bass > 0.3) {
        const bAlpha = (bass - 0.3) * 0.25;
        ctx.beginPath(); ctx.arc(cx, cy, r*0.72, 0, Math.PI*2);
        ctx.strokeStyle = accentColor + Math.round(bAlpha * 255).toString(16).padStart(2,'0');
        ctx.lineWidth = 2; ctx.stroke();
      }

      // Rotating label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((degRef.current * Math.PI) / 180);
      const lr = r * 0.36;
      ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI*2);
      if (imgRef.current) {
        ctx.save(); ctx.clip();
        ctx.drawImage(imgRef.current, -lr, -lr, lr*2, lr*2);
        ctx.restore();
      } else {
        const lg = ctx.createRadialGradient(0, -lr*0.2, 0, 0, 0, lr);
        lg.addColorStop(0, accentColor); lg.addColorStop(0.55, accentColor+'cc'); lg.addColorStop(1, '#1a1a00');
        ctx.fillStyle = lg; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `bold ${Math.round(lr*0.22)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('AURA', 0, -3);
        ctx.font = `${Math.round(lr*0.15)}px monospace`; ctx.fillText('DJ', 0, lr*0.28);
      }
      // Spindle
      ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill();
      ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fillStyle='#2a2a2a'; ctx.fill();
      ctx.restore();

      // Chrome ring
      const rg = ctx.createLinearGradient(cx-r, cy-r, cx+r, cy+r);
      rg.addColorStop(0,'rgba(255,255,255,0.22)'); rg.addColorStop(0.5,'rgba(255,255,255,0.04)'); rg.addColorStop(1,'rgba(255,255,255,0.14)');
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle=rg; ctx.lineWidth=2.5; ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ds.playing, ds.bpm, accentColor, side]);

  return (
    <canvas ref={canvasRef}
      style={{ width:size, height:size, borderRadius:'50%', display:'block', cursor:'pointer' }} />
  );
}

// ─── Live FFT Spectrum (center column) ────────────────────────────────────────
function SpectrumDisplay({ side, color }) {
  const { getAnalysis } = useMixer();
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = (rect.width  || 120) * dpr;
    canvas.height = (rect.height || 40)  * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width || 120, H = rect.height || 40;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const a = getAnalysis(side);
      const fft = a.fftRaw;

      if (fft && fft.length > 0) {
        // Draw 48 bars from FFT data (skip very low + very high bins)
        const BARS = 48;
        const startBin = 2, endBin = Math.floor(fft.length * 0.75);
        const step = (endBin - startBin) / BARS;
        const bw = W / BARS - 0.5;

        for (let i = 0; i < BARS; i++) {
          const binIdx = Math.floor(startBin + i * step);
          const db  = fft[binIdx] ?? -100;
          const lvl = Math.max(0, Math.min(1, (db + 90) / 90));
          const bh  = Math.max(2, lvl * H * 0.92);
          const x   = i * (W / BARS);
          const y   = H - bh;

          const g = ctx.createLinearGradient(x, y, x, y + bh);
          g.addColorStop(0, color);
          g.addColorStop(1, color + '33');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 1); ctx.fill();
        }
      } else {
        // Idle placeholder bars
        for (let i = 0; i < 48; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.beginPath(); ctx.roundRect(i * (W/48), H - 4, W/48 - 0.5, 4, 1); ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [side, color]);

  return <canvas ref={canvasRef} style={{ width:'100%', height:40, display:'block' }} />;
}

// ─── Real FFT VU Meter ─────────────────────────────────────────────────────────
function VUMeter({ side, label, color }) {
  const { getAnalysis, deckState } = useMixer();
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const peakRef   = useRef(0);
  const peakHoldRef = useRef({ level: 0, frames: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = 14 * dpr;
    canvas.height = 80 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, 14, 80);
      const a = getAnalysis(side);
      const level = a.overall || 0;

      // Peak hold
      if (level > peakHoldRef.current.level) {
        peakHoldRef.current = { level, frames: 45 };
      } else if (peakHoldRef.current.frames > 0) {
        peakHoldRef.current.frames--;
      } else {
        peakHoldRef.current.level *= 0.97;
      }

      // Draw 16 segments
      const SEGS = 16;
      const segH = 80 / SEGS - 1;
      for (let i = 0; i < SEGS; i++) {
        const segLevel = 1 - i / SEGS;
        const active = level >= segLevel - (1/SEGS);
        const isRed    = i < 2;
        const isYellow = i < 5;
        const baseColor = isRed ? '#ff3b3b' : isYellow ? '#ffcc00' : color;
        ctx.fillStyle = active ? baseColor : baseColor + '22';
        ctx.beginPath();
        ctx.roundRect(1, i * (segH + 1), 12, segH, 1.5);
        ctx.fill();
      }

      // Peak hold bar
      const ph = peakHoldRef.current.level;
      if (ph > 0.05) {
        const py = Math.max(0, (1 - ph) * 80 - 3);
        const isRed = ph > 0.88; const isYellow = ph > 0.65;
        ctx.fillStyle = isRed ? '#ff3b3b' : isYellow ? '#ffcc00' : color;
        ctx.fillRect(1, py, 12, 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [side, color]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={canvasRef} style={{ width:14, height:80, display:'block' }} />
      <span className="text-[8px] font-mono" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Rotary EQ Knob ────────────────────────────────────────────────────────────
function EQKnob({ label, value, onChange, color }) {
  const drag = useRef({ active:false, startY:0, startVal:0 });
  const onDown = (e) => {
    e.preventDefault();
    drag.current = { active:true, startY:e.clientY, startVal:value };
    const move = (ev) => { if (!drag.current.active) return; onChange(clamp(drag.current.startVal + (drag.current.startY - ev.clientY) * 0.9, 0, 100)); };
    const up   = ()   => { drag.current.active = false; window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
  };
  const R = 16, CIRC = 2*Math.PI*R;
  const travel = (value/100) * (270/360) * CIRC;
  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div className="relative w-10 h-10 rounded-full cursor-ns-resize"
        style={{ background:'radial-gradient(circle at 35% 30%, #2c2c2c, #0e0e0e)' }}
        onMouseDown={onDown}
        onTouchStart={e => { drag.current = { active:true, startY:e.touches[0].clientY, startVal:value }; }}
        onTouchMove={e  => onChange(clamp(drag.current.startVal + (drag.current.startY - e.touches[0].clientY)*0.9, 0, 100))}
        onDoubleClick={() => onChange(50)}
      >
        <svg className="absolute inset-0" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"
            strokeDasharray={`${(270/360)*CIRC} ${CIRC-(270/360)*CIRC}`} strokeLinecap="round" transform="rotate(135 20 20)" />
          <circle cx="20" cy="20" r={R} fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${travel} ${CIRC-travel}`} strokeLinecap="round" transform="rotate(135 20 20)"
            style={{ filter:`drop-shadow(0 0 3px ${color}88)`, transition:'stroke-dasharray 0.05s' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background:color, boxShadow:`0 0 5px ${color}`,
            transform:`rotate(${(value/100)*270-135}deg) translateY(-11px)`,
            transformOrigin:'50% 50%',
          }} />
        </div>
      </div>
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Waveform Strip ────────────────────────────────────────────────────────────
function WaveStrip({ side, accentColor }) {
  const { deckState, getAnalysis, seek } = useMixer();
  const ds = deckState[side];
  const canvasRef = useRef(null);
  const barsRef   = useRef(Array.from({length:90},()=>({ h: 0.08+Math.random()*0.92, phase:Math.random()*Math.PI*2, speed:0.01+Math.random()*0.015 })));
  const tRef      = useRef(0);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = (rect.width  || 300) * dpr;
    canvas.height = (rect.height || 48)  * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width || 300, H = rect.height || 48;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const progress = ds.duration > 0 ? ds.currentTime / ds.duration : 0;
      const progX = progress * W;
      const analysis = getAnalysis(side);
      const energy = analysis.overall || 0;
      const n = barsRef.current.length;
      const bw = W/n - 0.4;

      barsRef.current.forEach((bar, i) => {
        const x = (i/n)*W;
        const anim = ds.playing ? Math.sin(tRef.current * bar.speed * 60 + bar.phase) * 0.1 * energy : 0;
        const bh = Math.max(2, (bar.h + anim) * H * 0.88);
        const y  = (H-bh)/2;
        const played = x < progX;
        const g = ctx.createLinearGradient(x,y,x,y+bh);
        if (played) { g.addColorStop(0, accentColor); g.addColorStop(1, accentColor+'44'); }
        else        { g.addColorStop(0,'rgba(255,255,255,0.18)'); g.addColorStop(1,'rgba(255,255,255,0.04)'); }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(x,y,bw,bh,1); ctx.fill();
      });

      // Playhead
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(progX-1, 0, 2, H);
      ctx.fillStyle = accentColor+'55';
      ctx.fillRect(progX-2.5, 0, 5, H);

      tRef.current++;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ds.playing, ds.currentTime, ds.duration, accentColor, side]);

  return (
    <canvas ref={canvasRef} className="w-full" style={{ height:48, display:'block', cursor: ds.duration?'pointer':'default' }}
      onClick={e => {
        if (!ds.duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        seek(side, ((e.clientX-r.left)/r.width) * ds.duration);
      }} />
  );
}

// ─── Hot Cues ──────────────────────────────────────────────────────────────────
const CUE_COLORS = ['#ff3b3b','#ff9500','#C8FF00','#00d2ff','#a855f7','#ff2d78','#ffffff','#888'];
function HotCues({ side }) {
  const { deckState, setCue, jumpToCue, clearCue } = useMixer();
  const cues = deckState[side].cues;
  return (
    <div className="grid grid-cols-8 gap-1">
      {CUE_COLORS.map((color,i) => {
        const set = cues[i] !== undefined;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <button
              className="w-full h-7 rounded-[4px] text-[10px] font-black transition-all active:scale-95"
              style={{ background: set ? color : 'rgba(255,255,255,0.07)', color: set ? '#000' : color,
                border:`1px solid ${color}55`, boxShadow: set ? `0 0 10px ${color}77` : 'none' }}
              onClick={() => set ? jumpToCue(side,i) : setCue(side,i)}
              onContextMenu={e => { e.preventDefault(); clearCue(side,i); }}
            >{set ? '▶' : '+'}</button>
            <span className="text-[8px] font-mono" style={{ color }}>C{i+1}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── FX Pads ──────────────────────────────────────────────────────────────────
const FX_LIST = ['Reverb','Echo','Chorus','Filter','Phaser','Crush'];
function FXPads({ side }) {
  const { activeFx, toggleFx } = useMixer();
  const active = activeFx[side] || [];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {FX_LIST.map(fx => {
        const on = active.includes(fx);
        return (
          <button key={fx} onClick={() => toggleFx(side,fx)}
            className="py-1.5 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wide transition-all active:scale-95"
            style={{ background: on ? '#C8FF00':'rgba(255,255,255,0.06)', color: on ? '#000':'rgba(255,255,255,0.45)',
              border:`1px solid ${on ? '#C8FF00':'rgba(255,255,255,0.1)'}`, boxShadow: on ? '0 0 14px #C8FF0055':'none' }}
          >{fx}</button>
        );
      })}
    </div>
  );
}

// ─── Loop Controls ─────────────────────────────────────────────────────────────
const LOOP_SIZES = [0.25,0.5,1,2,4,8,16,32];
function LoopControls({ side, accent }) {
  const { deckState, toggleLoop, setLoopSize } = useMixer();
  const { loopActive, loopSize } = deckState[side];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button onClick={() => toggleLoop(side)}
        className="px-2.5 py-1 rounded-[4px] text-[10px] font-black font-mono uppercase tracking-wider transition-all"
        style={{ background: loopActive ? accent:'rgba(255,255,255,0.08)', color: loopActive ? '#000':'rgba(255,255,255,0.5)',
          border:`1px solid ${loopActive ? accent:'rgba(255,255,255,0.12)'}`, boxShadow: loopActive ? `0 0 12px ${accent}66`:'none' }}
      >LOOP</button>
      <div className="flex gap-0.5 flex-wrap">
        {LOOP_SIZES.map(s => (
          <button key={s} onClick={() => setLoopSize(side,s)}
            className="w-7 py-0.5 rounded-[3px] text-[9px] font-mono transition-all"
            style={{ background: loopSize===s ? accent:'rgba(255,255,255,0.07)', color: loopSize===s ? '#000':'rgba(255,255,255,0.4)',
              border:`1px solid ${loopSize===s ? accent:'rgba(255,255,255,0.08)'}` }}
          >{s<1 ? `1/${1/s}` : s}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Vertical Fader ────────────────────────────────────────────────────────────
function VertFader({ value, onChange, color, label, min=0, max=100, step=1, unit='' }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="text-[9px] font-mono text-white/25">{label}</div>
      <div className="relative flex items-center justify-center" style={{ height:80 }}>
        <div className="absolute w-1 rounded-full" style={{ height:76, background:'rgba(255,255,255,0.07)', top:2 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="cursor-pointer"
          style={{ writingMode:'vertical-lr', direction:'rtl', WebkitAppearance:'slider-vertical', appearance:'slider-vertical', height:80, width:20, accentColor:color }} />
      </div>
      <div className="text-[9px] font-mono" style={{ color }}>{Number(value).toFixed(step<1?1:0)}{unit}</div>
    </div>
  );
}

// ─── Deck ──────────────────────────────────────────────────────────────────────
function Deck({ side, allTracks, onGenerate, isGenerating }) {
  const { deckState, eq, loadTrack, togglePlay, setEQBand, setDeckVolume, setPitch, syncBPM } = useMixer();
  const ds = deckState[side]; const eqs = eq[side];
  const isLeft = side === 'A';
  const accent = isLeft ? '#C8FF00' : '#00d2ff';
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Track header */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono flex-shrink-0"
          style={{ background:accent, color:'#000' }}>{side}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate leading-tight text-white">{ds.track?.title || 'No track loaded'}</p>
          <p className="text-[10px] text-white/35 font-mono truncate">{ds.track?.genre || '—'} · {fmt(ds.duration)}</p>
        </div>
        <button onClick={() => setShowPicker(v=>!v)} className="flex-shrink-0 text-white/30 hover:text-white transition-colors" title="Load track">
          <Music2 className="w-4 h-4" />
        </button>
      </div>

      {/* Track picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
            <div className="rounded-xl border border-white/10 p-2 max-h-40 overflow-y-auto space-y-0.5" style={{ background:'rgba(255,255,255,0.04)' }}>
              {allTracks.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-white/30 text-xs mb-2">No tracks yet</p>
                  <button onClick={() => { onGenerate(); setShowPicker(false); }} disabled={isGenerating}
                    className="px-3 py-1 rounded-full text-xs font-mono font-bold" style={{ background:accent, color:'#000' }}>
                    {isGenerating ? 'Generating…' : '+ Generate'}
                  </button>
                </div>
              ) : allTracks.map(t => (
                <button key={t.id} onClick={() => { loadTrack(side,t); setShowPicker(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors">
                  <span className="text-white truncate block">{t.title}</span>
                  <span className="text-white/35 font-mono">{t.bpm||'?'} BPM · {t.genre}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platter + faders */}
      <div className="flex items-center justify-between gap-2">
        {!isLeft && (
          <div className="flex gap-2">
            <VertFader label="VOL"   value={ds.volume} onChange={v => setDeckVolume(side,v)} color={accent} />
            <VertFader label="PITCH" value={ds.pitch}  onChange={v => setPitch(side,v)} color={accent} min={-8} max={8} step={0.1} unit="st" />
          </div>
        )}
        <div className="flex-1 flex justify-center relative">
          <div style={{ filter:`drop-shadow(0 0 24px ${accent}30)` }}>
            <Platter side={side} size={178} accentColor={accent} />
          </div>
          <button onClick={() => ds.track && togglePlay(side)} disabled={!ds.track||ds.loading}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)' }}>
              {ds.loading ? <Loader2 className="w-6 h-6 animate-spin text-white" />
                : ds.playing ? <Pause className="w-6 h-6 text-white" />
                : <Play className="w-6 h-6 text-white ml-1" />}
            </div>
          </button>
        </div>
        {isLeft && (
          <div className="flex gap-2">
            <VertFader label="PITCH" value={ds.pitch}  onChange={v => setPitch(side,v)} color={accent} min={-8} max={8} step={0.1} unit="st" />
            <VertFader label="VOL"   value={ds.volume} onChange={v => setDeckVolume(side,v)} color={accent} />
          </div>
        )}
      </div>

      {/* BPM + sync */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDeckVolume(side, Math.max(0,ds.volume-5))}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-white/15 transition-colors"
            style={{ background:'rgba(255,255,255,0.08)' }}><Minus className="w-3 h-3 text-white/60" /></button>
          <div className="text-center w-14">
            <div className="text-lg font-black font-mono leading-none" style={{ color:accent }}>{ds.bpm}</div>
            <div className="text-[8px] text-white/30 font-mono">BPM</div>
          </div>
          <button onClick={() => setDeckVolume(side, Math.min(100,ds.volume+5))}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-white/15 transition-colors"
            style={{ background:'rgba(255,255,255,0.08)' }}><Plus className="w-3 h-3 text-white/60" /></button>
        </div>
        <button onClick={() => syncBPM(side === 'A' ? 'B' : 'A')}
          className="px-3 py-1 rounded-full text-[10px] font-black font-mono uppercase tracking-wider transition-all active:scale-95"
          style={{ background:accent, color:'#000', boxShadow:`0 0 10px ${accent}55` }}>SYNC</button>
      </div>

      {/* Waveform */}
      <div className="rounded-xl overflow-hidden border border-white/8" style={{ background:'rgba(0,0,0,0.5)' }}>
        <div className="p-1.5"><WaveStrip side={side} accentColor={accent} /></div>
        <div className="flex justify-between px-2 pb-1">
          <span className="text-[9px] font-mono text-white/25">{fmt(ds.currentTime)}</span>
          <span className="text-[9px] font-mono text-white/25">-{fmt(Math.max(0,ds.duration-ds.currentTime))}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-3">
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          style={{ background:'rgba(255,255,255,0.08)' }}
          onClick={() => ds.track && seek(side, Math.max(0, ds.currentTime-10))}><SkipBack className="w-4 h-4 text-white/70" /></button>
        <button onClick={() => ds.track && togglePlay(side)} disabled={!ds.track||ds.loading}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          style={{ background:accent, boxShadow: ds.playing ? `0 0 22px ${accent}99`:`0 0 10px ${accent}44` }}>
          {ds.loading ? <Loader2 className="w-5 h-5 animate-spin text-black" />
            : ds.playing ? <Pause className="w-5 h-5 text-black" />
            : <Play className="w-5 h-5 text-black ml-0.5" />}
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          style={{ background:'rgba(255,255,255,0.08)' }}
          onClick={() => ds.track && seek(side, Math.min(ds.duration, ds.currentTime+10))}><SkipForward className="w-4 h-4 text-white/70" /></button>
      </div>

      {/* 3-band EQ */}
      <div className="flex justify-around px-1">
        <EQKnob label="HI"  value={eqs.hi}  onChange={v => setEQBand(side,'hi',v)}  color={accent} />
        <EQKnob label="MID" value={eqs.mid} onChange={v => setEQBand(side,'mid',v)} color={accent} />
        <EQKnob label="LOW" value={eqs.low} onChange={v => setEQBand(side,'low',v)} color={accent} />
      </div>

      {/* Loop */}
      <LoopControls side={side} accent={accent} />

      {/* Hot cues */}
      <HotCues side={side} />

      {/* FX pads */}
      <FXPads side={side} />
    </div>
  );
}

// ─── Center Column ─────────────────────────────────────────────────────────────
function MixerCenter({ allTracks }) {
  const { deckState, crossfader, masterVolume, setCrossfader, setMasterVolume, isRecording, startRecording, stopRecording } = useMixer();
  const bpmA = deckState.A.bpm||128, bpmB = deckState.B.bpm||128;
  const eitherPlaying = deckState.A.playing || deckState.B.playing;

  return (
    <div className="flex flex-col items-center gap-3 px-1">
      {/* Master BPM */}
      <div className="text-center">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">MASTER</div>
        <div className="text-2xl font-black font-mono text-white leading-none">{Math.round((bpmA+bpmB)/2)}</div>
        <div className="text-[9px] font-mono text-white/30">BPM</div>
      </div>

      {/* Live FFT spectrums (A top, B bottom) */}
      <div className="w-full space-y-1">
        <div className="rounded-lg overflow-hidden" style={{ background:'rgba(0,0,0,0.4)' }}>
          <SpectrumDisplay side="A" color="#C8FF00" />
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background:'rgba(0,0,0,0.4)' }}>
          <SpectrumDisplay side="B" color="#00d2ff" />
        </div>
      </div>

      {/* VU meters for both decks */}
      <div className="flex items-end gap-2">
        <VUMeter side="A" label="A" color="#C8FF00" />
        <VUMeter side="A" label="A" color="#C8FF00" />
        <div className="w-px h-10 bg-white/10 mx-1" />
        <VUMeter side="B" label="B" color="#00d2ff" />
        <VUMeter side="B" label="B" color="#00d2ff" />
      </div>

      {/* Master vol */}
      <div className="w-full">
        <div className="flex justify-between mb-0.5">
          <span className="text-[9px] font-mono text-white/30">MASTER VOL</span>
          <span className="text-[9px] font-mono text-[#C8FF00]">{masterVolume}%</span>
        </div>
        <input type="range" min={0} max={100} value={masterVolume}
          onChange={e => setMasterVolume(Number(e.target.value))}
          className="w-full cursor-pointer" style={{ accentColor:'#C8FF00' }} />
      </div>

      {/* Crossfader */}
      <div className="w-full">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-black font-mono" style={{ color:'#C8FF00' }}>A</span>
          <span className="text-[9px] font-mono text-white/25">XFADER</span>
          <span className="text-[10px] font-black font-mono" style={{ color:'#00d2ff' }}>B</span>
        </div>
        <div className="relative">
          <input type="range" min={0} max={100} value={crossfader}
            onChange={e => setCrossfader(Number(e.target.value))}
            className="w-full cursor-pointer" style={{ accentColor:'#ffffff' }} />
          <div className="absolute w-px h-2 bg-white/20 pointer-events-none" style={{ top:-8, left:'50%', transform:'translateX(-50%)' }} />
        </div>
      </div>

      {/* Headphone cue */}
      <div className="w-full">
        <div className="flex items-center gap-1 mb-0.5">
          <Headphones className="w-3 h-3 text-white/30" />
          <span className="text-[9px] font-mono text-white/30">CUE MIX</span>
        </div>
        <input type="range" min={0} max={100} defaultValue={50} className="w-full cursor-pointer" style={{ accentColor:'#C8FF00' }} />
      </div>

      {/* Record */}
      <button
        onClick={() => isRecording ? stopRecording() : startRecording()}
        className="w-full py-1.5 rounded-full text-[10px] font-black font-mono uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
        style={{ background: isRecording ? '#ff3b3b':'rgba(255,255,255,0.08)', color: isRecording ? '#fff':'rgba(255,255,255,0.5)',
          border:`1px solid ${isRecording ? '#ff3b3b':'rgba(255,255,255,0.1)'}`, boxShadow: isRecording ? '0 0 16px #ff3b3b66':'none' }}
      >
        {isRecording ? <><Square className="w-3 h-3"/>STOP REC</> : <><Circle className="w-3 h-3"/>RECORD</>}
      </button>

      <div className="text-[8px] font-mono text-white/15 text-center leading-tight">
        {allTracks.length} track{allTracks.length!==1?'s':''} loaded
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function DJMixer({ tracks = [], onGenerate, isGenerating }) {
  const { seek } = useMixer();

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ background:'linear-gradient(180deg, #0c0c0c 0%, #000 100%)', boxShadow:'0 0 80px rgba(200,255,0,0.03), 0 0 80px rgba(0,210,255,0.03)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/8"
        style={{ background:'linear-gradient(90deg, rgba(200,255,0,0.06) 0%, transparent 50%, rgba(0,210,255,0.06) 100%)' }}>
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-[#C8FF00]" />
          <span className="text-xs font-black font-mono uppercase tracking-widest text-white/60">AuraDJ Mixer Pro</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#C8FF00] animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/25">{tracks.length} track{tracks.length!==1?'s':''}</span>
          <button onClick={() => onGenerate?.()} disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono transition-all active:scale-95 disabled:opacity-50"
            style={{ background:'#C8FF00', color:'#000' }}>
            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Generate
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-[1fr_138px_1fr] gap-4 p-4 lg:p-5">
        <Deck side="A" allTracks={tracks} onGenerate={onGenerate} isGenerating={isGenerating} />
        <MixerCenter allTracks={tracks} />
        <Deck side="B" allTracks={tracks} onGenerate={onGenerate} isGenerating={isGenerating} />
      </div>
    </div>
  );
}
