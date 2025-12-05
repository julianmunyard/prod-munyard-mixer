-- Add artwork_url column to songs table for album artwork support

-- Add the column
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS artwork_url TEXT;

-- Grant permissions
GRANT INSERT, UPDATE, SELECT ON songs TO authenticated;

-- Refresh schema cache
SELECT * FROM songs LIMIT 1;
NOTIFY pgrst, 'reload schema';

