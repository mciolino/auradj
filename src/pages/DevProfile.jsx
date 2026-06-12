import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import GitHubPanel from '@/components/github/GitHubPanel';
import { motion } from 'framer-motion';
import {
  Github, Music2, Code2, Disc3, Star, GitFork,
  GitCommit, Users, Zap, Globe, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';

/**
 * /dev/:userId  — "Musician who codes" profile card.
 * Shows: DJ stats + GitHub panel side by side.
 */
export default function DevProfile() {
  const { userId } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    const load = async () => {
      const [me, users, userSessions] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.User.filter({ id: userId }),
        base44.entities.DJSession.filter(
          { created_by_id: userId, is_public: true, is_saved: true },
          '-updated_date', 10
        ),
      ]);
      setCurrentUser(me);
      setProfileUser(users[0] || null);
      setSessions(userSessions);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="pt-14 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="h-48 rounded-3xl bg-secondary animate-pulse" />
          <div className="h-72 rounded-3xl bg-secondary animate-pulse" />
        </div>
      </div>
    );
  }

  // Genre breakdown
  const genreMap = sessions.reduce((acc, s) => {
    if (s.genre) acc[s.genre] = (acc[s.genre] || 0) + 1;
    return acc;
  }, {});
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // Mood breakdown
  const moodMap = sessions.reduce((acc, s) => {
    if (s.mood) acc[s.mood] = (acc[s.mood] || 0) + 1;
    return acc;
  }, {});
  const topMoods = Object.entries(moodMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="pt-14 min-h-screen">
      {/* Mesh gradient banner */}
      <div className="relative h-40 sm:h-52 overflow-hidden">
        <div className="absolute inset-0 bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-primary/30 via-purple-900/20 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(139,92,246,0.2),transparent_60%)]" />
        {/* Floating code snippets */}
        <div className="absolute top-6 right-8 font-mono text-xs text-primary/20 select-none hidden sm:block">
          {`const vibe = genre => tracks.filter(t => t.mood === "✨");`}
        </div>
        <div className="absolute bottom-4 left-1/4 font-mono text-xs text-purple-400/20 select-none hidden sm:block">
          {`// drop_the_bass() → 🎵`}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 pb-24 space-y-5">
        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border/60 bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Avatar className="w-16 h-16 ring-4 ring-background shadow-xl">
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-2xl font-bold">
                {profileUser?.full_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{profileUser?.full_name || 'Unknown'}</h1>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                  <Code2 className="w-3 h-3" /> Dev × DJ
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{profileUser?.email}</p>
            </div>

            <div className="flex gap-2">
              <Link to={`/profile/${userId}`}>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
                  <Disc3 className="w-3.5 h-3.5" /> DJ Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/40">
            {[
              { label: 'Total Mixes', value: sessions.length, icon: Music2, color: 'text-primary' },
              { label: 'Genres', value: topGenres.length, icon: Zap, color: 'text-purple-400' },
              { label: 'Avg BPM', value: sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.bpm || 120), 0) / sessions.length) : '—', icon: Disc3, color: 'text-cyan-400' },
              { label: 'Public Mixes', value: sessions.filter(s => s.is_public).length, icon: Globe, color: 'text-green-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/40">
                <div className={`${color} opacity-80`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-none">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Genre + Mood DNA */}
        {(topGenres.length > 0 || topMoods.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-border/60 bg-card p-5"
          >
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Sound DNA
            </h2>
            <div className="flex flex-wrap gap-2">
              {topGenres.map(([genre, count]) => (
                <span key={genre} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Music2 className="w-3 h-3" /> {genre}
                  <span className="opacity-60">×{count}</span>
                </span>
              ))}
              {topMoods.map(([mood, count]) => (
                <span key={mood} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {mood} <span className="opacity-60">×{count}</span>
                </span>
              ))}
            </div>

            {/* Mini genre bar chart */}
            {topGenres.length > 0 && (
              <div className="mt-4 space-y-2">
                {topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 truncate">{genre}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / sessions.length) * 100}%` }}
                        transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* GitHub panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Github className="w-4 h-4 text-primary" /> GitHub Activity
          </h2>
          {isOwnProfile ? (
            <GitHubPanel className="rounded-3xl" />
          ) : (
            <div className="rounded-3xl border border-border/60 bg-card p-8 text-center">
              <Github className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">GitHub activity is only visible on your own Dev Profile.</p>
            </div>
          )}
        </motion.div>

        {/* Recent mixes strip */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-primary" /> Recent Mixes
              </h2>
              <Link to={`/profile/${userId}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {sessions.slice(0, 5).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    to={`/session/${s.id}`}
                    className="group block rounded-2xl overflow-hidden border border-border/60 hover:border-primary/40 transition-all hover:-translate-y-1"
                  >
                    {s.cover_art_url ? (
                      <img src={s.cover_art_url} alt={s.title} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-gradient-to-br from-primary/20 to-purple-900/30 flex items-center justify-center">
                        <Disc3 className="w-8 h-8 text-primary/40" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.genre} · {s.bpm} BPM</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
