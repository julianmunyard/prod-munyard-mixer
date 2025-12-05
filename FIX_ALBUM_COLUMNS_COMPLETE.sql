-- COMPLETE FIX for album columns
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Create columns if they don't exist
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_id TEXT;

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_title TEXT;

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS album_slug TEXT;

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS track_number INTEGER;

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS demo_mp3 TEXT;

-- Step 2: Grant ALL permissions
GRANT ALL ON songs TO authenticated;
GRANT INSERT, UPDATE, SELECT ON songs TO authenticated;

-- Step 3: Force schema cache refresh by selecting from the table
SELECT album_id, album_title, album_slug, track_number, demo_mp3 FROM songs LIMIT 1;

-- Step 4: Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3');

-- Step 5: Check current state
SELECT COUNT(*) as total_songs, COUNT(album_id) as songs_with_album_id FROM songs;

