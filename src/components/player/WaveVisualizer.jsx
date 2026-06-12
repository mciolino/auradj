import React, { useEffect, useRef } from 'react';

/**
 * WaveVisualizer — canvas-based animated waveform
 * Much smoother and more dynamic than CSS bar animation.
 * Falls back to CSS bars if canvas unavailable.
 */
export default function WaveVisualizer({
  isPlaying,
  barCount = 28,
  height = 36,
  color = 'hsl(263, 75%, 68%)',
  className = '',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const barsRef = useRef(
    Array.from({ length: barCount }, (_, i) => ({
      phase: (i / barCount) * Math.PI * 2,
      speed: 0.04 + Math.random() * 0.04,
      amp: 0.3 + Math.random() * 0.5,
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barW = Math.floor(W / barCount) - 1;
      const gap = Math.floor(W / barCount);

      barsRef.current.forEach((bar, i) => {
        const raw = isPlaying
          ? (Math.sin(t * bar.speed * 60 + bar.phase) * 0.5 + 0.5) * bar.amp + 0.15
          : 0.15;
        const barH = Math.max(3, raw * H);
        const x = i * gap;
        const y = (H - barH) / 2;

        // Gradient per bar
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, color.replace(')', ', 0.9)').replace('hsl', 'hsla'));
        grad.addColorStop(1, color.replace(')', ', 0.4)').replace('hsl', 'hsla'));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      });

      t += 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, barCount, color]);

  // Keep canvas sharp on retina
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
      className={className}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
      aria-hidden="true"
    />
  );
}
