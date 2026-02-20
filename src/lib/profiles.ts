import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  github_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(profileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function searchProfiles(query: string, limit = 10): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data as Profile[];
}

export async function updateProfile(profileId: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}
export async function getRecommendedProfiles(currentProfileId: string, limit = 50): Promise<Profile[]> {
  console.log('[Profiles] Getting recommendations for:', currentProfileId);

  // Basic query: just get profiles that aren't the current user
  // The Connect page will do more advanced filtering (sent requests, already following, etc.)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', currentProfileId)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Profiles] Recommendations query error:', error);
    throw error;
  }

  console.log('[Profiles] Found profiles:', data?.length || 0);
  return data as Profile[];
}
