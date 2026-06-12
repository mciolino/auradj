import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  MessageSquare, Zap, Sparkles, Save, Share2, Loader2,
  Music, ChevronRight, BarChart2, Play, Pause, Plus,
  Wand2, Globe, Lock, Radio, Disc3
} from 'lucide-react';
import MoodSelector from '@/components/session/MoodSelector';
import GenreSelector from '@/components/session/GenreSelector';
import DJChatPanel from '@/components/session/DJChatPanel';
import SpotifyPreviewPanel from '@/components/session/SpotifyPreviewPanel';
import TrackCard from '@/components/session/TrackCard';
import WaveVisualizer from '@/components/player/WaveVisualizer';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'prompt', label: 'Prompt', icon: Wand2 },
  { key: 'genre', label: 'Genre', icon: Music },
  { key: 'energy', label: 'Energy', icon: Zap },
];

export default function DJSession() {
  const { id } = useParams();
  const { play, isPlaying, currentTrack } = usePlayer();

  const [session, setSession] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [bpm, setBpm] = useState([120]);
  const [energy, setEnergy] = useState([6]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('prompt');
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    if (id) {
      base44.entities.DJSession.filter({ id }).then(res => {
        if (res[0]) {
          setSession(res[0]);
          setSelectedGenre(res[0].genre || '');
          setSelectedMood(res[0].mood || '');
          if (res[0].track_ids?.length > 0) {
            Promise.all(res[0].track_ids.map(tid =>
              base44.entities.Track.filter({ id: tid }).then(r => r[0])
            )).then(ts => setTracks(ts.filter(Boolean)));
          }
        }
      });
    } else {
      setSession({ title: 'New DJ Session', track_ids: [], is_public: false, is_saved: false });
    }
  }, [id]);

  const generateTrack = async (overrideParams) => {
    setIsGenerating(true);
    try {
      const genre = overrideParams?.genre || selectedGenre || 'Electronic';
      const mood = overrideParams?.mood || selectedMood || 'Energetic';
      const trackBpm = overrideParams?.bpm || bpm[0];
      const trackEnergy = overrideParams?.energy || energy[0];
      const userPrompt = overrideParams?.prompt || prompt || `${mood} ${genre} music at ${trackBpm} BPM`;

      let generationPrompt = userPrompt;
      let trackTitle = `${mood} ${genre} Mix`;
      let coverArtUrl = null;

      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate metadata for an AI music track.
Genre: ${genre}, Mood: ${mood}, BPM: ${trackBpm}, Energy: ${trackEnergy}/10
User request: "${userPrompt}"
Return JSON with: title (creative track name), prompt (detailed 2-sentence music gen prompt), tags (3 mood/genre tags array)`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            prompt: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      if (aiRes?.title) trackTitle = aiRes.title;
      if (aiRes?.prompt) generationPrompt = aiRes.prompt;

      const imgRes = await base44.integrations.Core.GenerateImage({
        prompt: `Abstract music album cover art for ${mood} ${genre} music. Minimalist, modern, no text.`
      }).catch(() => null);
      if (imgRes?.url) coverArtUrl = imgRes.url;

      let audioUrl = null;
      let isFallback = false;
      let musicRes = null;
      try {
        musicRes = await base44.functions.invoke('generateMusic', { prompt: generationPrompt });
      } catch (_) {
        musicRes = await base44.functions.invoke('generateMusic', { prompt: generationPrompt, use_fallback: true });
      }
      if (musicRes?.data?.success) {
        audioUrl = musicRes.data.audio_url;
        isFallback = musicRes.data.fallback === true;
      } else {
        const hash = Array.from(generationPrompt).reduce((a, c) => a + c.charCodeAt(0), 0);
        const demos = [
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        ];
        audioUrl = demos[hash % demos.length];
        isFallback = true;
      }

      const newTrack = {
        title: trackTitle, genre, mood, bpm: trackBpm, energy: trackEnergy,
        prompt_used: generationPrompt, cover_art_url: coverArtUrl,
        tags: aiRes?.tags || [mood, genre], is_public: false, audio_url: audioUrl,
      };

      const saved = await base44.entities.Track.create(newTrack);
      setTracks(prev => [...prev, saved]);

      if (session?.id) {
        const updatedIds = [...(session.track_ids || []), saved.id];
        await base44.entities.DJSession.update(session.id, {
          track_ids: updatedIds, genre, mood, bpm: trackBpm, energy_level: trackEnergy
        });
        setSession(prev => ({ ...prev, track_ids: updatedIds }));
      } else {
        const newSession = await base44.entities.DJSession.create({
          title: `${mood} ${genre} Session`, genre, mood, bpm: trackBpm,
          energy_level: trackEnergy, track_ids: [saved.id], is_public: false, is_saved: false
        });
        setSession(newSession);
        window.history.replaceState({}, '', `/session/${newSession.id}`);
      }

      play(saved, tracks);
      toast.success(isFallback ? `"${trackTitle}" added — demo audio` : `"${trackTitle}" generated 🎵`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate track');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAndPublish = async () => {
    if (!session?.id) return;
    setIsSaving(true);
    await base44.entities.DJSession.update(session.id, {
      is_saved: true, is_public: true,
      duration_minutes: Math.ceil(tracks.length * 3.5)
    });
    setSession(prev => ({ ...prev, is_saved: true, is_public: true }));
    toast.success('Mix published! 🎉');
    setIsSaving(false);
  };

  const sessionContext = { genre: selectedGenre, mood: selectedMood, bpm: bpm[0], energy: energy[0] };
  const isSessionPlaying = isPlaying && tracks.some(t => t.id === currentTrack?.id);

  return (
    <div className="pt-14 min-h-screen bg-background">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading leading-none">
                {session?.title || 'DJ Studio'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {session?.is_public ? (
                  <span className="text-green-400 flex items-center gap-1 inline-flex"><Globe className="w-3 h-3" />Public</span>
                ) : (
                  <span className="flex items-center gap-1 inline-flex"><Lock className="w-3 h-3" />Private</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full h-8"
              onClick={() => setIsChatOpen(!isChatOpen)}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Chat</span>
            </Button>
            {session?.id && (
              <Button size="sm" className="gap-1.5 rounded-full h-8 bg-primary hover:bg-primary/90"
                onClick={saveAndPublish} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Publish</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── LEFT: Controls ── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-secondary/60 rounded-2xl">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all',
                    activeTab === key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'prompt' && (
                <motion.div key="prompt" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
                  <label className="text-sm font-semibold block">Describe your vibe</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. 'late night rooftop chill with deep bass and dreamy synths…'"
                    className="w-full h-24 px-3 py-2.5 text-sm rounded-xl border border-input bg-background/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                  />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Mood</p>
                    <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
                  </div>
                </motion.div>
              )}

              {activeTab === 'genre' && (
                <motion.div key="genre" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <label className="text-sm font-semibold block">Select Genre</label>
                  <GenreSelector selected={selectedGenre} onSelect={setSelectedGenre} />
                </motion.div>
              )}

              {activeTab === 'energy' && (
                <motion.div key="energy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-border/60 bg-card p-4 space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold">BPM</label>
                      <span className="text-2xl font-bold text-primary tabular-nums">{bpm[0]}</span>
                    </div>
                    <Slider value={bpm} onValueChange={setBpm} min={60} max={200} step={1}
                      className="w-full" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>60 · Chill</span><span>120 · House</span><span>200 · Drum & Bass</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold">Energy</label>
                      <span className="text-2xl font-bold text-primary tabular-nums">{energy[0]}<span className="text-sm text-muted-foreground">/10</span></span>
                    </div>
                    <Slider value={energy} onValueChange={setEnergy} min={1} max={10} step={1}
                      className="w-full" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ambient</span><span>Club</span><span>Rave</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate button */}
            <motion.button
              onClick={() => generateTrack()}
              disabled={isGenerating}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                isGenerating
                  ? 'bg-primary/50 text-white cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30'
              )}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Track</>
              )}
            </motion.button>

            {/* Spotify Preview */}
            <SpotifyPreviewPanel genre={selectedGenre} mood={selectedMood} />
          </div>

          {/* ── CENTER + RIGHT: Tracklist + Visualizer ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Waveform visualizer bar */}
            {tracks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border/60 bg-card overflow-hidden"
              >
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                      isSessionPlaying ? 'bg-primary' : 'bg-secondary'
                    )}>
                      {isSessionPlaying
                        ? <Pause className="w-3 h-3 text-white" />
                        : <Play className="w-3 h-3 text-muted-foreground" />
                      }
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {isSessionPlaying ? `Now Playing · ${currentTrack?.title}` : 'Tap a track to play'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{tracks.length} tracks</span>
                </div>
                <WaveVisualizer isPlaying={isSessionPlaying} className="h-16 px-4 pb-3" />
              </motion.div>
            )}

            {/* Track list */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Disc3 className="w-4 h-4 text-primary" /> Tracklist
                </h2>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs rounded-full"
                  onClick={() => generateTrack()} disabled={isGenerating}>
                  <Plus className="w-3.5 h-3.5" /> Add Track
                </Button>
              </div>

              <div className="divide-y divide-border/30">
                {tracks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center px-6"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Wand2 className="w-8 h-8 text-primary/60" />
                    </div>
                    <h3 className="font-semibold mb-1">No tracks yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Set your vibe on the left and hit Generate — your first AI track will appear here.
                    </p>
                  </motion.div>
                ) : (
                  <AnimatePresence>
                    {tracks.map((track, i) => (
                      <motion.div
                        key={track.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <TrackCard
                          track={track}
                          index={i}
                          onPlay={() => play(track, tracks.filter(t => t.id !== track.id))}
                          isPlaying={isPlaying && currentTrack?.id === track.id}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* AI Chat panel (collapsible) */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <DJChatPanel
                    sessionContext={sessionContext}
                    onGenerate={generateTrack}
                    className="rounded-2xl border border-border/60 bg-card"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
