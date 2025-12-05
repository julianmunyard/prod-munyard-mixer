-- If you know which songs belong to an album, update them manually
-- Replace the values below with your actual data

-- Example: Update songs to have album_id
-- UPDATE songs 
-- SET 
--   album_id = 'f4693613-6192-4d02-b886-f6bc911bbc16',
--   album_title = 'Your Album Title',
--   album_slug = 'your-album-slug',
--   track_number = 1
-- WHERE id IN ('song-id-1', 'song-id-2', 'song-id-3');

-- Check which songs might be albums (created around the same time)
SELECT 
  id,
  title,
  artist_name,
  created_at,
  album_id,
  album_title
FROM songs
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

