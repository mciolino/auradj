import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCheck, UserPlus, Music2, Disc3, Settings, Github, Sparkles } from 'lucide-react';
import ServiceBadges from '@/components/services/ServiceBadges';
import { Link } from 'react-router-dom';
import MixCard from '@/components/common/MixCard';
import GitHubPanel from '@/components/github/GitHubPanel';
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
  const [activeTab, setActiveTab] = useState('mixes');

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
          <div className="h-10 w-64 bg-secondary rounded-full animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-secondary rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 min-h-screen">
      {/* Hero banner */}
      <div className="relative h-32 sm:h-44 bg-gradient-to-br from-primary/30 via-purple-900/20 to-background overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.25),transparent_60%)]" />
        {/* Floating orbs */}
        <div className="absolute top-4 right-12 w-20 h-20 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute bottom-2 left-1/3 w-32 h-12 rounded-full bg-purple-500/10 blur-xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Avatar sits over the banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10 sm:-mt-12 mb-6">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-background shadow-xl">
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-2xl sm:text-3xl font-bold">
                {profileUser?.full_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          <div className="flex-1 min-w-0 pb-1">
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold font-heading"
            >
              {profileUser?.full_name || 'Unknown User'}
            </motion.h1>
            <p className="text-muted-foreground text-sm">{profileUser?.email || ''}</p>
            <ServiceBadges connectedServices={profileUser?.connected_services || {}} />
          </div>

          <div className="flex items-center gap-2 pb-1 self-end sm:self-auto">
            {isOwnProfile ? (
              <Link to="/services">
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <Settings className="w-4 h-4" /> Services
                </Button>
              </Link>
            ) : (
              <Button
                variant={isFollowing ? 'secondary' : 'default'}
                size="sm"
                className="gap-2 rounded-full"
                onClick={toggleFollow}
              >
                {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-6 mb-6 pb-6 border-b border-border/40"
        >
          {[
            { label: 'Mixes', value: sessions.length },
            { label: 'Followers', value: followerCount },
            { label: 'Following', value: followingCount },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-bold text-xl leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pb-24">
          <TabsList className="rounded-full bg-secondary/60 mb-6 p-1">
            <TabsTrigger value="mixes" className="rounded-full gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white px-4">
              <Disc3 className="w-3.5 h-3.5" /> Mixes
            </TabsTrigger>
            <TabsTrigger value="github" className="rounded-full gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white px-4">
              <Github className="w-3.5 h-3.5" /> GitHub
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="activity" className="rounded-full gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white px-4">
                <Sparkles className="w-3.5 h-3.5" /> Activity
              </TabsTrigger>
            )}
          </TabsList>

          {/* Mixes Tab */}
          <TabsContent value="mixes">
            {sessions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Music2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No public mixes yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {isOwnProfile
                    ? 'Create and publish a DJ session to show it here.'
                    : "This user hasn't published any mixes yet."}
                </p>
                {isOwnProfile && (
                  <Link to="/session">
                    <Button className="mt-5 rounded-full bg-primary hover:bg-primary/90 gap-2">
                      <Disc3 className="w-4 h-4" /> Start a Session
                    </Button>
                  </Link>
                )}
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {sessions.map((session, i) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                  >
                    <MixCard session={session} />
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* GitHub Tab */}
          <TabsContent value="github">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {!isOwnProfile ? (
                <div className="text-center py-20">
                  <Github className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">GitHub activity is private to each user.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Your GitHub</h2>
                    <p className="text-sm text-muted-foreground">Browse your repos and recent commits.</p>
                  </div>
                  <GitHubPanel />
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Activity Tab (own profile only) */}
          {isOwnProfile && (
            <TabsContent value="activity">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                <Sparkles className="w-12 h-12 text-primary/40 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Activity feed coming soon</h3>
                <p className="text-sm text-muted-foreground">Likes, follows, and DJ session history will live here.</p>
              </motion.div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
