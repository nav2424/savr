-- Add Breakfast Recipes (2 recipes)
-- Run this in Supabase SQL Editor

INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
-- Avocado Toast
(
  'Avocado Toast with Poached Egg',
  'Creamy avocado on crispy toast topped with a perfectly poached egg.',
  'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800&q=80',
  5, 5, 1, 'Easy',
  'American', 'breakfast',
  '[
    {"name": "Bread", "quantity": "2", "unit": "slices"},
    {"name": "Avocado", "quantity": "1", "unit": "piece"},
    {"name": "Eggs", "quantity": "2", "unit": "pieces"},
    {"name": "Lemon juice", "quantity": "1", "unit": "tsp"},
    {"name": "Salt", "quantity": "1", "unit": "pinch"},
    {"name": "Pepper", "quantity": "1", "unit": "pinch"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Toast bread until golden brown"},
    {"step": 2, "description": "Mash avocado with lemon juice, salt, and pepper"},
    {"step": 3, "description": "Poach eggs in simmering water for 3-4 minutes"},
    {"step": 4, "description": "Spread avocado on toast"},
    {"step": 5, "description": "Top with poached eggs and season"}
  ]'::jsonb,
  320, 12, 28, 18,
  ARRAY['healthy', 'quick', 'vegetarian', 'breakfast'],
  'curated', true
),
-- Greek Yogurt Parfait
(
  'Greek Yogurt Parfait',
  'Layers of creamy yogurt, fresh berries, and crunchy granola.',
  'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
  5, 0, 1, 'Easy',
  'Mediterranean', 'breakfast',
  '[
    {"name": "Greek yogurt", "quantity": "1", "unit": "cup"},
    {"name": "Granola", "quantity": "1/4", "unit": "cup"},
    {"name": "Mixed berries", "quantity": "1/2", "unit": "cup"},
    {"name": "Honey", "quantity": "1", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Layer yogurt in a glass or bowl"},
    {"step": 2, "description": "Add a layer of granola"},
    {"step": 3, "description": "Top with fresh berries"},
    {"step": 4, "description": "Drizzle with honey"},
    {"step": 5, "description": "Repeat layers and serve"}
  ]'::jsonb,
  280, 18, 35, 8,
  ARRAY['healthy', 'high-protein', 'quick', 'no-cook'],
  'curated', true
)
ON CONFLICT DO NOTHING;

