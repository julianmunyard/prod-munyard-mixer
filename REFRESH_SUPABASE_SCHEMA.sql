-- Run this to force Supabase to refresh the schema cache
-- This MUST be run after creating columns

-- First, verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3');

-- Force PostgREST schema reload by querying the table
NOTIFY pgrst, 'reload schema';

-- Also query the columns to force cache refresh
SELECT album_id, album_title, album_slug, track_number, demo_mp3 FROM songs LIMIT 1;

-- Check permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'songs' 
  AND grantee = 'authenticated';

