-- Run this in Supabase SQL Editor to verify RLS policies are working
-- Replace 'YOUR_PROFILE_ID' with an actual profile ID from your profiles table

-- 1. Check if get_my_profile_id() function works
SELECT public.get_my_profile_id() as my_profile_id;

-- 2. Test if you can see conversations (should return rows if you have conversations)
SELECT * FROM public.conversations 
WHERE user_1 = public.get_my_profile_id() OR user_2 = public.get_my_profile_id()
ORDER BY updated_at DESC;

-- 3. Test if you can see groups (should return rows if you're a member)
SELECT g.* FROM public.groups g
WHERE EXISTS (
  SELECT 1 FROM public.group_members gm
  WHERE gm.group_id = g.id AND gm.profile_id = public.get_my_profile_id()
)
ORDER BY updated_at DESC;

-- 4. Test if you can see group memberships
SELECT * FROM public.group_members
WHERE profile_id = public.get_my_profile_id();

-- 5. Check RLS policies on conversations
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'conversations';

-- 6. Check RLS policies on groups
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'groups';

-- 7. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('conversations', 'groups', 'messages', 'group_messages', 'group_members');

