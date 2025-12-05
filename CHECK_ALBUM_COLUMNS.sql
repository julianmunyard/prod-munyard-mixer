-- Diagnostic query to check if album columns exist
-- Run this in Supabase SQL Editor to verify

-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3')
ORDER BY column_name;

-- Check if any songs have album_id values
SELECT COUNT(*) as total_songs,
       COUNT(album_id) as songs_with_album_id,
       COUNT(*) - COUNT(album_id) as songs_without_album_id
FROM songs;

-- Show a sample of songs with album data
SELECT id, title, album_id, album_title, album_slug, track_number 
FROM songs 
WHERE album_id IS NOT NULL 
LIMIT 5;

