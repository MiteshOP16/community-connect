import { supabase } from '@/integrations/supabase/client';

export interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  post_type: 'text' | 'image' | 'blog';
  likes_count: number;
  shares_count: number;
  comments_count: number;
  created_at: string;
  author?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

export async function fetchPosts(limit = 50): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Post[];
}

export async function fetchUserPosts(profileId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, avatar_url)
    `)
    .eq('author_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Post[];
}

export async function createPost(authorId: string, content: string, postType: 'text' | 'image' | 'blog' = 'text', imageUrl?: string): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      content,
      post_type: postType,
      image_url: imageUrl || null,
    })
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as Post;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

export async function likePost(postId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .insert({ post_id: postId, user_id: profileId });

  if (error && error.code !== '23505') throw error; // Ignore duplicate key error
}

export async function unlikePost(postId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', profileId);

  if (error) throw error;
}

export async function checkIfLiked(postId: string, profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_author_id_fkey(id, username, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  
  // Organize into threads
  const comments = data as Comment[];
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  
  topLevel.forEach(comment => {
    comment.replies = replies.filter(r => r.parent_id === comment.id);
  });

  return topLevel;
}

export async function createComment(postId: string, authorId: string, content: string, parentId?: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_id: parentId || null,
    })
    .select(`
      *,
      author:profiles!comments_author_id_fkey(id, username, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as Comment;
}

export async function incrementShareCount(postId: string): Promise<void> {
  const { data: post } = await supabase
    .from('posts')
    .select('shares_count')
    .eq('id', postId)
    .single();
  
  if (post) {
    await supabase
      .from('posts')
      .update({ shares_count: post.shares_count + 1 })
      .eq('id', postId);
  }
}
