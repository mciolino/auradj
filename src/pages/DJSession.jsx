import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Globe, Lock, Radio, Loader2, Wand2 } from 'lucide-react';
import DJMixer from '@/components/mixer/DJMixer';
import GenerateModal from '@/components/mixer/GenerateModal';
import DJChatPanel from '@/components/session/DJChatPanel';
import ForYouPanel from '@/components/session/ForYouPanel';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function DJSession() {
  const { id } = useParams();
  const { play } = usePlayer();

  const [session,       setSession]       = useState(null);
  const [tracks,        setTracks]        = useState([]);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [showGenModal,  setShowGenModal]  = useState(false);
  const [isChatOpen,    setIsChatOpen]    = useState(false);
  const [isForYouOpen,  setIsForYouOpen]  = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [user,          setUser]          = useState(null);

  const [genParams, setGenParams] = useState({
    genre: 'Electronic', mood: 'Energy Boost', bpm: 128, energy: 7
  });

  // ── Load session ─────────────────────────────────────────────────────────────
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    if (id) {
      base44.entities.DJSession.filter({ id }).then(res => {
        if (res[0]) {
          setSession(res[0]);
          setGenParams(p => ({
            ...p,
            genre:  res[0].genre         || p.genre,
            mood:   res[0].mood          || p.mood,
            bpm:    res[0].bpm           || p.bpm,
            energy: res[0].energy_level  || p.energy,
          }));
          if (res[0].track_ids?.length > 0) {
            Promise.all(
              res[0].track_ids.map(tid =>
                base44.entities.Track.filter({ id: tid }).then(r => r[0])
              )
            ).then(ts => setTracks(ts.filter(Boolean)));
          }
        }
      });
    } else {
      setSession({ title: 'New Session', track_ids: [], is_public: false, is_saved: false });
    }
  }, [id]);

  // ── Save track to entity + session ───────────────────────────────────────────
  const persistTrack = async (trackData) => {
    const { title, genre, bpm, audio_url, cover_art_url, source, generated } = trackData;

    const saved = await base44.entities.Track.create({
      title:        title        || 'Untitled',
      genre:        genre        || genParams.genre,
      mood:         genParams.mood,
      bpm:          bpm          || genParams.bpm,
      energy:       genParams.energy,
      prompt_used:  trackData.prompt || '',
      cover_art_url: cover_art_url || null,
      tags:         [genre, source === 'suno' ? 'Suno AI' : source === 'huggingface' ? 'MusicGen' : 'Demo'].filter(Boolean),
      is_public:    false,
      audio_url,
    });

    setTracks(prev => [...prev, saved]);

    if (session?.id) {
      const updatedIds = [...(session.track_ids || []), saved.id];
      await base44.entities.DJSession.update(session.id, {
        track_ids: updatedIds,
        genre: genre || genParams.genre,
        bpm:   bpm   || genParams.bpm,
      });
      setSession(prev => ({ ...prev, track_ids: updatedIds }));
    } else {
      const newSession = await base44.entities.DJSession.create({
        title: `${genre || genParams.genre} Session`,
        genre:  genre  || genParams.genre,
        mood:   genParams.mood,
        bpm:    bpm    || genParams.bpm,
        energy_level: genParams.energy,
        track_ids: [saved.id],
        is_public: false,
        is_saved:  false,
      });
      setSession(newSession);
      window.history.replaceState({}, '', `/session/${newSession.id}`);
    }

    return saved;
  };

  // ── Handle track coming out of GenerateModal ──────────────────────────────────
  const handleModalGenerated = async (trackData) => {
    // trackData already has audio_url from the backend function
    setIsGenerating(true);
    try {
      // Generate cover art in parallel
      const imgRes = await base44.integrations.Core.GenerateImage({
        prompt: `Abstract minimal album art for ${trackData.genre} music, electric ${trackData.genre === 'Synthwave' ? 'pink' : 'lime'} tones, no text, dark background`
      }).catch(() => null);

      const saved = await persistTrack({ ...trackData, cover_art_url: imgRes?.url || null });
      play(saved, []);

      const sourceLabel = { suno: 'Suno AI 🎵', huggingface: 'MusicGen 🤗', demo: 'Demo track' }[trackData.source] || '';
      toast.success(`"${saved.title}" ready — ${sourceLabel}`);
    } catch (err) {
      toast.error('Failed to save track');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Quick-generate (from DJMixer header button / chat) ────────────────────────
  const generateTrack = async (overrideParams = {}) => {
    // If called with no args, open the modal instead
    if (Object.keys(overrideParams).length === 0) {
      setShowGenModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const { genre, mood, bpm, energy } = { ...genParams, ...overrideParams };
      const userPrompt = overrideParams.prompt || `${mood} ${genre} music at ${bpm} BPM`;

      // AI metadata
      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate metadata for an AI DJ track.
Genre: ${genre}, Mood: ${mood}, BPM: ${bpm}, Energy: ${energy}/10
User request: "${userPrompt}"
Return JSON: title (creative track name), prompt (detailed 2-sentence music gen prompt for Suno AI), tags (3 tags)`,
        response_json_schema: {
          type: 'object',
          properties: {
            title:  { type: 'string' },
            prompt: { type: 'string' },
            tags:   { type: 'array', items: { type: 'string' } },
          }
        }
      });

      const trackTitle = aiRes?.title  || `${mood} ${genre}`;
      const genPrompt  = aiRes?.prompt || userPrompt;

      // Cover art
      const imgRes = await base44.integrations.Core.GenerateImage({
        prompt: `Abstract minimal album art for ${mood} ${genre} music. Electric, modern, no text.`
      }).catch(() => null);

      // Audio via generateMusic backend (Suno → HF → demo chain)
      let audioUrl = null, source = 'demo';
      try {
        const musicRes = await base44.functions.invoke('generateMusic', {
          prompt: genPrompt, genre, bpm, instrumental: true
        });
        if (musicRes?.data?.success) {
          audioUrl = musicRes.data.audio_url;
          source   = musicRes.data.source || 'demo';
        }
      } catch (_) {}

      if (!audioUrl) {
        const demos = ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'];
        audioUrl = demos[Math.abs(Array.from(genPrompt).reduce((a,c)=>a+c.charCodeAt(0),0)) % demos.length];
        source = 'demo';
      }

      const saved = await persistTrack({
        title: trackTitle, genre, bpm, audio_url: audioUrl,
        cover_art_url: imgRes?.url || null, source, prompt: genPrompt,
        tags: aiRes?.tags || [genre, mood],
      });

      play(saved, []);

      const sourceLabel = { suno:'Suno AI 🎵', huggingface:'MusicGen 🤗', demo:'demo audio' }[source] || '';
      toast.success(`"${trackTitle}" ready — ${sourceLabel}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate track');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────────
  const saveAndPublish = async () => {
    if (!session?.id) return;
    setIsSaving(true);
    await base44.entities.DJSession.update(session.id, {
      is_saved: true, is_public: true,
      duration_minutes: Math.ceil(tracks.length * 3.5),
    });
    setSession(prev => ({ ...prev, is_saved: true, is_public: true }));
    toast.success('Mix published! 🎉');
    setIsSaving(false);
  };

  return (
    <div className="pt-14 min-h-screen" style={{ background: '#000' }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#C8FF00]/4 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#00cfff]/4 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-3 sm:px-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C8FF00]/20 flex items-center justify-center">
              <Radio className="w-4 h-4 text-[#C8FF00]" />
            </div>
            <div>
              <h1 className="text-lg font-black font-mono leading-none text-white">
                {session?.title || 'DJ Studio'}
              </h1>
              <p className="text-[10px] text-white/40 font-mono mt-0.5">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''} ·{' '}
                {session?.is_public
                  ? <span className="text-[#C8FF00]">Public</span>
                  : <span>Private</span>
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              className="gap-1.5 rounded-full h-8 border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsForYouOpen(!isForYouOpen); setIsChatOpen(false); }}>
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">For You</span>
            </Button>
            <Button variant="outline" size="sm"
              className="gap-1.5 rounded-full h-8 border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsChatOpen(!isChatOpen); setIsForYouOpen(false); }}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">AI Chat</span>
            </Button>
            {session?.id && (
              <Button size="sm" className="gap-1.5 rounded-full h-8"
                style={{ background: '#C8FF00', color: '#000' }}
                onClick={saveAndPublish} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-xs font-bold">Publish</span>
              </Button>
            )}
          </div>
        </div>

        {/* Side panels */}
        <AnimatePresence>
          {(isChatOpen || isForYouOpen) && (
            <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} className="mb-4">
              {isChatOpen && (
                <DJChatPanel
                  session={session}
                  sessionContext={{ genre: genParams.genre, mood: genParams.mood, bpm: genParams.bpm, energy: genParams.energy }}
                  onGenerateTrack={generateTrack}
                />
              )}
              {isForYouOpen && (
                <ForYouPanel
                  onApplyParams={(p) => { setGenParams(prev => ({ ...prev, ...p })); setIsForYouOpen(false); toast('Taste DNA applied! 🎯'); }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* DJ Mixer */}
        <DJMixer
          tracks={tracks}
          onGenerate={() => setShowGenModal(true)}
          isGenerating={isGenerating}
        />
      </div>

      {/* Generate Modal */}
      <GenerateModal
        isOpen={showGenModal}
        onClose={() => setShowGenModal(false)}
        onGenerated={handleModalGenerated}
      />
    </div>
  );
}
