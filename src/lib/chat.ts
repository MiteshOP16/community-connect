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
  unread_count?: number;
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
  console.log('[Chat] Fetching conversations for profile:', profileId);

  // First, fetch conversations - try both approaches
  // Approach 1: Using .or() filter
  let { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_1.eq.${profileId},user_2.eq.${profileId}`)
    .order('updated_at', { ascending: false });

  // If that fails, try separate queries
  if (convError || !conversations) {
    console.warn('[Chat] First query approach failed, trying alternative...');
    const { data: conv1, error: e1 } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_1', profileId)
      .order('updated_at', { ascending: false });
    
    const { data: conv2, error: e2 } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_2', profileId)
      .order('updated_at', { ascending: false });

    if (e1 || e2) {
      console.error('[Chat] Alternative queries also failed:', e1 || e2);
      convError = e1 || e2;
      conversations = null;
    } else {
      // Merge and deduplicate
      const allConvs = [...(conv1 || []), ...(conv2 || [])];
      const uniqueConvs = Array.from(
        new Map(allConvs.map(c => [c.id, c])).values()
      );
      conversations = uniqueConvs.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      convError = null;
    }
  }

  if (convError) {
    console.error('[Chat] Error fetching conversations:', convError);
    console.error('[Chat] Error details:', JSON.stringify(convError, null, 2));
    // Don't throw, return empty array to prevent breaking the UI
    return [];
  }

  if (!conversations || conversations.length === 0) {
    console.log('[Chat] No conversations found');
    return [];
  }

  console.log(`[Chat] Found ${conversations.length} conversations`);

  // Fetch profile data for all users in conversations
  const userIds = new Set<string>();
  conversations.forEach(conv => {
    userIds.add(conv.user_1);
    userIds.add(conv.user_2);
  });

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', Array.from(userIds));

  if (profilesError) {
    console.warn('[Chat] Error fetching profiles:', profilesError);
  }

  const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

  // Fetch last messages for each conversation
  const conversationIds = conversations.map(c => c.id);
  const { data: lastMessages, error: messagesError } = await supabase
    .from('messages')
    .select('id, conversation_id, content, created_at, sender_id')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (messagesError) {
    console.warn('[Chat] Error fetching messages:', messagesError);
  }

  // Group messages by conversation and get the last one
  const messagesByConv = new Map<string, any>();
  (lastMessages || []).forEach(msg => {
    if (!messagesByConv.has(msg.conversation_id)) {
      messagesByConv.set(msg.conversation_id, msg);
    }
  });

  // Fetch read statuses
  const { data: readStatuses, error: readError } = await supabase
    .from('chat_read_status')
    .select('conversation_id, last_read_at')
    .eq('profile_id', profileId)
    .in('conversation_id', conversationIds);

  if (readError) {
    console.warn('[Chat] Error fetching read statuses:', readError);
  }

  const readStatusMap = new Map((readStatuses || []).map(r => [r.conversation_id, r.last_read_at]));

  // Count unread messages for each conversation
  const unreadCounts = await Promise.all(
    conversations.map(async (conv) => {
      const lastReadAt = readStatusMap.get(conv.id) || '1970-01-01';
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .gt('created_at', lastReadAt)
        .neq('sender_id', profileId);
      return { convId: conv.id, count: count || 0 };
    })
  );

  const unreadMap = new Map(unreadCounts.map(u => [u.convId, u.count]));

  // Build the result - filter out conversations without other_user
  return conversations
    .map(conv => {
      const otherUserId = conv.user_1 === profileId ? conv.user_2 : conv.user_1;
      const otherUser = profilesMap.get(otherUserId) || null;
      const lastMessage = messagesByConv.get(conv.id) || null;

      // Skip if we don't have the other user's profile
      if (!otherUser) {
        console.warn(`[Chat] Missing profile for user ${otherUserId} in conversation ${conv.id}`);
        return null;
      }

      return {
        ...conv,
        other_user: {
          id: otherUser.id,
          username: otherUser.username,
          avatar_url: otherUser.avatar_url
        },
        last_message: lastMessage ? {
          id: lastMessage.id,
          conversation_id: lastMessage.conversation_id,
          sender_id: lastMessage.sender_id,
          content: lastMessage.content,
          created_at: lastMessage.created_at
        } : undefined,
        unread_count: unreadMap.get(conv.id) || 0
      } as Conversation;
    })
    .filter((conv): conv is Conversation => conv !== null);
}

export async function markAsRead(profileId: string, conversationId?: string, groupId?: string) {
  const payload: any = { profile_id: profileId, last_read_at: new Date().toISOString() };
  if (conversationId) payload.conversation_id = conversationId;
  if (groupId) payload.group_id = groupId;

  const { error } = await supabase
    .from('chat_read_status')
    .upsert(payload, {
      onConflict: conversationId ? 'profile_id,conversation_id' : 'profile_id,group_id'
    });

  if (error) console.error('[Chat] Error marking as read:', error);
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
