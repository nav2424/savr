-- Add Fallback Recipes (10 recipes)
-- These recipes are used as fallback options when AI generation is unavailable
-- Run this in Supabase SQL Editor

INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
-- Creamy Garlic Parmesan Pasta
(
  'Creamy Garlic Parmesan Pasta',
  'A rich and comforting Italian pasta tossed in a velvety garlic-Parmesan sauce.',
  NULL,
  5, 20, 2, 'Easy',
  'Italian', 'dinner',
  '[
    {"name": "Fettuccine pasta", "quantity": "200", "unit": "g"},
    {"name": "Olive oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Garlic", "quantity": "3", "unit": "cloves"},
    {"name": "Heavy cream", "quantity": "1", "unit": "cup"},
    {"name": "Parmesan cheese", "quantity": "1/2", "unit": "cup"},
    {"name": "Butter", "quantity": "2", "unit": "tbsp"},
    {"name": "Sea salt", "quantity": "to taste", "unit": "tsp"},
    {"name": "Black pepper", "quantity": "to taste", "unit": "tsp"},
    {"name": "Parsley", "quantity": "1", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Bring a large pot of salted water to a boil. Cook fettuccine according to package instructions until al dente. Reserve 1/4 cup pasta water, then drain."},
    {"step": 2, "description": "In a large skillet, heat olive oil and butter over medium heat. Add minced garlic and sauté until fragrant, about 1 minute."},
    {"step": 3, "description": "Pour in heavy cream and bring to a gentle simmer. Cook for 3–4 minutes until slightly thickened."},
    {"step": 4, "description": "Stir in Parmesan cheese until melted and smooth. Add cooked fettuccine and toss to coat, using a splash of reserved pasta water to loosen if needed."},
    {"step": 5, "description": "Season with salt and pepper to taste. Garnish with chopped parsley and serve immediately."}
  ]'::jsonb,
  720, 24, 62, 42,
  ARRAY['pasta', 'italian', 'creamy', 'easy', 'comfort-food', 'fallback'],
  'curated', true
),
-- Chicken Fajita Bowl
(
  'Chicken Fajita Bowl',
  'A colorful Mexican-inspired bowl with grilled chicken, sautéed peppers, and rice.',
  NULL,
  10, 25, 2, 'Easy',
  'Mexican', 'dinner',
  '[
    {"name": "Chicken breast", "quantity": "200", "unit": "g"},
    {"name": "Olive oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Red bell pepper", "quantity": "1", "unit": "whole"},
    {"name": "Green bell pepper", "quantity": "1", "unit": "whole"},
    {"name": "Onion", "quantity": "1", "unit": "whole"},
    {"name": "Cumin", "quantity": "1", "unit": "tsp"},
    {"name": "Chili powder", "quantity": "1", "unit": "tsp"},
    {"name": "Cooked rice", "quantity": "1", "unit": "cup"},
    {"name": "Sour cream", "quantity": "2", "unit": "tbsp"},
    {"name": "Lime", "quantity": "1", "unit": "whole"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "In a bowl, combine olive oil, cumin, and chili powder. Add sliced chicken and marinate for 15 minutes."},
    {"step": 2, "description": "Heat a large skillet over medium-high heat. Add marinated chicken and cook for 5–6 minutes until golden and cooked through. Remove and set aside."},
    {"step": 3, "description": "In the same pan, add bell peppers and onions. Sauté for 4–5 minutes until slightly tender."},
    {"step": 4, "description": "Assemble the bowls with rice at the base, then add chicken, vegetables, a dollop of sour cream, and a lime wedge."}
  ]'::jsonb,
  560, 39, 42, 22,
  ARRAY['mexican', 'chicken', 'bowl', 'high-protein', 'colorful', 'fallback'],
  'curated', true
),
-- Teriyaki Salmon
(
  'Teriyaki Salmon',
  'Japanese-style salmon glazed in a sweet-savory teriyaki sauce and served over rice.',
  NULL,
  5, 25, 2, 'Easy',
  'Japanese', 'dinner',
  '[
    {"name": "Salmon fillet", "quantity": "2", "unit": "piece"},
    {"name": "Soy sauce", "quantity": "2", "unit": "tbsp"},
    {"name": "Mirin", "quantity": "1", "unit": "tbsp"},
    {"name": "Honey", "quantity": "1", "unit": "tbsp"},
    {"name": "Ginger", "quantity": "1", "unit": "tsp"},
    {"name": "Sesame oil", "quantity": "1", "unit": "tsp"},
    {"name": "Sesame seeds", "quantity": "1", "unit": "tsp"},
    {"name": "Green onion", "quantity": "1", "unit": "whole"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Whisk soy sauce, mirin, honey, ginger, and sesame oil to form a glaze."},
    {"step": 2, "description": "Marinate salmon in the glaze for 15 minutes in the refrigerator."},
    {"step": 3, "description": "Heat a non-stick pan over medium. Cook salmon 4–5 minutes per side until flaky."},
    {"step": 4, "description": "Pour remaining marinade into pan and simmer 2 minutes until thickened; spoon over salmon."},
    {"step": 5, "description": "Garnish with sesame seeds and chopped green onion. Serve with rice."}
  ]'::jsonb,
  480, 38, 20, 26,
  ARRAY['japanese', 'salmon', 'seafood', 'high-protein', 'glazed', 'fallback'],
  'curated', true
),
-- Butter Chicken
(
  'Butter Chicken',
  'Classic North-Indian chicken simmered in a spiced tomato-cream sauce.',
  NULL,
  10, 35, 3, 'Medium',
  'Indian', 'dinner',
  '[
    {"name": "Chicken breast", "quantity": "300", "unit": "g"},
    {"name": "Butter", "quantity": "2", "unit": "tbsp"},
    {"name": "Onion", "quantity": "1", "unit": "whole"},
    {"name": "Garlic", "quantity": "2", "unit": "cloves"},
    {"name": "Ginger", "quantity": "1", "unit": "tsp"},
    {"name": "Tomato puree", "quantity": "1", "unit": "cup"},
    {"name": "Heavy cream", "quantity": "1/2", "unit": "cup"},
    {"name": "Garam masala", "quantity": "1", "unit": "tbsp"},
    {"name": "Turmeric", "quantity": "1", "unit": "tsp"},
    {"name": "Chili powder", "quantity": "1", "unit": "tsp"},
    {"name": "Cilantro", "quantity": "2", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Melt butter in a large skillet over medium heat. Sauté onion, garlic, and ginger until golden."},
    {"step": 2, "description": "Add garam masala, turmeric, and chili powder; stir 30 seconds to release aroma."},
    {"step": 3, "description": "Stir in tomato puree, bring to a simmer, and cook 5 minutes."},
    {"step": 4, "description": "Add chicken cubes, cover, and simmer 15 minutes until cooked through."},
    {"step": 5, "description": "Pour in heavy cream, simmer 5 minutes until thickened. Garnish with cilantro."}
  ]'::jsonb,
  610, 42, 18, 40,
  ARRAY['indian', 'chicken', 'curry', 'creamy', 'spiced', 'fallback'],
  'curated', true
),
-- Mushroom Risotto
(
  'Mushroom Risotto',
  'Creamy Italian risotto with sautéed mushrooms and Parmesan.',
  NULL,
  10, 30, 2, 'Medium',
  'French', 'dinner',
  '[
    {"name": "Arborio rice", "quantity": "150", "unit": "g"},
    {"name": "Butter", "quantity": "2", "unit": "tbsp"},
    {"name": "Olive oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Onion", "quantity": "1", "unit": "whole"},
    {"name": "Mushrooms", "quantity": "1", "unit": "cup"},
    {"name": "Vegetable broth", "quantity": "3", "unit": "cups"},
    {"name": "White wine", "quantity": "1/4", "unit": "cup"},
    {"name": "Parmesan cheese", "quantity": "1/4", "unit": "cup"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Warm broth in a saucepan and keep over low heat."},
    {"step": 2, "description": "Sauté onion in olive oil and 1 tbsp butter until translucent. Add mushrooms; cook until golden."},
    {"step": 3, "description": "Add rice, stir 1 minute until edges are translucent. Deglaze with white wine and cook until absorbed."},
    {"step": 4, "description": "Add warm broth ½ cup at a time, stirring until absorbed before adding more, until rice is creamy."},
    {"step": 5, "description": "Finish with remaining butter and Parmesan. Season and serve."}
  ]'::jsonb,
  560, 16, 70, 20,
  ARRAY['french', 'risotto', 'mushroom', 'creamy', 'comfort-food', 'fallback'],
  'curated', true
),
-- Thai Green Curry with Vegetables
(
  'Thai Green Curry with Vegetables',
  'A fragrant coconut-based Thai curry packed with colorful vegetables and fresh basil.',
  NULL,
  5, 25, 3, 'Medium',
  'Thai', 'dinner',
  '[
    {"name": "Green curry paste", "quantity": "1", "unit": "tbsp"},
    {"name": "Coconut milk", "quantity": "400", "unit": "mL"},
    {"name": "Vegetable oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Broccoli florets", "quantity": "1", "unit": "cup"},
    {"name": "Red bell pepper", "quantity": "1", "unit": "whole"},
    {"name": "Zucchini", "quantity": "1", "unit": "whole"},
    {"name": "Soy sauce", "quantity": "1", "unit": "tbsp"},
    {"name": "Brown sugar", "quantity": "1", "unit": "tsp"},
    {"name": "Basil leaves", "quantity": "1 handful", "unit": "piece"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Heat vegetable oil in a deep skillet or wok over medium heat. Add green curry paste and fry for 1 minute until fragrant."},
    {"step": 2, "description": "Pour in coconut milk while stirring. Bring to a gentle simmer for 3 minutes."},
    {"step": 3, "description": "Add soy sauce and brown sugar; stir until combined."},
    {"step": 4, "description": "Add broccoli, bell pepper, and zucchini. Simmer for 10 minutes or until vegetables are tender."},
    {"step": 5, "description": "Stir in basil leaves just before serving. Serve hot with jasmine rice."}
  ]'::jsonb,
  360, 8, 18, 28,
  ARRAY['thai', 'curry', 'vegetarian', 'coconut', 'colorful', 'fallback'],
  'curated', true
),
-- Falafel Wraps
(
  'Falafel Wraps',
  'Crispy homemade falafels wrapped with vegetables and creamy tahini sauce.',
  NULL,
  10, 30, 4, 'Medium',
  'Middle Eastern', 'dinner',
  '[
    {"name": "Chickpeas", "quantity": "1", "unit": "cup"},
    {"name": "Parsley", "quantity": "1/4", "unit": "cup"},
    {"name": "Garlic", "quantity": "2", "unit": "cloves"},
    {"name": "Onion", "quantity": "1", "unit": "whole"},
    {"name": "Cumin", "quantity": "1", "unit": "tsp"},
    {"name": "Coriander", "quantity": "1/2", "unit": "tsp"},
    {"name": "Flour", "quantity": "2", "unit": "tbsp"},
    {"name": "Pita wraps", "quantity": "4", "unit": "piece"},
    {"name": "Tahini sauce", "quantity": "1/2", "unit": "cup"},
    {"name": "Vegetable oil", "quantity": "For frying", "unit": "mL"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "In a food processor, blend chickpeas, parsley, garlic, onion, cumin, and coriander until coarse."},
    {"step": 2, "description": "Add flour to bind the mixture. Shape into small balls."},
    {"step": 3, "description": "Heat oil in a skillet over medium. Fry falafels 2–3 minutes per side until golden."},
    {"step": 4, "description": "Warm pita wraps, fill with falafels, vegetables, and drizzle with tahini sauce."}
  ]'::jsonb,
  430, 15, 45, 20,
  ARRAY['middle-eastern', 'falafel', 'vegetarian', 'wraps', 'crispy', 'fallback'],
  'curated', true
),
-- BBQ Pulled Pork Sandwich
(
  'BBQ Pulled Pork Sandwich',
  'Slow-cooked pork shoulder shredded and tossed with smoky barbecue sauce.',
  NULL,
  10, 470, 4, 'Easy',
  'American', 'dinner',
  '[
    {"name": "Pork shoulder", "quantity": "500", "unit": "g"},
    {"name": "BBQ sauce", "quantity": "1", "unit": "cup"},
    {"name": "Chicken broth", "quantity": "1/2", "unit": "cup"},
    {"name": "Onion", "quantity": "1", "unit": "whole"},
    {"name": "Brown sugar", "quantity": "1", "unit": "tbsp"},
    {"name": "Smoked paprika", "quantity": "1", "unit": "tsp"},
    {"name": "Burger buns", "quantity": "4", "unit": "piece"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Place pork, onions, broth, sugar, and paprika in a slow cooker."},
    {"step": 2, "description": "Cook on low for 6–8 hours until pork is tender."},
    {"step": 3, "description": "Shred pork with two forks and mix in BBQ sauce."},
    {"step": 4, "description": "Serve on toasted burger buns."}
  ]'::jsonb,
  640, 41, 48, 28,
  ARRAY['american', 'pork', 'bbq', 'slow-cooked', 'sandwich', 'fallback'],
  'curated', true
),
-- Greek Salad
(
  'Greek Salad',
  'Refreshing Mediterranean salad with crisp vegetables, feta, and olives.',
  NULL,
  10, 0, 2, 'Easy',
  'Mediterranean', 'lunch',
  '[
    {"name": "Romaine lettuce", "quantity": "2", "unit": "cup"},
    {"name": "Cucumber", "quantity": "1", "unit": "whole"},
    {"name": "Tomato", "quantity": "1", "unit": "whole"},
    {"name": "Kalamata olives", "quantity": "1/4", "unit": "cup"},
    {"name": "Feta cheese", "quantity": "1/4", "unit": "cup"},
    {"name": "Olive oil", "quantity": "2", "unit": "tbsp"},
    {"name": "Red wine vinegar", "quantity": "1", "unit": "tbsp"},
    {"name": "Oregano", "quantity": "1/2", "unit": "tsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Combine lettuce, cucumber, tomato, and olives in a large bowl."},
    {"step": 2, "description": "Whisk olive oil, vinegar, and oregano in a small bowl."},
    {"step": 3, "description": "Pour dressing over salad and toss gently. Top with feta cheese."}
  ]'::jsonb,
  290, 9, 14, 23,
  ARRAY['mediterranean', 'salad', 'vegetarian', 'fresh', 'healthy', 'fallback'],
  'curated', true
),
-- Jerk Shrimp with Pineapple Rice
(
  'Jerk Shrimp with Pineapple Rice',
  'Spicy Caribbean-style shrimp served with tropical pineapple rice.',
  NULL,
  5, 20, 2, 'Medium',
  'Caribbean', 'dinner',
  '[
    {"name": "Shrimp", "quantity": "200", "unit": "g"},
    {"name": "Jerk seasoning", "quantity": "1", "unit": "tbsp"},
    {"name": "Olive oil", "quantity": "1", "unit": "tbsp"},
    {"name": "Cooked jasmine rice", "quantity": "1", "unit": "cup"},
    {"name": "Pineapple", "quantity": "1/2", "unit": "cup"},
    {"name": "Red bell pepper", "quantity": "1", "unit": "whole"},
    {"name": "Lime", "quantity": "1", "unit": "whole"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Marinate shrimp with jerk seasoning and olive oil for 10 minutes."},
    {"step": 2, "description": "Heat a skillet over medium-high. Cook shrimp for 3–4 minutes until pink."},
    {"step": 3, "description": "In a separate pan, sauté diced bell pepper and pineapple with cooked rice."},
    {"step": 4, "description": "Serve shrimp over pineapple rice with lime wedges."}
  ]'::jsonb,
  450, 28, 45, 12,
  ARRAY['caribbean', 'shrimp', 'seafood', 'spicy', 'tropical', 'fallback'],
  'curated', true
)
ON CONFLICT DO NOTHING;

