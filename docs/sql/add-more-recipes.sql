-- Add More Curated Recipes to SAVR
-- Run this SQL in your Supabase SQL Editor to add 15 more delicious recipes

-- Breakfast Recipes
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
),

-- Lunch Recipes
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

-- Dinner Recipes
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

-- Snacks & Light Meals
-- Hummus & Veggies
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

-- Desserts
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
),

-- Quick & Easy
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
-- Thai Noodles
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

-- SUCCESS! 15 more delicious recipes added to your database
-- Total recipes now: 18 (3 original + 15 new)

-- Recipe breakdown by meal type:
-- Breakfast: 2 recipes (Avocado Toast, Greek Yogurt Parfait)
-- Lunch: 5 recipes (Quinoa Bowl, Caprese Sandwich, Veggie Quesadilla, Poke Bowl, original Chickpea Salad)
-- Dinner: 7 recipes (Lemon Chicken, Shrimp Pasta, Veggie Curry, Margherita Pizza, Pad Thai, original Chicken Stir-Fry, Salmon)
-- Snacks: 2 recipes (Hummus & Veggies, Energy Balls)
-- Desserts: 2 recipes (Chocolate Brownies, Fruit Salad)

