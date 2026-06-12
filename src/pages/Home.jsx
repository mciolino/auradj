import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, Users, ArrowUpRight, Play } from 'lucide-react';
import MixCard from '@/components/common/MixCard';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const TICKER_ITEMS = [
  'AI DJ STUDIO', '·', 'GENERATE MUSIC', '·',
  'DISCOVER MIXES', '·', 'CONNECT SERVICES', '·',
  'AI DJ STUDIO', '·', 'GENERATE MUSIC', '·',
  'DISCOVER MIXES', '·', 'CONNECT SERVICES', '·',
];

export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('trending');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('premium') === 'success') {
      toast.success('Welcome to AuraDJ Premium! 🎉');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    base44.entities.DJSession.filter({ is_public: true, is_saved: true }, '-play_count', 24)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── HERO ── */}
      <section className="relative pt-14 overflow-hidden">
        {/* Full-bleed black with lime accent line */}
        <div className="absolute top-14 left-0 right-0 h-px bg-primary/40" />

        <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 pt-16 pb-0">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs text-primary uppercase tracking-[0.2em]">
              AI-Powered Music Generation
            </span>
          </motion.div>

          {/* Massive headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-heading font-black text-[clamp(3.5rem,10vw,9rem)] leading-[0.9] tracking-[-0.04em] uppercase mb-0"
          >
            <span className="block">YOUR</span>
            <span className="block text-primary">AI DJ</span>
            <span className="block">ALWAYS ON.</span>
          </motion.h1>

          {/* Sub + CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-10 pb-10 border-b border-border"
          >
            <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
              Generate original music, build seamless mixes, and discover sounds you've never heard — all in real time.
            </p>
            <div className="flex items-center gap-3">
              <Link to="/session">
                <button className="btn-sharp-lime flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Session
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </Link>
              <Link to="/discover">
                <button className="btn-sharp">
                  Explore
                </button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ── TICKER TAPE ── */}
        <div className="overflow-hidden border-b border-border bg-primary/5 py-3">
          <div className="marquee-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span
                key={i}
                className={`mx-4 font-mono text-xs uppercase tracking-[0.2em] whitespace-nowrap ${item === '·' ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRENDING MIXES ── */}
      <section className="max-w-screen-2xl mx-auto px-6 sm:px-10 py-14">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8 pb-4 border-b border-border">
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">01 / Discover</p>
            <h2 className="font-heading font-black text-3xl sm:text-4xl uppercase tracking-tight">
              Trending Mixes
            </h2>
          </div>
          <div className="flex items-center gap-px">
            {['Trending', 'Following'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t.toLowerCase())}
                className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all border ${
                  tab === t.toLowerCase()
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-background aspect-square animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="stripe-bg border border-border p-20 text-center">
            <p className="font-heading text-2xl font-black uppercase mb-2">No mixes yet</p>
            <p className="text-muted-foreground text-sm mb-6">Be the first to create and publish one.</p>
            <Link to="/session">
              <button className="btn-sharp-lime">Start Creating</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                className="bg-background"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <MixCard session={session} />
              </motion.div>
            ))}
          </div>
        )}

        {/* View all link */}
        <div className="mt-6 flex justify-end">
          <Link to="/discover" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            View All Mixes <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* ── FEATURE STRIP ── */}
      <section className="border-t border-border">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { num: '01', title: 'Generate', body: 'Describe a vibe and get a full AI-composed track in seconds.' },
              { num: '02', title: 'Mix', body: 'Layer tracks, adjust BPM, and build seamless DJ sets live.' },
              { num: '03', title: 'Share', body: 'Publish your mixes publicly and grow an audience of listeners.' },
            ].map(({ num, title, body }) => (
              <div key={num} className="px-8 py-10 hover:bg-secondary/30 transition-colors">
                <p className="font-mono text-xs text-primary mb-4">{num}</p>
                <h3 className="font-heading font-black text-2xl uppercase mb-3">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
