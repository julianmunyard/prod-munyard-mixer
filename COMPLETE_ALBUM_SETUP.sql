-- ============================================
-- COMPLETE ALBUM SETUP - RUN THIS ENTIRE SCRIPT
-- ============================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- Make sure you're in the CORRECT Supabase project!
-- ============================================

-- ============================================
-- STEP 1: CREATE THE COLUMNS
-- ============================================

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

-- Add artwork_url column (URL to artwork image for album songs)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS artwork_url TEXT;

-- ============================================
-- STEP 2: GRANT PERMISSIONS
-- ============================================

-- Grant INSERT permissions on album columns to authenticated users
GRANT INSERT (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- Grant UPDATE permissions on album columns to authenticated users
GRANT UPDATE (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- Grant SELECT permissions on album columns to authenticated users
GRANT SELECT (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- ============================================
-- STEP 3: FIX RLS POLICY
-- ============================================

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own songs" ON songs;

-- Create new policy that allows updating ALL columns including album_id
CREATE POLICY "Users can update their own songs"
ON songs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- STEP 4: FORCE SCHEMA CACHE REFRESH
-- ============================================

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Query the columns directly to force cache refresh
SELECT album_id, album_title, album_slug, track_number, demo_mp3, artwork_url 
FROM songs 
LIMIT 1;

-- Query information_schema to verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3', 'artwork_url');

-- ============================================
-- STEP 5: VERIFY EVERYTHING WORKED
-- ============================================

-- Verify the update policy was created
SELECT * FROM pg_policies 
WHERE tablename = 'songs' 
  AND policyname = 'Users can update their own songs';

-- Verify permissions
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3', 'artwork_url')
  AND grantee = 'authenticated';

-- ============================================
-- DONE! 
-- ============================================
-- After running this:
-- 1. Go to Supabase Dashboard > Settings > General > RESTART YOUR PROJECT
-- 2. Wait 30 seconds for it to restart
-- 3. Restart your local dev server (Ctrl+C, then npm run dev)
-- 4. Try creating an album again
-- ============================================

