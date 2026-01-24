import { supabase } from '@/integrations/supabase/client';

export interface Conversation {
  id: string;
  user_1: string;
  user_2: string;
  created_at: string;
  updated_at: string;
  other_user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export async function getConversations(profileId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user_1_fkey(id, username, avatar_url),
      user2:profiles!conversations_user_2_fkey(id, username, avatar_url)
    `)
    .or(`user_1.eq.${profileId},user_2.eq.${profileId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data as any[]).map(conv => ({
    ...conv,
    other_user: conv.user_1 === profileId ? conv.user2 : conv.user1,
  }));
}

export async function getOrCreateConversation(user1: string, user2: string): Promise<Conversation> {
  // Ensure consistent ordering (user_1 < user_2)
  const [sortedUser1, sortedUser2] = user1 < user2 ? [user1, user2] : [user2, user1];

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_1', sortedUser1)
    .eq('user_2', sortedUser2)
    .maybeSingle();

  if (existing) return existing as Conversation;

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_1: sortedUser1, user_2: sortedUser2 })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    })
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, avatar_url)
    `)
    .single();

  if (error) throw error;

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export function subscribeToMessages(conversationId: string, callback: (message: Message) => void) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        // Fetch full message with sender info
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(id, username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();
        
        if (data) callback(data as Message);
      }
    )
    .subscribe();
}
