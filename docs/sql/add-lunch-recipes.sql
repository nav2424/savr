-- Add Lunch Recipes (4 recipes)
-- Run this in Supabase SQL Editor

INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
-- Quinoa Buddha Bowl
(
  'Quinoa Buddha Bowl',
  'A nourishing bowl packed with quinoa, roasted vegetables, and tahini dressing.',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  15, 25, 2, 'Easy',
  'Mediterranean', 'lunch',
  '[
    {"name": "Quinoa", "quantity": "1", "unit": "cup"},
    {"name": "Sweet potato", "quantity": "1", "unit": "piece"},
    {"name": "Chickpeas", "quantity": "1", "unit": "can"},
    {"name": "Kale", "quantity": "2", "unit": "cups"},
    {"name": "Tahini", "quantity": "2", "unit": "tbsp"},
    {"name": "Lemon juice", "quantity": "2", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cook quinoa according to package instructions"},
    {"step": 2, "description": "Dice sweet potato and roast at 400°F for 25 minutes"},
    {"step": 3, "description": "Drain and rinse chickpeas, toss with oil and spices, roast with sweet potato"},
    {"step": 4, "description": "Massage kale with lemon juice"},
    {"step": 5, "description": "Assemble bowl with quinoa, vegetables, chickpeas, and drizzle with tahini"}
  ]'::jsonb,
  380, 14, 58, 12,
  ARRAY['vegan', 'healthy', 'buddha-bowl', 'mediterranean'],
  'curated', true
),
-- Caprese Sandwich
(
  'Caprese Sandwich',
  'Fresh mozzarella, tomatoes, and basil on crusty bread.',
  'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80',
  10, 0, 1, 'Easy',
  'Italian', 'lunch',
  '[
    {"name": "Ciabatta bread", "quantity": "1", "unit": "piece"},
    {"name": "Fresh mozzarella", "quantity": "4", "unit": "oz"},
    {"name": "Tomatoes", "quantity": "2", "unit": "pieces"},
    {"name": "Fresh basil", "quantity": "6", "unit": "leaves"},
    {"name": "Balsamic glaze", "quantity": "2", "unit": "tbsp"},
    {"name": "Olive oil", "quantity": "1", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Slice ciabatta bread in half"},
    {"step": 2, "description": "Layer mozzarella slices on bread"},
    {"step": 3, "description": "Add sliced tomatoes"},
    {"step": 4, "description": "Top with fresh basil leaves"},
    {"step": 5, "description": "Drizzle with balsamic glaze and olive oil"}
  ]'::jsonb,
  420, 18, 42, 22,
  ARRAY['vegetarian', 'italian', 'quick', 'no-cook'],
  'curated', true
),
-- Veggie Quesadilla
(
  'Vegetarian Quesadilla',
  'Crispy tortilla filled with cheese and sautéed vegetables.',
  'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
  10, 10, 2, 'Easy',
  'Mexican', 'lunch',
  '[
    {"name": "Flour tortillas", "quantity": "4", "unit": "pieces"},
    {"name": "Cheddar cheese", "quantity": "2", "unit": "cups"},
    {"name": "Bell peppers", "quantity": "2", "unit": "pieces"},
    {"name": "Onion", "quantity": "1", "unit": "piece"},
    {"name": "Black beans", "quantity": "1", "unit": "can"},
    {"name": "Corn", "quantity": "1", "unit": "cup"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Sauté diced peppers and onions until soft"},
    {"step": 2, "description": "Add drained black beans and corn, heat through"},
    {"step": 3, "description": "Place tortilla in pan, sprinkle with cheese"},
    {"step": 4, "description": "Add vegetable mixture and top with more cheese"},
    {"step": 5, "description": "Top with another tortilla and cook until golden"},
    {"step": 6, "description": "Flip and cook other side until crispy"}
  ]'::jsonb,
  480, 22, 52, 20,
  ARRAY['vegetarian', 'mexican', 'quick', 'cheese'],
  'curated', true
),
-- Poke Bowl
(
  'Ahi Tuna Poke Bowl',
  'Fresh tuna poke with rice, avocado, and crispy vegetables.',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  20, 15, 2, 'Medium',
  'Hawaiian', 'lunch',
  '[
    {"name": "Sushi-grade tuna", "quantity": "8", "unit": "oz"},
    {"name": "Sushi rice", "quantity": "2", "unit": "cups"},
    {"name": "Soy sauce", "quantity": "3", "unit": "tbsp"},
    {"name": "Sesame oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Avocado", "quantity": "1", "unit": "piece"},
    {"name": "Edamame", "quantity": "1", "unit": "cup"},
    {"name": "Cucumber", "quantity": "1", "unit": "piece"},
    {"name": "Seaweed salad", "quantity": "1", "unit": "cup"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cook sushi rice according to package instructions"},
    {"step": 2, "description": "Cube tuna and marinate in soy sauce and sesame oil"},
    {"step": 3, "description": "Slice avocado and cucumber"},
    {"step": 4, "description": "Assemble bowl with rice as base"},
    {"step": 5, "description": "Top with marinated tuna, avocado, edamame, cucumber, and seaweed"},
    {"step": 6, "description": "Drizzle with extra soy sauce and sesame seeds"}
  ]'::jsonb,
  520, 32, 48, 22,
  ARRAY['seafood', 'hawaiian', 'healthy', 'poke'],
  'curated', true
)
ON CONFLICT DO NOTHING;

