-- Create album columns in the songs table
-- Run this in Supabase SQL Editor

-- Add album_id column (UUID to identify which album a song belongs to)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_id UUID;

-- Add album_title column (the title of the album)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_title TEXT;

-- Add album_slug column (URL-friendly version of album title)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_slug TEXT;

-- Add track_number column (position of song in album, e.g. 1, 2, 3...)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS track_number INTEGER;

-- Add demo_mp3 column (URL to demo MP3 file for preview)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS demo_mp3 TEXT;

-- Grant permissions on album columns to authenticated users
GRANT INSERT (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;
GRANT UPDATE (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;
GRANT SELECT (album_id, album_title, album_slug, track_number, demo_mp3) ON songs TO authenticated;

-- Force PostgREST to reload schema cache by querying the columns
SELECT album_id, album_title, album_slug, track_number, demo_mp3 FROM songs LIMIT 1;

