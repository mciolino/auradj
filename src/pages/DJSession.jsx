import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Zap, Sparkles, Save, Share2, Loader2, Music, ChevronRight, BarChart2 } from 'lucide-react';
import MoodSelector from '@/components/session/MoodSelector';
import GenreSelector from '@/components/session/GenreSelector';
import DJChatPanel from '@/components/session/DJChatPanel';
import SpotifyPreviewPanel from '@/components/session/SpotifyPreviewPanel';
import PremiumBanner from '@/components/premium/PremiumBanner';
import TrackCard from '@/components/session/TrackCard';
import WaveVisualizer from '@/components/player/WaveVisualizer';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
            Promise.all(res[0].track_ids.map(tid => base44.entities.Track.filter({ id: tid }).then(r => r[0]))).then(ts => setTracks(ts.filter(Boolean)));
          }
        }
      });
    } else {
      // New session
      setSession({ title: 'New DJ Session', track_ids: [], is_public: false, is_saved: false });
    }
  }, [id]);

  const generateTrack = async (overrideParams) => {
    setIsGenerating(true);
    try {
      await _generateTrack(overrideParams);
    } catch (err) {
      console.error('generateTrack error:', err);
      toast.error('Failed to generate track. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const _generateTrack = async (overrideParams) => {
    const genre = overrideParams?.genre || selectedGenre || 'Electronic';
    const mood = overrideParams?.mood || selectedMood || 'Energetic';
    const trackBpm = overrideParams?.bpm || bpm[0];
    const trackEnergy = overrideParams?.energy || energy[0];
    const userPrompt = overrideParams?.prompt || prompt || `${mood} ${genre} music at ${trackBpm} BPM`;

    // Get AI to build a rich generation prompt
    let generationPrompt = userPrompt;
    let trackTitle = `${mood} ${genre} Mix`;
    let coverArtUrl = null;

    const aiRes = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate metadata for an AI music track.
Genre: ${genre}, Mood: ${mood}, BPM: ${trackBpm}, Energy: ${trackEnergy}/10
User request: "${userPrompt}"
Return JSON with: title (creative track name), prompt (detailed 2-sentence music gen prompt describing instruments, rhythm, texture, vibe), tags (3 mood/genre tags array)`,
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

    // Generate cover art
    const imgRes = await base44.integrations.Core.GenerateImage({
      prompt: `Abstract music album cover art for ${mood} ${genre} music. Minimalist, modern design with flowing colors. No text.`
    }).catch(() => null);
    if (imgRes?.url) coverArtUrl = imgRes.url;

    // Generate real audio via HuggingFace MusicGen (with demo fallback)
    let audioUrl = null;
    let isFallback = false;
    let musicRes = null;
    try {
      musicRes = await base44.functions.invoke('generateMusic', { prompt: generationPrompt });
    } catch (_) {
      // 503 (model loading) or network error — retry with fallback
      musicRes = await base44.functions.invoke('generateMusic', { prompt: generationPrompt, use_fallback: true });
    }
    if (musicRes?.data?.success) {
      audioUrl = musicRes.data.audio_url;
      isFallback = musicRes.data.fallback === true;
    } else if (!audioUrl) {
      // Last resort: use fallback demo track directly
      const hash = Array.from(generationPrompt).reduce((a, c) => a + c.charCodeAt(0), 0);
      const demos = ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'];
      audioUrl = demos[hash % demos.length];
      isFallback = true;
    }

    const newTrack = {
      title: trackTitle,
      genre,
      mood,
      bpm: trackBpm,
      energy: trackEnergy,
      prompt_used: generationPrompt,
      cover_art_url: coverArtUrl,
      tags: aiRes?.tags || [mood, genre],
      is_public: false,
      audio_url: audioUrl,
    };

    const saved = await base44.entities.Track.create(newTrack);
    const trackWithId = { ...saved };
    setTracks(prev => [...prev, trackWithId]);

    // Update session
    const currentSession = session;
    if (currentSession?.id) {
      const updatedTrackIds = [...(currentSession.track_ids || []), saved.id];
      await base44.entities.DJSession.update(currentSession.id, {
        track_ids: updatedTrackIds,
        genre: genre,
        mood: mood,
        bpm: trackBpm,
        energy_level: trackEnergy
      });
      setSession(prev => ({ ...prev, track_ids: updatedTrackIds }));
    } else {
      // Create session first
      const newSession = await base44.entities.DJSession.create({
        title: `${mood} ${genre} Session`,
        genre,
        mood,
        bpm: trackBpm,
        energy_level: trackEnergy,
        track_ids: [saved.id],
        is_public: false,
        is_saved: false
      });
      setSession(newSession);
      // Use replace:true with state to avoid full remount resetting local state
      window.history.replaceState({}, '', `/session/${newSession.id}`);
    }

    // Auto-play the new track
    play(trackWithId, tracks.filter(t => t.id !== trackWithId.id));
    if (isFallback) {
      toast.success(`"${trackTitle}" added — demo audio (AI model warming up)`);
    } else {
      toast.success(`"${trackTitle}" generated with AI 🎵`);
    }
  };

  const saveAndPublish = async () => {
    if (!session?.id) return;
    setIsSaving(true);
    await base44.entities.DJSession.update(session.id, {
      is_saved: true,
      is_public: true,
      duration_minutes: Math.ceil(tracks.length * 3.5)
    });
    setSession(prev => ({ ...prev, is_saved: true, is_public: true }));
    toast.success('Mix published to your profile!');
    setIsSaving(false);
  };

  const sessionContext = { genre: selectedGenre, mood: selectedMood, bpm: bpm[0], energy: energy[0] };

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-1 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold font-heading">DJ Studio</h1>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <MessageSquare className="w-4 h-4" />
                AI Chat
              </Button>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {['prompt', 'genre', 'energy'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-sm font-medium capitalize transition-colors duration-150 cursor-pointer ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'prompt' && (
                <motion.div key="prompt" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Describe your vibe</label>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="e.g. 'late night rooftop chill with deep bass and dreamy synths'"
                      className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Quick Moods</p>
                    <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
                  </div>
                </motion.div>
              )}

              {activeTab === 'genre' && (
                <motion.div key="genre" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Select Genre</p>
                    <GenreSelector selected={selectedGenre} onSelect={setSelectedGenre} />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">BPM: <span className="text-primary">{bpm[0]}</span></p>
                    <Slider value={bpm} onValueChange={setBpm} min={60} max={200} step={5} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Slow (60)</span><span>Fast (200)</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'energy' && (
                <motion.div key="energy" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Energy Level: <span className="text-primary">{energy[0]}/10</span></p>
                    <Slider value={energy} onValueChange={setEnergy} min={1} max={10} step={1} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>🌙 Chill</span><span>⚡ Intense</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Melancholy', 'Peaceful', 'Uplifting', 'Dark', 'Euphoric', 'Aggressive'].map(e => (
                      <button key={e} onClick={() => setPrompt(prev => prev + ` ${e}`)} className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary text-secondary-foreground hover:border-primary/50 cursor-pointer transition-colors duration-150">
                        {e}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate Button */}
            <Button
              onClick={() => generateTrack()}
              disabled={isGenerating}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Composing with AI…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Track
                </>
              )}
            </Button>

            {/* Spotify Preview */}
            <SpotifyPreviewPanel genre={selectedGenre} mood={selectedMood} prompt={prompt} />

            {/* Premium upsell */}
            <PremiumBanner compact />

            {/* Session Actions */}
            {session?.id && tracks.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={saveAndPublish} disabled={isSaving || session.is_saved}>
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {session.is_saved ? 'Published' : 'Publish Mix'}
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}>
                  <Share2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Right: Track Queue */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-lg">{session?.title || 'New Session'}</h2>
                  <p className="text-sm text-muted-foreground">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
                </div>
                {isPlaying && currentTrack && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <WaveVisualizer isPlaying barCount={6} />
                    <span className="font-medium hidden sm:block">Now Playing</span>
                  </div>
                )}
              </div>

              {tracks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
                    <Music className="w-8 h-8 text-primary/60" />
                  </div>
                  <h3 className="font-medium mb-1">Your session is empty</h3>
                  <p className="text-sm text-muted-foreground mb-4">Generate your first track using the controls on the left</p>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => generateTrack()}>
                    <Sparkles className="w-3.5 h-3.5" /> Quick Generate
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence>
                    {tracks.map((track, i) => (
                      <motion.div key={track.id || track.tempId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <TrackCard track={track} index={i} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {tracks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => generateTrack()} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate Next Track
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Panel */}
      <DJChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onGenerate={generateTrack}
        sessionContext={sessionContext}
      />
    </div>
  );
}