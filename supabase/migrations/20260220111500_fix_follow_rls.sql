-- Improve RLS for follow_requests to allow re-sending requests
CREATE POLICY "Senders can update their own rejected/pending requests" ON public.follow_requests FOR UPDATE
USING (sender_id = public.get_my_profile_id())
WITH CHECK (sender_id = public.get_my_profile_id() AND status = 'pending');

-- Ensure everyone can see profile stats or similar if needed (though already true)
-- Ensure follows select is truly open
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
