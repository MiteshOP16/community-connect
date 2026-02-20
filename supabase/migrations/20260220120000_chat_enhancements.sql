-- Standard Chat System Improvements

-- 1. TRACK UNREAD MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, conversation_id),
    UNIQUE(profile_id, group_id)
);

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own read status" ON public.chat_read_status
    FOR ALL USING (profile_id = public.get_my_profile_id());

-- 2. ENHANCE RLS FOR CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations
    FOR SELECT USING (user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id());

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id());

-- 3. ENHANCE RLS FOR MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id
            AND (user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id())
        )
    );

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = public.get_my_profile_id() AND
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id
            AND (user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id())
        )
    );

-- 4. ENHANCE RLS FOR GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups are viewable by members" ON public.groups;
CREATE POLICY "Groups are viewable by members" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = groups.id AND profile_id = public.get_my_profile_id()
        )
    );

-- 5. ENHANCE RLS FOR GROUP MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;
CREATE POLICY "Members can view other members" ON public.group_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members AS m
            WHERE m.group_id = group_members.group_id AND m.profile_id = public.get_my_profile_id()
        )
    );

-- 6. ENHANCE RLS FOR GROUP MESSAGES
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group messages" ON public.group_messages;
CREATE POLICY "Members can view group messages" ON public.group_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = group_messages.group_id AND profile_id = public.get_my_profile_id()
        )
    );

DROP POLICY IF EXISTS "Members can send group messages" ON public.group_messages;
CREATE POLICY "Members can send group messages" ON public.group_messages
    FOR INSERT WITH CHECK (
        sender_id = public.get_my_profile_id() AND
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = group_messages.group_id AND profile_id = public.get_my_profile_id()
        )
    );
