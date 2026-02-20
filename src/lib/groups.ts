import { supabase } from '@/integrations/supabase/client';

export interface Group {
    id: string;
    name: string;
    description: string | null;
    avatar_url: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    unread_count?: number;
}

export interface GroupMember {
    id: string;
    group_id: string;
    profile_id: string;
    role: 'member' | 'admin';
    joined_at: string;
    profile?: {
        id: string;
        username: string;
        avatar_url: string | null;
    };
}

export interface GroupMessage {
    id: string;
    group_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender?: {
        id: string;
        username: string;
        avatar_url: string | null;
    };
}

export async function getGroups(profileId: string): Promise<Group[]> {
    // Fetch group memberships first
    const { data: memberships, error: memError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', profileId);

    if (memError) {
        console.error('[Groups] Error fetching memberships:', memError);
        console.error('[Groups] Error details:', JSON.stringify(memError, null, 2));
        return [];
    }

    if (!memberships || memberships.length === 0) {
        console.log('[Groups] No group memberships found');
        return [];
    }

    // Fetch groups
    const groupIds = memberships.map(m => m.group_id);
    const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('updated_at', { ascending: false });

    if (groupsError) {
        console.error('[Groups] Error fetching groups:', groupsError);
        console.error('[Groups] Error details:', JSON.stringify(groupsError, null, 2));
        return [];
    }

    if (!groups || groups.length === 0) {
        return [];
    }

    // Fetch all read statuses for this user for groups
    const { data: readStatuses } = await supabase
        .from('chat_read_status')
        .select('group_id, last_read_at')
        .eq('profile_id', profileId)
        .in('group_id', groupIds)
        .is('conversation_id', null);

    const readStatusMap = new Map((readStatuses || []).map(r => [r.group_id, r.last_read_at]));

    // For each group, fetch unread count
    const groupsWithUnread = await Promise.all((groups || []).map(async (group) => {
        const lastRead = readStatusMap.get(group.id) || '1970-01-01';

        const { count } = await supabase
            .from('group_messages')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .gt('created_at', lastRead)
            .neq('sender_id', profileId);

        return {
            ...group,
            unread_count: count || 0
        };
    }));

    return groupsWithUnread;
}

export async function createGroup(name: string, createdBy: string, description?: string, avatarUrl?: string): Promise<Group> {
    const { data, error } = await supabase
        .from('groups')
        .insert({
            name,
            created_by: createdBy,
            description: description || '',
            avatar_url: avatarUrl || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data as Group;
}

export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
    const { data, error } = await supabase
        .from('group_messages')
        .select(`
            *,
            sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data as GroupMessage[];
}

export async function sendGroupMessage(groupId: string, senderId: string, content: string): Promise<GroupMessage> {
    const { data, error } = await supabase
        .from('group_messages')
        .insert({
            group_id: groupId,
            sender_id: senderId,
            content,
        })
        .select(`
            *,
            sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)
        `)
        .single();

    if (error) throw error;
    return data as GroupMessage;
}

export function subscribeToGroupMessages(groupId: string, onMessage: (message: GroupMessage) => void) {
    return supabase
        .channel(`group:${groupId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'group_messages',
                filter: `group_id=eq.${groupId}`,
            },
            async (payload) => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .eq('id', payload.new.sender_id)
                    .single();

                if (!error && data) {
                    onMessage({
                        ...payload.new as GroupMessage,
                        sender: data,
                    });
                }
            }
        )
        .subscribe();
}

export async function addGroupMember(groupId: string, profileId: string, role: 'member' | 'admin' = 'member') {
    const { error } = await supabase
        .from('group_members')
        .insert({
            group_id: groupId,
            profile_id: profileId,
            role,
        });

    if (error) throw error;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await supabase
        .from('group_members')
        .select(`
            *,
            profile:profiles(id, username, avatar_url)
        `)
        .eq('group_id', groupId);

    if (error) throw error;
    return data as any[];
}
