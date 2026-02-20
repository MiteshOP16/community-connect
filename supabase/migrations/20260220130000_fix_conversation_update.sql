-- Add missing UPDATE policy for conversations to allow updating updated_at
CREATE POLICY "Users can update their own conversations" ON public.conversations
    FOR UPDATE USING (user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id());
