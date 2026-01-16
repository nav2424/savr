-- Enable Realtime for Recipes Tables
-- Run this SQL in your Supabase SQL Editor to enable live updates

-- Add recipes table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;

-- Add saved_recipes table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_recipes;

-- Add recipe_collections table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_collections;

-- Verify realtime is enabled (optional check)
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- SUCCESS! Realtime is now enabled for all recipe tables
-- Changes will sync instantly across all devices

