-- Add Snacks & Desserts (4 recipes)
-- Run this in Supabase SQL Editor

INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
-- Hummus
(
  'Homemade Hummus with Veggie Sticks',
  'Creamy homemade hummus perfect for dipping fresh vegetables.',
  'https://images.unsplash.com/photo-1571490004784-ddd2f34055bf?w=800&q=80',
  10, 0, 4, 'Easy',
  'Mediterranean', 'snack',
  '[
    {"name": "Chickpeas", "quantity": "1", "unit": "can"},
    {"name": "Tahini", "quantity": "3", "unit": "tbsp"},
    {"name": "Lemon juice", "quantity": "2", "unit": "tbsp"},
    {"name": "Garlic", "quantity": "2", "unit": "cloves"},
    {"name": "Olive oil", "quantity": "2", "unit": "tbsp"},
    {"name": "Carrots", "quantity": "3", "unit": "pieces"},
    {"name": "Cucumber", "quantity": "1", "unit": "piece"},
    {"name": "Bell peppers", "quantity": "2", "unit": "pieces"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Drain chickpeas, reserving liquid"},
    {"step": 2, "description": "Blend chickpeas, tahini, lemon juice, garlic, and olive oil"},
    {"step": 3, "description": "Add reserved liquid if needed for consistency"},
    {"step": 4, "description": "Cut vegetables into sticks"},
    {"step": 5, "description": "Serve hummus with veggie sticks"}
  ]'::jsonb,
  180, 6, 22, 9,
  ARRAY['vegan', 'healthy', 'snack', 'no-cook'],
  'curated', true
),
-- Energy Balls
(
  'No-Bake Energy Balls',
  'Healthy energy bites perfect for a quick snack.',
  'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&q=80',
  15, 0, 12, 'Easy',
  'American', 'snack',
  '[
    {"name": "Dates", "quantity": "1", "unit": "cup"},
    {"name": "Almonds", "quantity": "1", "unit": "cup"},
    {"name": "Oats", "quantity": "1/2", "unit": "cup"},
    {"name": "Cocoa powder", "quantity": "2", "unit": "tbsp"},
    {"name": "Honey", "quantity": "2", "unit": "tbsp"},
    {"name": "Vanilla extract", "quantity": "1", "unit": "tsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Blend dates and almonds in food processor"},
    {"step": 2, "description": "Add oats, cocoa powder, honey, and vanilla"},
    {"step": 3, "description": "Pulse until mixture sticks together"},
    {"step": 4, "description": "Roll into 1-inch balls"},
    {"step": 5, "description": "Refrigerate for 30 minutes before serving"}
  ]'::jsonb,
  120, 3, 18, 5,
  ARRAY['healthy', 'snack', 'no-bake', 'energy'],
  'curated', true
),
-- Chocolate Brownies
(
  'Fudgy Chocolate Brownies',
  'Rich, fudgy brownies with a perfectly crisp top.',
  'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=800&q=80',
  15, 30, 16, 'Easy',
  'American', 'dessert',
  '[
    {"name": "Butter", "quantity": "1", "unit": "cup"},
    {"name": "Sugar", "quantity": "2", "unit": "cups"},
    {"name": "Eggs", "quantity": "4", "unit": "pieces"},
    {"name": "Cocoa powder", "quantity": "3/4", "unit": "cup"},
    {"name": "Flour", "quantity": "1", "unit": "cup"},
    {"name": "Vanilla extract", "quantity": "1", "unit": "tsp"},
    {"name": "Chocolate chips", "quantity": "1", "unit": "cup"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Preheat oven to 350°F (175°C)"},
    {"step": 2, "description": "Melt butter and mix with sugar"},
    {"step": 3, "description": "Beat in eggs and vanilla"},
    {"step": 4, "description": "Sift in cocoa powder and flour, mix until combined"},
    {"step": 5, "description": "Fold in chocolate chips"},
    {"step": 6, "description": "Pour into greased 9x13 pan"},
    {"step": 7, "description": "Bake for 25-30 minutes until set"}
  ]'::jsonb,
  320, 5, 42, 16,
  ARRAY['dessert', 'chocolate', 'baking', 'sweet'],
  'curated', true
),
-- Fruit Salad
(
  'Refreshing Summer Fruit Salad',
  'A colorful mix of fresh seasonal fruits with honey-lime dressing.',
  'https://images.unsplash.com/photo-1564093497595-593b96d80180?w=800&q=80',
  15, 0, 6, 'Easy',
  'American', 'dessert',
  '[
    {"name": "Strawberries", "quantity": "2", "unit": "cups"},
    {"name": "Blueberries", "quantity": "1", "unit": "cup"},
    {"name": "Mango", "quantity": "1", "unit": "piece"},
    {"name": "Pineapple", "quantity": "2", "unit": "cups"},
    {"name": "Grapes", "quantity": "1", "unit": "cup"},
    {"name": "Honey", "quantity": "2", "unit": "tbsp"},
    {"name": "Lime juice", "quantity": "2", "unit": "tbsp"},
    {"name": "Fresh mint", "quantity": "2", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cut all fruits into bite-sized pieces"},
    {"step": 2, "description": "Combine fruits in a large bowl"},
    {"step": 3, "description": "Whisk together honey and lime juice"},
    {"step": 4, "description": "Pour dressing over fruit and toss gently"},
    {"step": 5, "description": "Garnish with fresh mint"},
    {"step": 6, "description": "Chill for 30 minutes before serving"}
  ]'::jsonb,
  140, 2, 36, 1,
  ARRAY['healthy', 'dessert', 'fruit', 'no-cook', 'summer'],
  'curated', true
)
ON CONFLICT DO NOTHING;

