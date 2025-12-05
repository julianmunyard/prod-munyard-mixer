-- ============================================
-- COMPLETE DATABASE SETUP FOR MUNYARD MIXER
-- ============================================
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- Make sure you're using the CORRECT Supabase project:
-- https://zrzsrzncikyfnndygolf.supabase.co
-- ============================================

-- ============================================
-- STEP 1: CREATE ALL COLUMNS (safe to run multiple times)
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

-- Add created_at column if it doesn't exist (timestamp for when song was created)
-- This is usually auto-created by Supabase, but let's ensure it exists
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- STEP 2: GRANT PERMISSIONS ON ALL COLUMNS
-- ============================================

-- Grant INSERT permissions on album columns to authenticated users
GRANT INSERT (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- Grant UPDATE permissions on album columns to authenticated users
GRANT UPDATE (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- Grant SELECT permissions on album columns to authenticated users
GRANT SELECT (album_id, album_title, album_slug, track_number, demo_mp3, artwork_url) ON songs TO authenticated;

-- Also grant general table-level permissions (backup)
GRANT ALL ON songs TO authenticated;

-- ============================================
-- STEP 3: FIX RLS (Row Level Security) POLICIES
-- ============================================

-- Drop existing update policy if it exists (to recreate it)
DROP POLICY IF EXISTS "Users can update their own songs" ON songs;

-- Create new policy that allows updating ALL columns including album fields
CREATE POLICY "Users can update their own songs"
ON songs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure insert policy allows inserting album fields
-- Check if insert policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'songs' 
    AND policyname = 'Users can insert their own songs'
  ) THEN
    CREATE POLICY "Users can insert their own songs"
    ON songs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure select policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'songs' 
    AND policyname = 'Users can view their own songs'
  ) THEN
    CREATE POLICY "Users can view their own songs"
    ON songs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- STEP 4: FORCE SCHEMA CACHE REFRESH
-- ============================================

-- Query the columns directly to force cache refresh
SELECT album_id, album_title, album_slug, track_number, demo_mp3, artwork_url 
FROM songs 
LIMIT 1;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 5: VERIFY EVERYTHING WAS CREATED
-- ============================================

-- Verify columns exist (including created_at which should already exist)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3', 'artwork_url', 'created_at')
ORDER BY column_name;

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'songs'
ORDER BY policyname;

-- Verify permissions on columns
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges 
WHERE table_name = 'songs' 
  AND column_name IN ('album_id', 'album_title', 'album_slug', 'track_number', 'demo_mp3', 'artwork_url')
  AND grantee = 'authenticated'
ORDER BY column_name, privilege_type;

-- ============================================
-- DONE! 
-- ============================================
-- After running this script:
-- 1. Go to Supabase Dashboard > Settings > API > RESTART PROJECT (if available)
-- 2. Wait 30-60 seconds for changes to propagate
-- 3. Restart your local dev server if it's running
-- 4. Try creating an album - it should work now!
-- ============================================
-- 
-- If you still get errors:
-- 1. Check the verification queries above - make sure all columns show up
-- 2. Check that all policies show up in the pg_policies query
-- 3. Check that authenticated role has permissions in column_privileges
-- 4. If columns don't show up, the table might have a different name
-- 5. If policies don't show up, RLS might be disabled (check Table Editor settings)
-- ============================================

