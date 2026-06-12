import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Music2, SlidersHorizontal, Users } from 'lucide-react';
import MixCard from '@/components/common/MixCard';
import GenreSelector from '@/components/session/GenreSelector';
import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';

export default function Discover() {
  const [sessions, setSessions] = useState([]);
  const [creators, setCreators] = useState({}); // userId -> user object
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [bpmRange, setBpmRange] = useState([60, 180]);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState('mixes'); // 'mixes' | 'people'

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await base44.entities.DJSession.filter({ is_public: true, is_saved: true }, '-updated_date', 50);
      setSessions(data);

      // Gather unique creator IDs and fetch their profiles
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

  const filtered = sessions.filter(s => {
    const matchSearch = !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.genre?.toLowerCase().includes(search.toLowerCase()) || s.mood?.toLowerCase().includes(search.toLowerCase());
    const matchGenre = !selectedGenre || s.genre === selectedGenre;
    const matchBpm = !s.bpm || (s.bpm >= bpmRange[0] && s.bpm <= bpmRange[1]);
    return matchSearch && matchGenre && matchBpm;
  });

  // Unique creators who have at least one public mix
  const peopleList = Object.values(creators).filter(u =>
    sessions.some(s => s.created_by_id === u.id)
  ).filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-heading mb-1">Discover</h1>
          <p className="text-muted-foreground">Explore AI-generated mixes from creators worldwide</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit mb-5">
          {[{ key: 'mixes', label: 'Mixes', icon: Music2 }, { key: 'people', label: 'People', icon: Users }].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${tab === key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Search + Filter Bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'people' ? 'Search creators…' : 'Search mixes, genres, moods…'}
              className="pl-9"
            />
          </div>
          {tab === 'mixes' && (
            <Button variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>
          )}
        </div>

        {tab === 'mixes' && showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 rounded-xl border border-border bg-card space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Genre</p>
              <GenreSelector selected={selectedGenre} onSelect={setSelectedGenre} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">BPM Range: {bpmRange[0]} – {bpmRange[1]}</p>
              <Slider value={bpmRange} onValueChange={setBpmRange} min={60} max={200} step={5} className="w-full max-w-xs" />
            </div>
          </motion.div>
        )}

        {/* Mixes Tab */}
        {tab === 'mixes' && (
          loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square rounded-xl bg-secondary animate-pulse" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No mixes found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((session, i) => {
                const creator = creators[session.created_by_id];
                return (
                  <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <MixCard
                      session={session}
                      creatorName={creator?.full_name}
                      creatorId={creator?.id}
                    />
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* People Tab */}
        {tab === 'people' && (
          loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : peopleList.length === 0 ? (
            <div className="text-center py-24">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No creators found</h3>
              <p className="text-muted-foreground">Be the first to publish a mix!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {peopleList.map((user, i) => {
                const mixCount = sessions.filter(s => s.created_by_id === user.id).length;
                return (
                  <motion.div key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link to={`/profile/${user.id}`} className="flex flex-col items-center text-center p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                        <span className="text-xl font-bold text-primary">{user.full_name?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <p className="font-semibold text-sm truncate w-full group-hover:text-primary transition-colors">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{mixCount} mix{mixCount !== 1 ? 'es' : ''}</p>
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