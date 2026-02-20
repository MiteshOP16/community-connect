-- SIMPLER VERSION: If the main fix still causes recursion, use this instead
-- This removes the membership check from the SELECT policy entirely

-- Drop existing policies
DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;

-- Simple policy: Only allow viewing own membership or if you're the group creator
-- This means members won't see other members, but it avoids recursion completely
CREATE POLICY "Group members are viewable by group members" ON public.group_members
    FOR SELECT USING (
        -- User can see their own membership
        profile_id = public.get_my_profile_id()
        OR
        -- Group creator can see all members
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id
            AND g.created_by = public.get_my_profile_id()
        )
    );

-- Note: With this policy, group members won't see other members in the list
-- You'll need to handle member visibility at the application level or use a different approach

