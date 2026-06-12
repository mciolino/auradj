import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCheck, UserPlus, Music2, Disc3, Settings } from 'lucide-react';
import ServiceBadges from '@/components/services/ServiceBadges';
import { Link } from 'react-router-dom';
import MixCard from '@/components/common/MixCard';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Profile() {
  const { userId } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [me, users, userSessions, followers, following] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.User.filter({ id: userId }),
        base44.entities.DJSession.filter({ created_by_id: userId, is_public: true, is_saved: true }, '-updated_date', 20),
        base44.entities.Follow.filter({ following_id: userId }),
        base44.entities.Follow.filter({ follower_id: userId }),
      ]);

      setCurrentUser(me);
      setProfileUser(users[0] || null);
      setSessions(userSessions);
      setFollowerCount(followers.length);
      setFollowingCount(following.length);

      if (me && userId !== me.id) {
        const myFollow = followers.find(f => f.follower_id === me.id);
        setIsFollowing(!!myFollow);
      }

      setLoading(false);
    };
    load();
  }, [userId]);

  const toggleFollow = async () => {
    if (!currentUser) { toast.error('Sign in to follow users'); return; }
    if (isFollowing) {
      const follows = await base44.entities.Follow.filter({ follower_id: currentUser.id, following_id: userId });
      if (follows[0]) await base44.entities.Follow.delete(follows[0].id);
      setIsFollowing(false);
      setFollowerCount(c => c - 1);
      toast.success('Unfollowed');
    } else {
      await base44.entities.Follow.create({ follower_id: currentUser.id, following_id: userId });
      setIsFollowing(true);
      setFollowerCount(c => c + 1);
      toast.success('Following!');
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  if (loading) {
    return (
      <div className="pt-14 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-secondary animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-40 bg-secondary rounded animate-pulse" />
              <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
          <Avatar className="w-20 h-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {profileUser?.full_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-heading">{profileUser?.full_name || 'Unknown User'}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{profileUser?.email || ''}</p>

            <ServiceBadges connectedServices={profileUser?.connected_services || {}} />

            <div className="flex items-center gap-5 mt-3">
              <div className="text-center">
                <p className="font-bold text-lg leading-none">{sessions.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Mixes</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg leading-none">{followerCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg leading-none">{followingCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Following</p>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <Link to="/services">
              <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                <Settings className="w-4 h-4" /> Services
              </Button>
            </Link>
          )}
          {!isOwnProfile && (
            <Button
              variant={isFollowing ? 'secondary' : 'default'}
              className="gap-2 flex-shrink-0"
              onClick={toggleFollow}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </motion.div>

        {/* Mixes */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-primary" />
            Public Mixes
          </h2>

          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-1">No public mixes yet</h3>
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? 'Create and publish a DJ session to show it here.' : 'This user hasn\'t published any mixes yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {sessions.map((session, i) => (
                <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <MixCard session={session} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}