-- Fix missing recipe images
-- Update recipes that might be missing image URLs

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80'
WHERE title = 'Garlic Butter Shrimp Pasta' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1571490004784-ddd2f34055bf?w=800&q=80'
WHERE title = 'Homemade Hummus with Veggie Sticks' 
AND (image_url IS NULL OR image_url = '');

-- Add default images for other common recipes that might be missing images
UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
WHERE title ILIKE '%salad%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80'
WHERE title ILIKE '%burger%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80'
WHERE title ILIKE '%pizza%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80'
WHERE title ILIKE '%pancake%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80'
WHERE title ILIKE '%toast%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
WHERE title ILIKE '%vegetable%' OR title ILIKE '%veggie%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80'
WHERE title ILIKE '%burrito%' OR title ILIKE '%taco%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1476124369491-f61c9f024fbb?w=800&q=80'
WHERE title ILIKE '%stir%fry%' OR title ILIKE '%stirfry%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80'
WHERE title ILIKE '%soup%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80'
WHERE title ILIKE '%pasta%' AND title NOT ILIKE '%shrimp%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80'
WHERE title ILIKE '%chicken%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'
WHERE title ILIKE '%salmon%' OR title ILIKE '%fish%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&q=80'
WHERE title ILIKE '%brownie%' OR title ILIKE '%chocolate%'
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=800&q=80'
WHERE title ILIKE '%cookie%' 
AND (image_url IS NULL OR image_url = '');

UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=800&q=80'
WHERE title ILIKE '%breakfast%' OR title ILIKE '%oatmeal%'
AND (image_url IS NULL OR image_url = '');

-- Set a generic food image for any remaining recipes without images
UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'
WHERE image_url IS NULL OR image_url = '';

