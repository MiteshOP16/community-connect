import { supabase } from '@/integrations/supabase/client';

export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error && error.code !== '23505') throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function areMutualFollowers(profileId1: string, profileId2: string): Promise<boolean> {
  const [follows1, follows2] = await Promise.all([
    isFollowing(profileId1, profileId2),
    isFollowing(profileId2, profileId1),
  ]);
  return follows1 && follows2;
}

export async function getFollowStats(profileId: string): Promise<FollowStats> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profileId),
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profileId),
  ]);

  return {
    followers_count: followersRes.count || 0,
    following_count: followingRes.count || 0,
  };
}

export async function getFollowers(profileId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower:profiles!follows_follower_id_fkey(id, username, avatar_url, bio)
    `)
    .eq('following_id', profileId);

  if (error) throw error;
  return data.map(d => d.follower);
}

export async function getFollowing(profileId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following:profiles!follows_following_id_fkey(id, username, avatar_url, bio)
    `)
    .eq('follower_id', profileId);

  if (error) throw error;
  return data.map(d => d.following);
}

export async function getMutualFollowers(profileId: string) {
  const [followers, following] = await Promise.all([
    getFollowers(profileId),
    getFollowing(profileId),
  ]);

  const followingIds = new Set(following.map(f => f?.id));
  return followers.filter(f => f && followingIds.has(f.id));
}
