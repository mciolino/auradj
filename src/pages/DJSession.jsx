import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Globe, Lock, Radio, Loader2, Wand2, Save
} from 'lucide-react';
import DJMixer from '@/components/mixer/DJMixer';
import DJChatPanel from '@/components/session/DJChatPanel';
import ForYouPanel from '@/components/session/ForYouPanel';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function DJSession() {
  const { id } = useParams();
  const { play } = usePlayer();

  const [session, setSession] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isForYouOpen, setIsForYouOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState(null);

  // Default generation params (can be overridden by ForYou / Chat)
  const [genParams, setGenParams] = useState({
    genre: 'Electronic', mood: 'Energy Boost', bpm: 128, energy: 7
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    if (id) {
      base44.entities.DJSession.filter({ id }).then(res => {
        if (res[0]) {
          setSession(res[0]);
          setGenParams(p => ({
            ...p,
            genre: res[0].genre || p.genre,
            mood: res[0].mood || p.mood,
            bpm: res[0].bpm || p.bpm,
            energy: res[0].energy_level || p.energy,
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

  const generateTrack = async (overrideParams = {}) => {
    setIsGenerating(true);
    try {
      const { genre, mood, bpm, energy } = { ...genParams, ...overrideParams };
      const userPrompt = overrideParams.prompt || `${mood} ${genre} music at ${bpm} BPM`;

      // AI metadata
      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate metadata for an AI DJ track.
Genre: ${genre}, Mood: ${mood}, BPM: ${bpm}, Energy: ${energy}/10
User request: "${userPrompt}"
Return JSON: title (creative track name), prompt (detailed 2-sentence music gen prompt), tags (3 tags)`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            prompt: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const trackTitle = aiRes?.title || `${mood} ${genre} Mix`;
      const genPrompt = aiRes?.prompt || userPrompt;

      // Cover art
      const imgRes = await base44.integrations.Core.GenerateImage({
        prompt: `Abstract music album art for ${mood} ${genre}. Minimalist, modern, electric. No text.`
      }).catch(() => null);

      // Audio generation
      let audioUrl = null;
      let isFallback = false;
      try {
        const musicRes = await base44.functions.invoke('generateMusic', { prompt: genPrompt });
        if (musicRes?.data?.success) {
          audioUrl = musicRes.data.audio_url;
          isFallback = musicRes.data.fallback === true;
        }
      } catch (_) {}

      if (!audioUrl) {
        const hash = Array.from(genPrompt).reduce((a, c) => a + c.charCodeAt(0), 0);
        const demos = [
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        ];
        audioUrl = demos[hash % demos.length];
        isFallback = true;
      }

      const saved = await base44.entities.Track.create({
        title: trackTitle, genre, mood, bpm, energy,
        prompt_used: genPrompt,
        cover_art_url: imgRes?.url || null,
        tags: aiRes?.tags || [mood, genre],
        is_public: false,
        audio_url: audioUrl,
      });

      setTracks(prev => [...prev, saved]);

      if (session?.id) {
        const updatedIds = [...(session.track_ids || []), saved.id];
        await base44.entities.DJSession.update(session.id, {
          track_ids: updatedIds, genre, mood, bpm, energy_level: energy
        });
        setSession(prev => ({ ...prev, track_ids: updatedIds }));
      } else {
        const newSession = await base44.entities.DJSession.create({
          title: `${mood} ${genre} Session`, genre, mood, bpm,
          energy_level: energy, track_ids: [saved.id], is_public: false, is_saved: false
        });
        setSession(newSession);
        window.history.replaceState({}, '', `/session/${newSession.id}`);
      }

      play(saved, []);
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full h-8 border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsForYouOpen(!isForYouOpen); setIsChatOpen(false); }}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">For You</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full h-8 border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsChatOpen(!isChatOpen); setIsForYouOpen(false); }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">AI Chat</span>
            </Button>
            {session?.id && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full h-8"
                style={{ background: '#C8FF00', color: '#000' }}
                onClick={saveAndPublish}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-xs font-bold">Publish</span>
              </Button>
            )}
          </div>
        </div>

        {/* Side panels */}
        <AnimatePresence>
          {(isChatOpen || isForYouOpen) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
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

        {/* DJ Mixer — the main event */}
        <DJMixer
          tracks={tracks}
          onGenerate={generateTrack}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
