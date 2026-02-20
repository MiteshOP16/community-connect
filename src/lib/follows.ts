import { supabase } from '@/integrations/supabase/client';

export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export interface FollowRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
  };
}

export async function sendFollowRequest(senderId: string, receiverId: string): Promise<void> {
  console.log('[Follow] Attempting to send/update request:', { from: senderId, to: receiverId });

  const { error } = await supabase
    .from('follow_requests')
    .upsert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending'
    }, {
      onConflict: 'sender_id,receiver_id'
    });

  if (error) {
    console.error('[Follow] Supabase Error:', error);
    throw error;
  }
}

export async function getFollowRequests(profileId: string): Promise<FollowRequest[]> {
  console.log('[Follow] Fetching incoming requests for', profileId);
  const { data, error } = await supabase
    .from('follow_requests')
    .select(`
      *,
      sender:profiles!follow_requests_sender_id_fkey(id, username, avatar_url)
    `)
    .eq('receiver_id', profileId)
    .eq('status', 'pending');

  if (error) {
    console.error('[Follow] Error fetching incoming requests:', error);
    throw error;
  }
  return (data || []).map(r => ({
    ...r,
    status: r.status as 'pending' | 'accepted' | 'rejected'
  }));
}

export async function getSentRequests(profileId: string): Promise<FollowRequest[]> {
  console.log('[Follow] Fetching sent requests for', profileId);
  const { data, error } = await supabase
    .from('follow_requests')
    .select(`
      *,
      receiver:profiles!follow_requests_receiver_id_fkey(id, username, avatar_url, bio)
    `)
    .eq('sender_id', profileId)
    .eq('status', 'pending');

  if (error) {
    console.error('[Follow] Error fetching sent requests:', error);
    throw error;
  }
  return (data || []).map(r => ({
    ...r,
    status: r.status as 'pending' | 'accepted' | 'rejected'
  }));
}

export async function handleFollowRequest(requestId: string, status: 'accepted' | 'rejected'): Promise<void> {
  console.log('[Follow] Handling request', requestId, 'as', status);
  const { error } = await supabase
    .from('follow_requests')
    .update({ status })
    .eq('id', requestId);

  if (error) {
    console.error('[Follow] Error updating request status:', error);
    throw error;
  }
}

export async function getPendingRequest(senderId: string, receiverId: string): Promise<FollowRequest | null> {
  const { data, error } = await supabase
    .from('follow_requests')
    .select('*')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    status: data.status as 'pending' | 'accepted' | 'rejected'
  };
}

export async function cancelFollowRequest(senderId: string, receiverId: string): Promise<void> {
  console.log('[Follow] Cancelling request from', senderId, 'to', receiverId);
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending');

  if (error) {
    console.error('[Follow] Error cancelling request:', error);
    throw error;
  }
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  return sendFollowRequest(followerId, followingId);
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  console.log('[Follow] Unfollowing', followingId, 'as', followerId);
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw error;

  // Also clear any accepted requests to keep it clean
  await supabase
    .from('follow_requests')
    .delete()
    .eq('sender_id', followerId)
    .eq('receiver_id', followingId);
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
