-- Fix RLS policy to allow DELETE operations
-- Run this in Supabase SQL Editor

-- Check if delete policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'songs' 
  AND policyname LIKE '%delete%';

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own songs" ON songs;

-- Create DELETE policy that allows users to delete their own songs
CREATE POLICY "Users can delete their own songs"
ON songs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Verify the policy was created
SELECT * FROM pg_policies 
WHERE tablename = 'songs' 
  AND policyname = 'Users can delete their own songs';

-- Also verify all policies on songs table
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'songs';
