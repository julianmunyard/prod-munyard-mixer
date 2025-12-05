-- Grant permissions on album columns to authenticated users
-- Run this in Supabase SQL Editor

-- Grant INSERT and UPDATE permissions on album columns
GRANT INSERT (album_id, album_title, album_slug, track_number) ON songs TO authenticated;
GRANT UPDATE (album_id, album_title, album_slug, track_number) ON songs TO authenticated;

-- Also ensure the columns are visible to PostgREST
-- This forces PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';

