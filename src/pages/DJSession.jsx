import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Globe, Radio, Loader2, Wand2 } from 'lucide-react';
import DJMixer from '@/components/mixer/DJMixer';
import DJChatPanel from '@/components/session/DJChatPanel';
import ForYouPanel from '@/components/session/ForYouPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function DJSession() {
  const { id } = useParams();

  const [session,      setSession]      = useState(null);
  const [tracks,       setTracks]       = useState([]);
  const [isChatOpen,   setIsChatOpen]   = useState(false);
  const [isForYouOpen, setIsForYouOpen] = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  // ── Load session ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      base44.entities.DJSession.filter({ id }).then(res => {
        if (res[0]) {
          setSession(res[0]);
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
      setSession({ title: 'New Mix', track_ids: [], is_public: false, is_saved: false });
    }
  }, [id]);

  // ── Save a streamed track into the session ───────────────────────────────────
  const saveTrackToSession = async (track) => {
    try {
      // Avoid duplicates
      const alreadySaved = tracks.some(t => t.spotify_id === track.spotify_id || t.id === track.id);
      if (alreadySaved) return track;

      const saved = await base44.entities.Track.create({
        title:           track.title,
        artist:          track.artist       || '',
        album:           track.album        || '',
        genre:           track.genre        || '',
        bpm:             track.bpm          || 0,
        duration_seconds: track.duration_seconds || 0,
        cover_art_url:   track.cover_art_url || null,
        audio_url:       track.audio_url    || track.preview_url || null,
        spotify_id:      track.spotify_id   || null,
        spotify_uri:     track.spotify_uri  || null,
        source:          track.source       || 'spotify',
        is_public:       false,
        tags:            [track.genre, track.source].filter(Boolean),
      });

      setTracks(prev => [...prev, saved]);

      if (session?.id) {
        const updatedIds = [...(session.track_ids || []), saved.id];
        await base44.entities.DJSession.update(session.id, { track_ids: updatedIds });
        setSession(prev => ({ ...prev, track_ids: updatedIds }));
      } else {
        const newSession = await base44.entities.DJSession.create({
          title:    `${track.genre || 'DJ'} Mix`,
          genre:    track.genre || '',
          track_ids: [saved.id],
          is_public: false,
          is_saved:  false,
        });
        setSession(newSession);
        window.history.replaceState({}, '', `/session/${newSession.id}`);
      }

      return saved;
    } catch (err) {
      console.error('[DJSession] saveTrackToSession:', err);
      return track;
    }
  };

  // ── Publish ──────────────────────────────────────────────────────────────────
  const publish = async () => {
    if (!session?.id) return;
    setIsSaving(true);
    try {
      await base44.entities.DJSession.update(session.id, {
        is_saved: true,
        is_public: true,
        duration_minutes: Math.ceil(tracks.reduce((a, t) => a + (t.duration_seconds || 180), 0) / 60),
      });
      setSession(prev => ({ ...prev, is_saved: true, is_public: true }));
      toast.success('Mix published! 🎉');
    } catch (err) {
      toast.error('Failed to publish mix');
    } finally {
      setIsSaving(false);
    }
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
              onClick={() => { setIsForYouOpen(v => !v); setIsChatOpen(false); }}>
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">For You</span>
            </Button>
            <Button variant="outline" size="sm"
              className="gap-1.5 rounded-full h-8 border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsChatOpen(v => !v); setIsForYouOpen(false); }}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">AI Chat</span>
            </Button>
            <Button size="sm" className="gap-1.5 rounded-full h-8"
              style={{ background: '#C8FF00', color: '#000' }}
              onClick={publish} disabled={isSaving || !tracks.length}>
              {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Globe className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-xs font-bold">Publish</span>
            </Button>
          </div>
        </div>

        {/* Side panels */}
        <AnimatePresence>
          {(isChatOpen || isForYouOpen) && (
            <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} className="mb-4">
              {isChatOpen && (
                <DJChatPanel
                  session={session}
                  sessionContext={{ tracks: tracks.map(t => t.title), genre: tracks[0]?.genre }}
                  onGenerateTrack={() => {}}
                />
              )}
              {isForYouOpen && (
                <ForYouPanel
                  onApplyParams={() => setIsForYouOpen(false)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stream-first DJ Mixer */}
        <DJMixer
          tracks={tracks}
          onTrackLoaded={saveTrackToSession}
        />
      </div>
    </div>
  );
}
