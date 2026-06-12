import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { usePlayer } from '@/context/PlayerContext';
import TrackCard from '@/components/session/TrackCard';
import WaveVisualizer from '@/components/player/WaveVisualizer';
import { Play, Pause, Heart, Music, Clock, Loader2 } from 'lucide-react';
import ExportToServices from '@/components/services/ExportToServices';
import SocialShareButtons from '@/components/common/SocialShareButtons';
import SpotifyPlayer from '@/components/spotify/SpotifyPlayer';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function MixDetail() {
  const { id } = useParams();
  const { play, togglePlay, isPlaying, currentTrack } = usePlayer();
  const [session, setSession] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [creator, setCreator] = useState(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSpotify, setShowSpotify] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [me, sessions] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.DJSession.filter({ id }),
      ]);
      setCurrentUser(me);
      const s = sessions[0];
      if (!s) { setLoading(false); return; }
      setSession(s);

      const [users, myLikes] = await Promise.all([
        base44.entities.User.filter({ id: s.created_by_id }),
        me ? base44.entities.Like.filter({ session_id: id, user_id: me.id }) : Promise.resolve([]),
        s.track_ids?.length ? Promise.all(s.track_ids.map(tid => base44.entities.Track.filter({ id: tid }).then(r => r[0]))).then(ts => setTracks(ts.filter(Boolean))) : Promise.resolve(),
      ]);

      setCreator(users[0] || null);
      setHasLiked(myLikes.length > 0);

      // Increment play count
      await base44.entities.DJSession.update(id, { play_count: (s.play_count || 0) + 1 });
      setLoading(false);
    };
    load();
  }, [id]);

  const handleLike = async () => {
    if (!currentUser) { toast.error('Sign in to like mixes'); return; }
    if (hasLiked) {
      const likes = await base44.entities.Like.filter({ session_id: id, user_id: currentUser.id });
      if (likes[0]) await base44.entities.Like.delete(likes[0].id);
      setHasLiked(false);
      setSession(prev => ({ ...prev, likes: (prev.likes || 1) - 1 }));
    } else {
      await base44.entities.Like.create({ session_id: id, user_id: currentUser.id });
      setHasLiked(true);
      setSession(prev => ({ ...prev, likes: (prev.likes || 0) + 1 }));
    }
  };

  const isCurrentSession = currentTrack?.session_id === id;

  const handlePlayAll = () => {
    if (isCurrentSession) togglePlay();
    else if (tracks.length > 0) {
      const [first, ...rest] = tracks;
      play({ ...first, session_id: id }, rest.map(t => ({ ...t, session_id: id })));
    }
  };

  if (loading) return (
    <div className="pt-14 min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!session) return (
    <div className="pt-14 min-h-screen flex items-center justify-center text-muted-foreground">
      Mix not found.
    </div>
  );

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-6 mb-8">
          {/* Cover */}
          <div className="w-full sm:w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/30 to-primary/5">
            {session.cover_art_url ? (
              <img src={session.cover_art_url} alt={session.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-16 h-16 text-primary/30" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {session.genre && <Badge variant="secondary">{session.genre}</Badge>}
                {session.mood && <Badge variant="outline">{session.mood}</Badge>}
                {session.tags?.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
              </div>
              <h1 className="text-3xl font-bold font-heading mb-2">{session.title}</h1>

              {creator && (
                <Link to={`/profile/${creator.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 w-fit">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{creator.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  {creator.full_name}
                </Link>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {session.bpm && <span>{session.bpm} BPM</span>}
                {session.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.duration_minutes} min</span>}
                <span>{tracks.length} tracks</span>
                <span>{session.play_count || 0} plays</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handlePlayAll} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" size="lg">
                {isCurrentSession && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                {isCurrentSession && isPlaying ? 'Pause' : 'Play All'}
              </Button>
              <Button variant="outline" size="icon" onClick={handleLike} className={hasLiked ? 'text-red-500 border-red-200' : ''} aria-label="Like">
                <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant={showSpotify ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowSpotify(s => !s)}
                className={showSpotify ? 'bg-[#1DB954] hover:bg-[#1DB954]/90 text-white border-0' : 'border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10'}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                {showSpotify ? 'Hide Spotify' : 'Stream on Spotify'}
              </Button>
              {isCurrentSession && isPlaying && <WaveVisualizer isPlaying barCount={8} />}
            </div>
          </div>
        </motion.div>

        {/* Spotify Player */}
        {showSpotify && (
          <div className="mb-4">
            <SpotifyPlayer searchQuery={session ? `${session.genre || ''} ${session.mood || ''} ${session.title}`.trim() : ''} />
          </div>
        )}

        {/* Social Share */}
        <div className="mb-4 p-4 rounded-2xl border border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Share this mix</p>
          <SocialShareButtons title={session.title} url={window.location.href} />
        </div>

        {/* Export to Services */}
        <div className="mb-4">
          <ExportToServices sessionTitle={session.title} sessionTags={session.tags} />
        </div>

        {/* Track List */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Tracks</h2>
          {tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tracks in this session</p>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <TrackCard key={track.id} track={track} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}