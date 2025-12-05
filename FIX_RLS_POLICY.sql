-- Fix RLS policy to allow updating album_id column
-- Run this in Supabase SQL Editor

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own songs" ON songs;

-- Create new policy that allows updating ALL columns including album_id
CREATE POLICY "Users can update their own songs"
ON songs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Users can update their own songs';

