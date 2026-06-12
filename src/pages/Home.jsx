import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Users, Disc3, Zap, Music2 } from 'lucide-react';
import MixCard from '@/components/common/MixCard';
import WaveVisualizer from '@/components/player/WaveVisualizer';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MOODS = ['Focus', 'Chill', 'Hype', 'Late Night', 'Morning Run', 'Deep Work'];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

export default function Home() {
  const [tab, setTab] = useState('trending');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('premium') === 'success') {
      toast.success('Welcome to AuraDJ Premium! 🎉');
      window.history.replaceState({}, '', '/');
    } else if (params.get('premium') === 'cancelled') {
      toast.info('Checkout cancelled — upgrade anytime from the DJ Studio.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    base44.entities.DJSession.filter({ is_public: true, is_saved: true }, '-play_count', 24)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const trendingMixes = [...sessions].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden hero-mesh pt-24 pb-20 px-4 text-center">
        {/* Decorative orbs */}
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-purple-500/6 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6"
          >
            <Sparkles className="w-3 h-3" />
            AI-Powered Music Generation
          </motion.div>

          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight text-balance mb-4 leading-[1.05]">
            Your personal AI DJ,{' '}
            <span className="text-shimmer">always on.</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-lg mx-auto mb-10 text-pretty leading-relaxed">
            Generate original music, create seamless mixes, and discover new sounds — all powered by AI that listens to you.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-12">
            <Link to="/session">
              <Button
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25 gap-2 pulse-glow px-7 text-base"
              >
                <Sparkles className="w-4 h-4" />
                Start DJ Session
              </Button>
            </Link>
            <Link to="/discover">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border/60 hover:border-border gap-2 px-7 text-base bg-card/40 backdrop-blur-sm"
              >
                <TrendingUp className="w-4 h-4" />
                Explore Mixes
              </Button>
            </Link>
          </div>

          {/* Quick mood chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Quick start:</span>
            {MOODS.map((mood, i) => (
              <motion.div
                key={mood}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.06 }}
              >
                <Link to={`/session?mood=${encodeURIComponent(mood)}`}>
                  <button className="px-3 py-1 rounded-full text-xs font-medium bg-card/60 border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all">
                    {mood}
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Live waveform decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 pointer-events-none flex items-end px-4 overflow-hidden">
          <WaveVisualizer isPlaying={true} barCount={80} height={64} color="hsl(263, 75%, 68%)" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="border-y border-border/40 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-8 sm:gap-16">
          {[
            { icon: Music2, label: 'Mixes Created', value: '12K+' },
            { icon: Users,  label: 'Active DJs',   value: '3.4K' },
            { icon: Zap,    label: 'AI Generations', value: '50K+' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2.5 text-center">
              <Icon className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-base font-bold font-heading leading-none">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trending mixes ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-2xl font-bold font-heading">Trending Mixes</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Discover what's hot right now</p>
          </div>
          <div className="flex rounded-xl border border-border/60 overflow-hidden bg-card/40">
            {[
              { key: 'trending', icon: TrendingUp, label: 'Trending' },
              { key: 'following', icon: Users, label: 'Following' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  tab === key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-square rounded-xl bg-card animate-pulse" />
                <div className="h-3 bg-card rounded animate-pulse w-3/4" />
                <div className="h-3 bg-card rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : trendingMixes.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border/60 rounded-2xl">
            <Disc3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No mixes yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to create and share an AI mix!</p>
            <Link to="/session">
              <Button className="rounded-full gap-2">
                <Sparkles className="w-4 h-4" /> Create First Mix
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          >
            {trendingMixes.map((session) => (
              <motion.div key={session.id} variants={cardVariants}>
                <MixCard session={session} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
