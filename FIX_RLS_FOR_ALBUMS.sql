-- Fix RLS policies to allow updating album columns
-- Run this in Supabase SQL Editor

-- Make sure users can update album_id, album_title, album_slug, track_number, demo_mp3
-- The existing "Users can update their own songs" policy should cover this, but let's verify

-- Check existing update policy
SELECT * FROM pg_policies WHERE tablename = 'songs' AND policyname LIKE '%update%';

-- If needed, create or update policy to allow updating album columns
-- Users should be able to update their own songs including album fields
-- This is usually already covered by a general "update own songs" policy

-- Grant explicit permissions (already done in CREATE_ALBUM_COLUMNS.sql, but let's do it again)
GRANT UPDATE (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;

-- Verify permissions
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3')
  AND grantee = 'authenticated';

