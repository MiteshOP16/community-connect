
-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, profile_id)
);

-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create follow_requests table
CREATE TABLE public.follow_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_requests;

-- Policies for Groups
CREATE POLICY "Groups are viewable by members" ON public.groups FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.groups.id AND profile_id = public.get_my_profile_id()
  )
);
CREATE POLICY "Anyone can create groups" ON public.groups FOR INSERT 
WITH CHECK (created_by = public.get_my_profile_id());

-- Policies for Group Members
CREATE POLICY "Group members are viewable by group members" ON public.group_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.group_members.group_id AND profile_id = public.get_my_profile_id()
  )
);
CREATE POLICY "Admins can add members" ON public.group_members FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.group_members.group_id 
    AND profile_id = public.get_my_profile_id() 
    AND role = 'admin'
  )
  OR 
  NOT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.group_members.group_id
  )
);

-- Policies for Group Messages
CREATE POLICY "Messages are viewable by group members" ON public.group_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.group_messages.group_id AND profile_id = public.get_my_profile_id()
  )
);
CREATE POLICY "Group members can send messages" ON public.group_messages FOR INSERT 
WITH CHECK (
  sender_id = public.get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = public.group_messages.group_id AND profile_id = public.get_my_profile_id()
  )
);

-- Policies for Follow Requests
CREATE POLICY "Users can view their own follow requests" ON public.follow_requests FOR SELECT 
USING (sender_id = public.get_my_profile_id() OR receiver_id = public.get_my_profile_id());

CREATE POLICY "Users can send follow requests" ON public.follow_requests FOR INSERT 
WITH CHECK (sender_id = public.get_my_profile_id());

CREATE POLICY "Receivers can update request status" ON public.follow_requests FOR UPDATE 
USING (receiver_id = public.get_my_profile_id());

-- Update follows policies to prevent manual bypass
DROP POLICY "Users can follow others" ON public.follows;
CREATE POLICY "Follows are system managed via requests" ON public.follows FOR INSERT WITH CHECK (false);

-- Trigger for Group Creator
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, profile_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_group_created
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- Trigger for Follow Request Acceptance
CREATE OR REPLACE FUNCTION public.handle_follow_request_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (NEW.sender_id, NEW.receiver_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_request_accepted
AFTER UPDATE ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request_acceptance();

-- Trigger for Updating Timestamps
CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_requests_updated_at
BEFORE UPDATE ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
