import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, Play, Heart, Music, Timer, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

function StatPill({ icon: Icon, label, value, color = 'text-primary' }) {
  return (
    <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function formatMinutes(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Estimate streaming minutes: play_count × duration_minutes (fallback: tracks × 3.5 min avg)
function estimateStreamingMinutes(session) {
  const plays = session.play_count || 0;
  const durMin = session.duration_minutes || (session.track_ids?.length || 1) * 3.5;
  return plays * durMin;
}

export default function MixStats() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('streaming'); // 'streaming' | 'plays' | 'likes'

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const data = await base44.entities.DJSession.filter(
        { created_by_id: user.id, is_saved: true },
        '-play_count',
        50
      );
      setSessions(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const enriched = sessions.map(s => ({
    ...s,
    streamingMinutes: estimateStreamingMinutes(s),
    trackCount: s.track_ids?.length || 0,
  }));

  const sorted = [...enriched].sort((a, b) => {
    if (sort === 'streaming') return b.streamingMinutes - a.streamingMinutes;
    if (sort === 'plays') return (b.play_count || 0) - (a.play_count || 0);
    return (b.likes || 0) - (a.likes || 0);
  });

  const totalStreamingMinutes = enriched.reduce((sum, s) => sum + s.streamingMinutes, 0);
  const totalPlays = enriched.reduce((sum, s) => sum + (s.play_count || 0), 0);
  const totalLikes = enriched.reduce((sum, s) => sum + (s.likes || 0), 0);
  const avgEngagement = enriched.length > 0
    ? (enriched.reduce((sum, s) => sum + (s.streamingMinutes / Math.max(s.play_count || 1, 1)), 0) / enriched.length)
    : 0;

  const chartData = sorted.slice(0, 10).map(s => ({
    name: s.title?.length > 18 ? s.title.slice(0, 18) + '…' : s.title,
    minutes: Math.round(s.streamingMinutes),
    plays: s.play_count || 0,
    id: s.id,
  }));

  const SORT_OPTS = [
    { key: 'streaming', label: 'Streaming Time' },
    { key: 'plays', label: 'Play Count' },
    { key: 'likes', label: 'Likes' },
  ];

  if (loading) return (
    <div className="pt-14 min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-heading">Mix Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">See which sessions keep listeners hooked the longest</p>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Timer, label: 'Total Streaming', value: formatMinutes(totalStreamingMinutes), color: 'text-primary' },
            { icon: Play, label: 'Total Plays', value: totalPlays.toLocaleString(), color: 'text-blue-500' },
            { icon: Heart, label: 'Total Likes', value: totalLikes.toLocaleString(), color: 'text-rose-500' },
            { icon: Clock, label: 'Avg Listen Time', value: formatMinutes(avgEngagement), color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-2">
                {React.createElement(s.icon, { className: `w-4 h-4 ${s.color}` })}
              </div>
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No published mixes yet</p>
            <p className="text-sm text-muted-foreground mt-1">Publish a session to start tracking performance</p>
            <Link to="/session" className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline">
              Go to DJ Studio →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Top Mixes by Streaming Minutes</h2>
                <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
                  {SORT_OPTS.map(o => (
                    <button
                      key={o.key}
                      onClick={() => setSort(o.key)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${sort === o.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => sort === 'streaming' ? `${v}m` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip
                    formatter={(val) => [sort === 'streaming' ? `${val} min` : val, sort === 'streaming' ? 'Streaming time' : sort === 'plays' ? 'Plays' : 'Likes']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar
                    dataKey={sort === 'streaming' ? 'minutes' : sort}
                    radius={[0, 6, 6, 0]}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(263 70% 55%)' : `hsl(263 70% ${65 + i * 2}% / ${1 - i * 0.07})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">All Sessions</h2>
              </div>
              <div className="divide-y divide-border">
                {sorted.map((session, i) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors"
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold text-muted-foreground w-6 text-center flex-shrink-0">
                      {i + 1}
                    </span>

                    {/* Cover */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {session.cover_art_url ? (
                        <img src={session.cover_art_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Title + tags */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/mix/${session.id}`} className="text-sm font-semibold hover:text-primary transition-colors truncate block">
                        {session.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        {session.genre && <span className="text-xs text-muted-foreground">{session.genre}</span>}
                        {session.mood && <span className="text-xs text-muted-foreground">· {session.mood}</span>}
                        <span className="text-xs text-muted-foreground">· {session.trackCount} track{session.trackCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      <StatPill icon={Timer} label="Stream time" value={formatMinutes(session.streamingMinutes)} />
                      <StatPill icon={Play} label="Plays" value={(session.play_count || 0).toLocaleString()} color="text-blue-500" />
                      <StatPill icon={Heart} label="Likes" value={(session.likes || 0).toLocaleString()} color="text-rose-500" />
                    </div>

                    {/* Mobile compact */}
                    <div className="flex sm:hidden items-center gap-3 text-sm flex-shrink-0">
                      <span className="flex items-center gap-1 text-primary font-semibold">
                        <Timer className="w-3.5 h-3.5" />{formatMinutes(session.streamingMinutes)}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Play className="w-3.5 h-3.5" />{session.play_count || 0}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pb-2">
              Streaming time = play count × session duration. Sortable by streaming time, plays, or likes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}