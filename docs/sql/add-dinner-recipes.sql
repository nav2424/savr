-- Add Dinner Recipes (5 recipes)
-- Run this in Supabase SQL Editor

INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
-- Lemon Herb Chicken
(
  'Lemon Herb Baked Chicken',
  'Juicy chicken breasts baked with lemon, garlic, and fresh herbs.',
  'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
  10, 30, 4, 'Easy',
  'American', 'dinner',
  '[
    {"name": "Chicken breast", "quantity": "4", "unit": "pieces"},
    {"name": "Lemon", "quantity": "2", "unit": "pieces"},
    {"name": "Garlic", "quantity": "4", "unit": "cloves"},
    {"name": "Fresh thyme", "quantity": "4", "unit": "sprigs"},
    {"name": "Olive oil", "quantity": "3", "unit": "tbsp"},
    {"name": "Salt and pepper", "quantity": "1", "unit": "to taste"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Preheat oven to 400°F (200°C)"},
    {"step": 2, "description": "Season chicken with salt, pepper, and minced garlic"},
    {"step": 3, "description": "Place in baking dish with lemon slices and thyme"},
    {"step": 4, "description": "Drizzle with olive oil"},
    {"step": 5, "description": "Bake for 25-30 minutes until cooked through"},
    {"step": 6, "description": "Let rest for 5 minutes before serving"}
  ]'::jsonb,
  320, 38, 4, 15,
  ARRAY['high-protein', 'low-carb', 'easy', 'dinner'],
  'curated', true
),
-- Shrimp Pasta
(
  'Garlic Butter Shrimp Pasta',
  'Succulent shrimp in a garlic butter sauce over pasta.',
  'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80',
  10, 15, 4, 'Medium',
  'Italian', 'dinner',
  '[
    {"name": "Spaghetti", "quantity": "1", "unit": "lb"},
    {"name": "Shrimp", "quantity": "1", "unit": "lb"},
    {"name": "Garlic", "quantity": "6", "unit": "cloves"},
    {"name": "Butter", "quantity": "4", "unit": "tbsp"},
    {"name": "White wine", "quantity": "1/2", "unit": "cup"},
    {"name": "Parsley", "quantity": "1/4", "unit": "cup"},
    {"name": "Lemon juice", "quantity": "2", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cook pasta according to package directions"},
    {"step": 2, "description": "In a large pan, melt butter and sauté minced garlic"},
    {"step": 3, "description": "Add shrimp and cook until pink, about 3 minutes per side"},
    {"step": 4, "description": "Add white wine and lemon juice, simmer for 2 minutes"},
    {"step": 5, "description": "Toss with cooked pasta and fresh parsley"}
  ]'::jsonb,
  520, 32, 58, 16,
  ARRAY['seafood', 'pasta', 'italian', 'quick'],
  'curated', true
),
-- Veggie Curry
(
  'Coconut Vegetable Curry',
  'A fragrant and creamy curry loaded with vegetables.',
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80',
  15, 25, 4, 'Medium',
  'Indian', 'dinner',
  '[
    {"name": "Coconut milk", "quantity": "1", "unit": "can"},
    {"name": "Curry paste", "quantity": "2", "unit": "tbsp"},
    {"name": "Mixed vegetables", "quantity": "4", "unit": "cups"},
    {"name": "Chickpeas", "quantity": "1", "unit": "can"},
    {"name": "Onion", "quantity": "1", "unit": "piece"},
    {"name": "Ginger", "quantity": "1", "unit": "tbsp"},
    {"name": "Rice", "quantity": "2", "unit": "cups"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cook rice according to package instructions"},
    {"step": 2, "description": "Sauté diced onion and ginger in oil"},
    {"step": 3, "description": "Add curry paste and cook for 1 minute"},
    {"step": 4, "description": "Add vegetables and coconut milk"},
    {"step": 5, "description": "Simmer for 15 minutes until vegetables are tender"},
    {"step": 6, "description": "Add chickpeas and heat through"},
    {"step": 7, "description": "Serve over rice"}
  ]'::jsonb,
  440, 12, 62, 18,
  ARRAY['vegan', 'curry', 'indian', 'comfort-food'],
  'curated', true
),
-- Margherita Pizza
(
  'Classic Margherita Pizza',
  'Simple pizza with fresh mozzarella, tomatoes, and basil.',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80',
  15, 15, 2, 'Medium',
  'Italian', 'dinner',
  '[
    {"name": "Pizza dough", "quantity": "1", "unit": "lb"},
    {"name": "Tomato sauce", "quantity": "1", "unit": "cup"},
    {"name": "Fresh mozzarella", "quantity": "8", "unit": "oz"},
    {"name": "Fresh basil", "quantity": "12", "unit": "leaves"},
    {"name": "Olive oil", "quantity": "2", "unit": "tbsp"},
    {"name": "Garlic", "quantity": "2", "unit": "cloves"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Preheat oven to 475°F (245°C)"},
    {"step": 2, "description": "Roll out pizza dough on floured surface"},
    {"step": 3, "description": "Spread tomato sauce evenly on dough"},
    {"step": 4, "description": "Tear mozzarella and distribute over sauce"},
    {"step": 5, "description": "Bake for 12-15 minutes until crust is golden"},
    {"step": 6, "description": "Top with fresh basil and drizzle with olive oil"}
  ]'::jsonb,
  580, 24, 68, 22,
  ARRAY['italian', 'pizza', 'vegetarian', 'classic'],
  'curated', true
),
-- Pad Thai
(
  'Pad Thai Noodles',
  'Classic Thai stir-fried noodles with shrimp and peanuts.',
  'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80',
  15, 15, 4, 'Medium',
  'Thai', 'dinner',
  '[
    {"name": "Rice noodles", "quantity": "8", "unit": "oz"},
    {"name": "Shrimp", "quantity": "1", "unit": "lb"},
    {"name": "Eggs", "quantity": "2", "unit": "pieces"},
    {"name": "Bean sprouts", "quantity": "2", "unit": "cups"},
    {"name": "Peanuts", "quantity": "1/2", "unit": "cup"},
    {"name": "Fish sauce", "quantity": "3", "unit": "tbsp"},
    {"name": "Tamarind paste", "quantity": "2", "unit": "tbsp"},
    {"name": "Lime", "quantity": "2", "unit": "pieces"},
    {"name": "Green onions", "quantity": "4", "unit": "pieces"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Soak rice noodles in warm water for 30 minutes"},
    {"step": 2, "description": "Mix fish sauce, tamarind paste, and sugar for sauce"},
    {"step": 3, "description": "Stir-fry shrimp in hot wok until pink"},
    {"step": 4, "description": "Push shrimp aside, scramble eggs"},
    {"step": 5, "description": "Add drained noodles and sauce, toss well"},
    {"step": 6, "description": "Add bean sprouts and green onions"},
    {"step": 7, "description": "Serve with crushed peanuts and lime wedges"}
  ]'::jsonb,
  540, 28, 62, 18,
  ARRAY['thai', 'noodles', 'seafood', 'asian'],
  'curated', true
)
ON CONFLICT DO NOTHING;

