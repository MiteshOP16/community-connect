import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, UserMinus, MessageCircle, Loader2 } from 'lucide-react';
import { Profile, getProfile } from '@/lib/profiles';
import { getFollowStats, isFollowing, followUser, unfollowUser, areMutualFollowers, FollowStats } from '@/lib/follows';
import { fetchUserPosts, Post } from '@/lib/posts';
import { getOrCreateConversation } from '@/lib/chat';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PostCard } from '@/components/feed/PostCard';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileViewProps {
  profileId: string;
}

export function ProfileView({ profileId }: ProfileViewProps) {
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [stats, setStats] = useState<FollowStats>({ followers_count: 0, following_count: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === profileId;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profile, followStats, userPosts] = await Promise.all([
          getProfile(profileId),
          getFollowStats(profileId),
          fetchUserPosts(profileId),
        ]);

        setProfileData(profile);
        setStats(followStats);
        setPosts(userPosts);

        if (currentUser && !isOwnProfile) {
          const [isFollow, isMutual] = await Promise.all([
            isFollowing(currentUser.id, profileId),
            areMutualFollowers(currentUser.id, profileId),
          ]);
          setFollowing(isFollow);
          setCanMessage(isMutual);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [profileId, currentUser, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser || isFollowLoading) return;
    setIsFollowLoading(true);

    try {
      if (following) {
        await unfollowUser(currentUser.id, profileId);
        setFollowing(false);
        setStats((s) => ({ ...s, followers_count: s.followers_count - 1 }));
        toast.success('Unfollowed');
      } else {
        await followUser(currentUser.id, profileId);
        setFollowing(true);
        setStats((s) => ({ ...s, followers_count: s.followers_count + 1 }));
        toast.success('Following');
      }

      // Check if mutual now
      const isMutual = await areMutualFollowers(currentUser.id, profileId);
      setCanMessage(isMutual);
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !profileData) return;

    try {
      const conversation = await getOrCreateConversation(currentUser.id, profileId);
      navigate('/messages', { state: { conversationId: conversation.id, otherUser: profileData } });
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to start conversation');
    }
  };

  const handlePostDeleted = () => {
    setPosts((prev) => prev.filter((p) => p.author_id !== currentUser?.id));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <Card className="glass-card p-8 text-center">
        <p className="text-muted-foreground">User not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass-card overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/20 to-accent/20" />
          <div className="relative px-6 pb-6">
            <Avatar className="absolute -top-12 h-24 w-24 border-4 border-card">
              <AvatarImage src={profileData.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profileData.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="ml-28 pt-2">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-foreground">@{profileData.username}</h1>
                  {profileData.bio && (
                    <p className="mt-1 text-muted-foreground">{profileData.bio}</p>
                  )}
                </div>

                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <Button
                      variant={following ? 'secondary' : 'default'}
                      onClick={handleFollowToggle}
                      disabled={isFollowLoading}
                      className="gap-2"
                    >
                      {isFollowLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : following ? (
                        <UserMinus className="h-4 w-4" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      {following ? 'Unfollow' : 'Follow'}
                    </Button>

                    {canMessage && (
                      <Button variant="outline" onClick={handleMessage} className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{posts.length}</p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{stats.followers_count}</p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{stats.following_count}</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Posts</h2>
        {posts.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No posts yet</p>
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
          ))
        )}
      </div>
    </div>
  );
}
