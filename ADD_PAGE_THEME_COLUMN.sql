-- Add page_theme column to songs table
-- This column stores the theme preference (TERMINAL THEME or OLD COMPUTER) for album pages

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS page_theme TEXT 
CHECK (page_theme IN ('TERMINAL THEME', 'OLD COMPUTER') OR page_theme IS NULL);

-- Add comment to document the column
COMMENT ON COLUMN songs.page_theme IS 'Theme preference for album create/edit pages: TERMINAL THEME or OLD COMPUTER';

