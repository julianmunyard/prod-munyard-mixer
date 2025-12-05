-- Run this in Supabase SQL Editor to diagnose the album issue

-- 1. Check if album columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3')
ORDER BY column_name;

-- 2. Check if any songs have album_id values
SELECT 
  COUNT(*) as total_songs,
  COUNT(album_id) as songs_with_album_id,
  COUNT(*) - COUNT(album_id) as songs_without_album_id
FROM songs;

-- 3. Show sample songs and their album_id values
SELECT 
  id, 
  title, 
  album_id, 
  album_title, 
  album_slug, 
  track_number,
  created_at
FROM songs 
ORDER BY created_at DESC
LIMIT 10;

