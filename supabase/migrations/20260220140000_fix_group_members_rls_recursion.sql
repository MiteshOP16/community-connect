-- ============================================================
-- Fix: Infinite recursion in group_members RLS policies
-- ============================================================
-- ROOT CAUSE: RLS policies on group_members queried group_members
--   itself to check membership → PostgreSQL detects infinite loop.
-- FIX: Use SECURITY DEFINER functions that bypass RLS entirely.
--
-- ORDER:
--   1. DROP FUNCTION ... CASCADE  (kills all dependent policies automatically)
--   2. Drop any remaining unrelated policies
--   3. Recreate functions (SECURITY DEFINER)
--   4. Recreate policies
-- ============================================================

-- STEP 1: Drop functions WITH CASCADE — removes ALL dependent policies automatically
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.group_has_members(uuid) CASCADE;

-- STEP 2: Drop any remaining policies not tied to the above functions
DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add members"                      ON public.group_members;
DROP POLICY IF EXISTS "Members can view other members"             ON public.group_members;
DROP POLICY IF EXISTS "Group members can be added"                 ON public.group_members;
DROP POLICY IF EXISTS "Groups are viewable by members"             ON public.groups;
DROP POLICY IF EXISTS "Messages are viewable by group members"     ON public.group_messages;
DROP POLICY IF EXISTS "Group members can send messages"            ON public.group_messages;
DROP POLICY IF EXISTS "Members can view group messages"            ON public.group_messages;
DROP POLICY IF EXISTS "Members can send group messages"            ON public.group_messages;

-- STEP 3: Recreate helper functions with SECURITY DEFINER (bypasses RLS)

CREATE FUNCTION public.is_group_member(p_group_id UUID, p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND profile_id = p_profile_id
  );
$$;

CREATE FUNCTION public.is_group_admin(p_group_id UUID, p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND profile_id = p_profile_id AND role = 'admin'
  );
$$;

CREATE FUNCTION public.group_has_members(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group_id
  );
$$;

-- STEP 4: Recreate all policies using the safe helper functions

-- group_members
CREATE POLICY "Group members are viewable by group members"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id, public.get_my_profile_id()));

CREATE POLICY "Admins can add members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    public.is_group_admin(group_id, public.get_my_profile_id())
    OR NOT public.group_has_members(group_id)
  );

-- groups
CREATE POLICY "Groups are viewable by members"
  ON public.groups FOR SELECT
  USING (public.is_group_member(id, public.get_my_profile_id()));

-- group_messages
CREATE POLICY "Members can view group messages"
  ON public.group_messages FOR SELECT
  USING (public.is_group_member(group_id, public.get_my_profile_id()));

CREATE POLICY "Members can send group messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (
    sender_id = public.get_my_profile_id()
    AND public.is_group_member(group_id, public.get_my_profile_id())
  );
