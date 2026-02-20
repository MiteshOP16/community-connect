-- Add delete policy for follow_requests
CREATE POLICY "Users can delete their own sent follow requests" ON public.follow_requests FOR DELETE 
USING (sender_id = public.get_my_profile_id());

-- Add delete policy for receivers to reject/delete
CREATE POLICY "Receivers can delete follow requests" ON public.follow_requests FOR DELETE 
USING (receiver_id = public.get_my_profile_id());
