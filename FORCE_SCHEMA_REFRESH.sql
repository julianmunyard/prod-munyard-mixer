-- FORCE PostgREST to refresh schema cache
-- Run this in Supabase SQL Editor

-- Method 1: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Method 2: Query the columns directly to force cache refresh
SELECT album_id, album_title, album_slug, track_number, demo_mp3 
FROM songs 
LIMIT 1;

-- Method 3: Force a schema reload by querying information_schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3');

-- After running this, RESTART YOUR SUPABASE PROJECT (in Supabase dashboard, go to Settings > General > Restart project)
-- Then restart your local dev server

