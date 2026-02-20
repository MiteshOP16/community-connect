-- Fix infinite recursion in group_members RLS policy and ensure table structure is correct
-- Run this in Supabase SQL Editor

-- 1. First, check and diagnose the table structure
-- Check what columns actually exist in group_members
DO $$
DECLARE
    col_name TEXT;
    has_profile_id BOOLEAN := FALSE;
BEGIN
    -- Check if profile_id exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'group_members' 
        AND column_name = 'profile_id'
    ) INTO has_profile_id;
    
    IF NOT has_profile_id THEN
        RAISE NOTICE 'Column profile_id does not exist. Checking for alternative column names...';
        
        -- Check for common alternatives
        SELECT column_name INTO col_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'group_members' 
        AND column_name IN ('user_id', 'member_id', 'user_profile_id')
        LIMIT 1;
        
        IF col_name IS NOT NULL THEN
            RAISE NOTICE 'Found column: %. Renaming to profile_id...', col_name;
            EXECUTE format('ALTER TABLE public.group_members RENAME COLUMN %I TO profile_id', col_name);
        ELSE
            RAISE NOTICE 'No alternative column found. Adding profile_id column...';
            ALTER TABLE public.group_members 
            ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
            
            -- If there's existing data, you might need to populate it
            -- This assumes there's a user_id or similar column to migrate from
            RAISE NOTICE 'Please verify the profile_id column was added correctly.';
        END IF;
    ELSE
        RAISE NOTICE 'Column profile_id exists. Proceeding...';
    END IF;
END $$;

-- Show the final table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'group_members'
ORDER BY ordinal_position;

-- 2. Drop existing functions if they exist (in case they have different signatures)
-- Find and drop all variants of these functions
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Drop all variants of is_group_member
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND proname = 'is_group_member'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.argtypes || ') CASCADE';
    END LOOP;
    
    -- Drop all variants of is_group_admin
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND proname = 'is_group_admin'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.argtypes || ') CASCADE';
    END LOOP;
END $$;

-- 3. Ensure profile_id column exists before creating functions
-- Double-check and add if still missing (in case the DO block didn't complete)
ALTER TABLE public.group_members 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Create helper functions to check membership and admin status without triggering RLS recursion
-- These functions use SECURITY DEFINER to run as the function owner (bypassing RLS)
-- The function owner should be a superuser or the table owner to truly bypass RLS
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID, profile_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This query runs with the privileges of the function owner, bypassing RLS
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_uuid AND profile_id = profile_uuid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_uuid UUID, profile_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This query runs with the privileges of the function owner, bypassing RLS
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_uuid 
    AND profile_id = profile_uuid
    AND role = 'admin'
  )
$$;

-- 5. Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can view other members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group members can be added" ON public.group_members;

-- 6. Create a fixed SELECT policy that avoids recursion
-- IMPORTANT: If you still get recursion errors, the function owner may not have proper privileges
-- In that case, use the simpler policy below (commented out) that doesn't check membership
CREATE POLICY "Group members are viewable by group members" ON public.group_members
    FOR SELECT USING (
        -- User can always see their own membership (no recursion - direct comparison)
        profile_id = public.get_my_profile_id()
        OR
        -- Group creator can see all members (no recursion - queries groups table, not group_members)
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id
            AND g.created_by = public.get_my_profile_id()
        )
        OR
        -- Check if user is a member using helper function (should bypass RLS if function owner has privileges)
        -- If this still causes recursion, comment out this line and use the simpler policy below
        public.is_group_member(group_members.group_id, public.get_my_profile_id())
    );

-- ALTERNATIVE SIMPLER POLICY (uncomment if above still causes recursion):
-- This allows members to see other members only if they can see the group (via groups RLS)
-- DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
-- CREATE POLICY "Group members are viewable by group members" ON public.group_members
--     FOR SELECT USING (
--         profile_id = public.get_my_profile_id()
--         OR
--         EXISTS (
--             SELECT 1 FROM public.groups g
--             WHERE g.id = group_members.group_id
--             AND g.created_by = public.get_my_profile_id()
--         )
--         -- Members can see other members if they can see the group (groups RLS enforces membership)
--         -- This relies on groups table RLS, which might also query group_members, so test carefully
--     );

-- 7. Create INSERT policy that allows:
-- - Group creators to add members (even if group is empty)
-- - Admins to add members (using helper function to avoid recursion)
-- - The trigger will handle adding the creator automatically
CREATE POLICY "Group members can be added" ON public.group_members
    FOR INSERT WITH CHECK (
        -- Group creator can always add members
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id
            AND g.created_by = public.get_my_profile_id()
        )
        OR
        -- Admin can add members (using helper function to avoid recursion)
        public.is_group_admin(group_members.group_id, public.get_my_profile_id())
    );

-- 8. Verify the trigger exists to auto-add creator as admin
-- This should already exist from the migration, but let's ensure it's there
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, profile_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (group_id, profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- 9. Test query to verify it works (uncomment to test)
-- SELECT * FROM public.group_members LIMIT 1;

