import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wand2, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

// ── Preset configurations ──────────────────────────────────────────────────────
const GENRE_PRESETS = [
  { label: 'Tech House',   prompt: 'driving tech house, punchy kick, acid bass line, hypnotic groove',           bpm: 128, color: '#C8FF00' },
  { label: 'Afro House',   prompt: 'afro house, warm percussion, organic rhythms, tribal elements, deep bass',   bpm: 122, color: '#ff9500' },
  { label: 'Melodic Tech', prompt: 'melodic techno, euphoric synths, driving bassline, emotional atmosphere',     bpm: 132, color: '#a855f7' },
  { label: 'Drum & Bass',  prompt: 'liquid drum and bass, rolling breaks, lush pads, soulful vibe',              bpm: 174, color: '#00d2ff' },
  { label: 'Synthwave',    prompt: 'retro synthwave, 80s aesthetic, analog synths, neon atmosphere, arpeggios',  bpm: 118, color: '#ff2d78' },
  { label: 'Ambient',      prompt: 'ambient electronic, atmospheric textures, evolving pads, cinematic depth',    bpm: 90,  color: '#88ffcc' },
  { label: 'Techno',       prompt: 'industrial techno, heavy kick, dark atmosphere, relentless groove',          bpm: 138, color: '#ff3b3b' },
  { label: 'Chill Hop',    prompt: 'lo-fi chill hop, jazzy chords, dusty samples, laid back drums',              bpm: 85,  color: '#ffcc00' },
];

const MOOD_TAGS = ['Dark', 'Euphoric', 'Hypnotic', 'Aggressive', 'Dreamy', 'Uplifting', 'Melancholic', 'Tribal', 'Futuristic', 'Raw'];
const BPM_PRESETS = [85, 95, 110, 120, 124, 128, 132, 138, 145, 174];

// Source badge
function SourceBadge({ source }) {
  if (!source) return null;
  const config = {
    suno:        { label: '✨ Suno AI',       bg: '#C8FF00', color: '#000' },
    huggingface: { label: '🤗 MusicGen',      bg: '#ff9500', color: '#000' },
    demo:        { label: '📀 Demo Track',    bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' },
  };
  const c = config[source] || config.demo;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
      style={{ background: c.bg, color: c.color }}>{c.label}</span>
  );
}

export default function GenerateModal({ isOpen, onClose, onGenerated }) {
  const [selectedGenre, setSelectedGenre]   = useState(null);
  const [selectedMoods, setSelectedMoods]   = useState([]);
  const [customPrompt,  setCustomPrompt]    = useState('');
  const [bpm,           setBpm]             = useState(128);
  const [instrumental,  setInstrumental]    = useState(true);
  const [generating,    setGenerating]      = useState(false);
  const [result,        setResult]          = useState(null); // { success, title, source, audio_url }
  const [error,         setError]           = useState(null);

  const toggleMood = (mood) => setSelectedMoods(prev =>
    prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
  );

  const buildPrompt = () => {
    const parts = [];
    if (selectedGenre) parts.push(selectedGenre.prompt);
    if (selectedMoods.length) parts.push(selectedMoods.join(', ').toLowerCase());
    if (customPrompt.trim()) parts.push(customPrompt.trim());
    return parts.join(', ') || 'electronic music, deep groove';
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    setError(null);

    const prompt = buildPrompt();
    const genre  = selectedGenre?.label || 'Electronic';

    try {
      const res = await fetch('/api/functions/generateMusic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre, bpm, instrumental, title: '' }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Generation failed — try again');
        setGenerating(false);
        return;
      }

      setResult(data);
      setGenerating(false);

      // Pass the new track back up
      onGenerated?.({
        id: `gen-${Date.now()}`,
        title: data.title || prompt.slice(0, 40),
        genre: data.genre || genre,
        bpm: data.bpm || bpm,
        audio_url: data.audio_url,
        source: data.source,
        generated: data.generated,
        created_at: new Date().toISOString(),
      });

    } catch (err) {
      setError(err.message || 'Network error');
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #111 0%, #080808 100%)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8"
            style={{ background: 'linear-gradient(90deg, rgba(200,255,0,0.07) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#C8FF00' }}>
                <Wand2 className="w-4 h-4 text-black" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">AI Track Generator</h2>
                <p className="text-[10px] text-white/35 font-mono">Powered by Suno AI</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

            {/* Result state */}
            {result && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                className="rounded-xl p-4 border border-[#C8FF00]/30"
                style={{ background: 'rgba(200,255,0,0.06)' }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#C8FF00] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{result.title}</span>
                      <SourceBadge source={result.source} />
                    </div>
                    <p className="text-[11px] text-white/45 font-mono mt-0.5">
                      {result.genre} · {result.bpm} BPM · Track generated and added to deck picker
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleReset}
                    className="flex-1 py-2 rounded-xl text-xs font-bold font-mono border border-white/10 hover:bg-white/5 transition-colors text-white/60">
                    Generate Another
                  </button>
                  <button onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-xs font-black font-mono transition-colors"
                    style={{ background: '#C8FF00', color: '#000' }}>
                    Load to Deck →
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl p-3 border border-red-500/30 flex items-center gap-2"
                style={{ background: 'rgba(255,59,59,0.08)' }}>
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-mono">{error}</span>
              </div>
            )}

            {!result && (
              <>
                {/* Genre presets */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2">Genre</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {GENRE_PRESETS.map(g => (
                      <button key={g.label} onClick={() => { setSelectedGenre(g); setBpm(g.bpm); }}
                        className="py-1.5 px-1 rounded-[6px] text-[10px] font-mono font-bold text-center transition-all active:scale-95"
                        style={{
                          background: selectedGenre?.label === g.label ? g.color : 'rgba(255,255,255,0.06)',
                          color: selectedGenre?.label === g.label ? '#000' : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${selectedGenre?.label === g.label ? g.color : 'rgba(255,255,255,0.08)'}`,
                          boxShadow: selectedGenre?.label === g.label ? `0 0 12px ${g.color}55` : 'none',
                        }}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood tags */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2">Mood</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MOOD_TAGS.map(m => {
                      const on = selectedMoods.includes(m);
                      return (
                        <button key={m} onClick={() => toggleMood(m)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-mono transition-all active:scale-95"
                          style={{
                            background: on ? 'rgba(200,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                            color: on ? '#C8FF00' : 'rgba(255,255,255,0.4)',
                            border: `1px solid ${on ? '#C8FF0044' : 'rgba(255,255,255,0.07)'}`,
                          }}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BPM */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-white/35">BPM</label>
                    <span className="text-sm font-black font-mono text-[#C8FF00]">{bpm}</span>
                  </div>
                  <input type="range" min={70} max={180} value={bpm} onChange={e => setBpm(Number(e.target.value))}
                    className="w-full cursor-pointer mb-2" style={{ accentColor: '#C8FF00' }} />
                  <div className="flex gap-1 flex-wrap">
                    {BPM_PRESETS.map(b => (
                      <button key={b} onClick={() => setBpm(b)}
                        className="w-9 py-0.5 rounded-[4px] text-[9px] font-mono transition-all"
                        style={{
                          background: bpm === b ? '#C8FF00' : 'rgba(255,255,255,0.06)',
                          color: bpm === b ? '#000' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${bpm === b ? '#C8FF00' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom prompt */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2">
                    Custom Prompt <span className="text-white/20">(optional)</span>
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder="e.g. with rolling bassline and Detroit influence..."
                    rows={2}
                    className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 font-mono resize-none focus:outline-none transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                {/* Instrumental toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Instrumental</p>
                    <p className="text-[10px] text-white/35 font-mono">No vocals — DJ-ready</p>
                  </div>
                  <button onClick={() => setInstrumental(v => !v)}
                    className="relative w-11 h-6 rounded-full transition-colors"
                    style={{ background: instrumental ? '#C8FF00' : 'rgba(255,255,255,0.12)' }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-black rounded-full transition-all shadow"
                      style={{ left: instrumental ? '22px' : '2px' }} />
                  </button>
                </div>

                {/* Prompt preview */}
                {(selectedGenre || selectedMoods.length || customPrompt) && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">Prompt Preview</p>
                    <p className="text-[11px] text-white/60 font-mono leading-relaxed">{buildPrompt()}, {bpm} BPM</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer CTA */}
          {!result && (
            <div className="px-5 py-4 border-t border-white/8">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-3 rounded-xl font-black text-sm font-mono uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: generating ? 'rgba(200,255,0,0.4)' : '#C8FF00', color: '#000', boxShadow: generating ? 'none' : '0 0 24px rgba(200,255,0,0.35)' }}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating with Suno AI…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Generate Track
                  </>
                )}
              </button>
              {generating && (
                <p className="text-center text-[10px] text-white/30 font-mono mt-2">
                  Suno takes ~30–60s · HuggingFace fallback if needed
                </p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
