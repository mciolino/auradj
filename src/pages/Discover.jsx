import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Music2, SlidersHorizontal, Users, Flame,
  Clock, TrendingUp, X
} from 'lucide-react';
import MixCard from '@/components/common/MixCard';
import GenreSelector from '@/components/session/GenreSelector';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const GENRE_COLORS = {
  Electronic: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  House: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
  'Hip-Hop': 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  Ambient: 'from-teal-500/20 to-green-500/20 border-teal-500/30',
  Techno: 'from-red-500/20 to-rose-500/20 border-red-500/30',
  Jazz: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
};

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'trending', label: 'Trending', icon: TrendingUp },
  { key: 'hot', label: 'Hot', icon: Flame },
];

const TABS = [
  { key: 'mixes', label: 'Mixes', icon: Music2 },
  { key: 'people', label: 'People', icon: Users },
];

export default function Discover() {
  const [sessions, setSessions] = useState([]);
  const [creators, setCreators] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [bpmRange, setBpmRange] = useState([60, 180]);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState('mixes');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await base44.entities.DJSession.filter(
        { is_public: true, is_saved: true }, '-updated_date', 50
      );
      setSessions(data);
      const creatorIds = [...new Set(data.map(s => s.created_by_id).filter(Boolean))];
      if (creatorIds.length > 0) {
        const users = await base44.entities.User.list('-created_date', 100);
        const map = {};
        users.forEach(u => { map[u.id] = u; });
        setCreators(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = sessions
    .filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !search
        || s.title?.toLowerCase().includes(q)
        || s.genre?.toLowerCase().includes(q)
        || s.mood?.toLowerCase().includes(q);
      const matchGenre = !selectedGenre || s.genre === selectedGenre;
      const matchBpm = !s.bpm || (s.bpm >= bpmRange[0] && s.bpm <= bpmRange[1]);
      return matchSearch && matchGenre && matchBpm;
    })
    .sort((a, b) => {
      if (sortBy === 'trending') return (b.play_count || 0) - (a.play_count || 0);
      if (sortBy === 'hot') return (b.like_count || 0) - (a.like_count || 0);
      return new Date(b.updated_date) - new Date(a.updated_date);
    });

  const peopleList = Object.values(creators)
    .filter(u => sessions.some(s => s.created_by_id === u.id))
    .filter(u => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()));

  // Genre breakdown for chips
  const genreCounts = sessions.reduce((acc, s) => {
    if (s.genre) acc[s.genre] = (acc[s.genre] || 0) + 1;
    return acc;
  }, {});
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="pt-14 min-h-screen">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-bold font-heading mb-1">Discover</h1>
            <p className="text-muted-foreground text-sm">AI-generated mixes from creators worldwide</p>
          </motion.div>

          {/* Genre quick chips */}
          {topGenres.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-2 mt-4"
            >
              {topGenres.map(([genre, count]) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    'bg-gradient-to-r',
                    GENRE_COLORS[genre] || 'from-secondary to-secondary border-border',
                    selectedGenre === genre ? 'ring-2 ring-primary scale-105' : 'hover:scale-105'
                  )}
                >
                  {genre} <span className="opacity-60">·{count}</span>
                </button>
              ))}
              {selectedGenre && (
                <button
                  onClick={() => setSelectedGenre('')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-secondary/60 rounded-2xl w-fit">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all',
                  tab === key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'people' ? 'Search creators…' : 'Search mixes, genres…'}
                className="pl-9 rounded-xl bg-secondary/40 border-border/40 focus:bg-background"
              />
            </div>

            {/* Sort (mixes only) */}
            {tab === 'mixes' && (
              <div className="flex gap-1 p-1 bg-secondary/60 rounded-xl">
                {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    title={label}
                    className={cn(
                      'p-1.5 rounded-lg transition-all',
                      sortBy === key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}

            {/* Filters toggle */}
            {tab === 'mixes' && (
              <Button
                variant="outline" size="sm"
                className={cn('rounded-xl gap-1.5', showFilters && 'bg-primary text-white border-primary')}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {tab === 'mixes' && showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <div className="p-4 rounded-2xl border border-border/60 bg-card space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Genre</p>
                  <GenreSelector selected={selectedGenre} onSelect={setSelectedGenre} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">
                    BPM Range: <span className="text-primary">{bpmRange[0]} – {bpmRange[1]}</span>
                  </p>
                  <Slider value={bpmRange} onValueChange={setBpmRange} min={60} max={200} step={5}
                    className="w-full max-w-sm" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MIXES TAB */}
        {tab === 'mixes' && (
          loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square rounded-2xl bg-secondary animate-pulse" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No mixes found</h3>
              <p className="text-muted-foreground text-sm">Try different filters or be the first to publish one</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((session, i) => {
                const creator = creators[session.created_by_id];
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, type: 'spring', stiffness: 200 }}
                  >
                    <MixCard session={session} creatorName={creator?.full_name} creatorId={creator?.id} />
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* PEOPLE TAB */}
        {tab === 'people' && (
          loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : peopleList.length === 0 ? (
            <div className="text-center py-24">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No creators yet</h3>
              <p className="text-muted-foreground text-sm">Publish a mix to appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {peopleList.map((user, i) => {
                const mixCount = sessions.filter(s => s.created_by_id === user.id).length;
                const topGenre = sessions
                  .filter(s => s.created_by_id === user.id && s.genre)
                  .reduce((acc, s) => { acc[s.genre] = (acc[s.genre] || 0) + 1; return acc; }, {});
                const dominantGenre = Object.entries(topGenre).sort((a, b) => b[1] - a[1])[0]?.[0];

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 180 }}
                  >
                    <Link
                      to={`/profile/${user.id}`}
                      className="flex flex-col items-center text-center p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-1 transition-all duration-200 group"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center mb-3 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                        <span className="text-xl font-bold text-primary">
                          {user.full_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <p className="font-semibold text-sm truncate w-full group-hover:text-primary transition-colors">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {mixCount} mix{mixCount !== 1 ? 'es' : ''}
                      </p>
                      {dominantGenre && (
                        <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          {dominantGenre}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
