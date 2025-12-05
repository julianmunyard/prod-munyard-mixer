-- Grant permissions on album columns
-- Run this in Supabase SQL Editor after creating the columns

-- Grant INSERT, UPDATE, and SELECT permissions on album columns
GRANT INSERT (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;
GRANT UPDATE (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;
GRANT SELECT (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;

-- Force PostgREST to reload schema cache
SELECT album_id, album_title, album_slug, track_number, demo_mp3 FROM songs LIMIT 1;

