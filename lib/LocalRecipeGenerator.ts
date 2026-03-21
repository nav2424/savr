// Local Recipe Generator - Works without OpenAI
// Generates authentic, diverse recipes using smart algorithms

interface RecipeTemplate {
  title: string
  description: string
  cuisine: string
  mealType: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  prepTime: number
  cookTime: number
  baseIngredients: string[]
  optionalIngredients: string[]
  instructions: string[]
  tags: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
}

// Comprehensive recipe database organized by cuisine and protein
const RECIPE_TEMPLATES: RecipeTemplate[] = [
  // ITALIAN
  {
    title: 'Creamy Garlic Parmesan Chicken',
    description: 'Tender chicken in a rich garlic cream sauce with parmesan',
    cuisine: 'Italian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 25,
    baseIngredients: ['chicken breast', 'garlic', 'heavy cream', 'parmesan cheese'],
    optionalIngredients: ['spinach', 'sun-dried tomatoes', 'basil'],
    instructions: [
      'Season chicken with salt and pepper',
      'Sear chicken in olive oil until golden, 6-7 minutes per side',
      'Remove chicken and sauté minced garlic',
      'Add heavy cream and parmesan, simmer until thick',
      'Return chicken to pan, coat with sauce',
      'Garnish with fresh basil and serve'
    ],
    tags: ['italian', 'chicken', 'creamy', 'quick'],
    calories: 480,
    protein: 42,
    carbs: 8,
    fat: 32
  },
  {
    title: 'Classic Spaghetti Aglio e Olio',
    description: 'Simple Italian pasta with garlic, olive oil, and chili flakes',
    cuisine: 'Italian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 15,
    baseIngredients: ['spaghetti', 'garlic', 'olive oil', 'red pepper flakes'],
    optionalIngredients: ['parsley', 'parmesan', 'lemon zest'],
    instructions: [
      'Cook spaghetti in salted water until al dente',
      'Meanwhile, sauté thinly sliced garlic in olive oil',
      'Add red pepper flakes and cook until fragrant',
      'Toss drained pasta in the garlic oil',
      'Add pasta water to create a silky sauce',
      'Finish with parsley and parmesan'
    ],
    tags: ['italian', 'pasta', 'vegetarian', 'quick'],
    calories: 420,
    protein: 12,
    carbs: 58,
    fat: 18
  },
  
  // MEXICAN
  {
    title: 'Chicken Fajita Bowl',
    description: 'Spicy chicken with peppers and onions over rice',
    cuisine: 'Mexican',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 20,
    baseIngredients: ['chicken breast', 'bell peppers', 'onion', 'rice'],
    optionalIngredients: ['avocado', 'lime', 'cilantro', 'sour cream'],
    instructions: [
      'Season chicken with cumin, paprika, garlic powder',
      'Slice chicken, peppers, and onions into strips',
      'Sauté chicken in hot pan until cooked through',
      'Add peppers and onions, cook until tender-crisp',
      'Serve over rice with lime and cilantro',
      'Top with avocado and sour cream if desired'
    ],
    tags: ['mexican', 'chicken', 'healthy', 'bowl'],
    calories: 450,
    protein: 38,
    carbs: 48,
    fat: 12
  },
  {
    title: 'Black Bean Tacos',
    description: 'Seasoned black beans with fresh toppings in soft tortillas',
    cuisine: 'Mexican',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 15,
    baseIngredients: ['black beans', 'tortillas', 'onion', 'tomatoes'],
    optionalIngredients: ['avocado', 'cheese', 'lettuce', 'salsa'],
    instructions: [
      'Sauté diced onions until soft',
      'Add black beans with cumin and chili powder',
      'Mash half the beans for creaminess',
      'Warm tortillas in a dry pan',
      'Fill with beans and fresh toppings',
      'Serve with lime wedges'
    ],
    tags: ['mexican', 'vegetarian', 'beans', 'quick'],
    calories: 380,
    protein: 16,
    carbs: 62,
    fat: 8
  },

  // ASIAN
  {
    title: 'Teriyaki Chicken Stir-Fry',
    description: 'Sweet and savory chicken with crisp vegetables',
    cuisine: 'Asian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 15,
    baseIngredients: ['chicken breast', 'soy sauce', 'vegetables', 'rice'],
    optionalIngredients: ['broccoli', 'carrots', 'ginger', 'sesame seeds'],
    instructions: [
      'Cut chicken into bite-sized pieces',
      'Mix soy sauce, honey, and ginger for sauce',
      'Stir-fry chicken in hot wok until golden',
      'Add vegetables and stir-fry until crisp-tender',
      'Pour sauce over and toss to coat',
      'Serve over rice with sesame seeds'
    ],
    tags: ['asian', 'chicken', 'stir-fry', 'quick'],
    calories: 420,
    protein: 35,
    carbs: 52,
    fat: 8
  },
  {
    title: 'Vegetable Fried Rice',
    description: 'Classic fried rice loaded with colorful vegetables',
    cuisine: 'Asian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 12,
    baseIngredients: ['rice', 'eggs', 'vegetables', 'soy sauce'],
    optionalIngredients: ['peas', 'carrots', 'green onions', 'sesame oil'],
    instructions: [
      'Use day-old rice for best texture',
      'Scramble eggs and set aside',
      'Stir-fry vegetables in hot wok',
      'Add rice and break up clumps',
      'Season with soy sauce and sesame oil',
      'Mix in eggs and green onions'
    ],
    tags: ['asian', 'vegetarian', 'rice', 'quick'],
    calories: 340,
    protein: 12,
    carbs: 58,
    fat: 8
  },

  // AMERICAN
  {
    title: 'Classic Burger Bowl',
    description: 'All the burger flavors in a healthy bowl',
    cuisine: 'American',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 15,
    baseIngredients: ['ground beef', 'lettuce', 'tomato', 'onion'],
    optionalIngredients: ['cheese', 'pickles', 'bacon', 'special sauce'],
    instructions: [
      'Season ground beef with salt and pepper',
      'Cook beef in pan, breaking into crumbles',
      'Prepare lettuce, tomato, and onion',
      'Layer lettuce as base in bowl',
      'Top with beef, vegetables, and toppings',
      'Drizzle with burger sauce'
    ],
    tags: ['american', 'beef', 'bowl', 'low-carb'],
    calories: 420,
    protein: 32,
    carbs: 12,
    fat: 28
  },
  {
    title: 'BBQ Chicken Wrap',
    description: 'Smoky BBQ chicken with crisp veggies in a wrap',
    cuisine: 'American',
    mealType: 'lunch',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 15,
    baseIngredients: ['chicken breast', 'BBQ sauce', 'tortilla', 'lettuce'],
    optionalIngredients: ['tomato', 'cheese', 'ranch dressing', 'red onion'],
    instructions: [
      'Cook chicken and shred or dice',
      'Toss chicken in BBQ sauce',
      'Warm tortilla in pan',
      'Layer lettuce and chicken on tortilla',
      'Add cheese and vegetables',
      'Roll tightly and slice in half'
    ],
    tags: ['american', 'chicken', 'wrap', 'quick'],
    calories: 380,
    protein: 28,
    carbs: 42,
    fat: 10
  },

  // MEDITERRANEAN
  {
    title: 'Greek Lemon Chicken',
    description: 'Tender chicken with bright lemon and herbs',
    cuisine: 'Mediterranean',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 30,
    baseIngredients: ['chicken thighs', 'lemon', 'garlic', 'olive oil'],
    optionalIngredients: ['oregano', 'olives', 'feta', 'tomatoes'],
    instructions: [
      'Marinate chicken in lemon juice, garlic, and oregano',
      'Sear chicken skin-side down until crispy',
      'Flip and roast in oven at 400°F',
      'Add olives and tomatoes if using',
      'Finish with fresh lemon juice',
      'Top with crumbled feta'
    ],
    tags: ['mediterranean', 'chicken', 'healthy', 'lemon'],
    calories: 420,
    protein: 36,
    carbs: 6,
    fat: 28
  },
  {
    title: 'Hummus Power Bowl',
    description: 'Creamy hummus with fresh vegetables and grains',
    cuisine: 'Mediterranean',
    mealType: 'lunch',
    difficulty: 'Easy',
    prepTime: 15,
    cookTime: 0,
    baseIngredients: ['hummus', 'chickpeas', 'cucumber', 'tomatoes'],
    optionalIngredients: ['quinoa', 'olives', 'feta', 'tahini'],
    instructions: [
      'Cook quinoa or rice as base',
      'Spread hummus in bowl',
      'Arrange chickpeas, cucumber, tomatoes',
      'Add olives and feta',
      'Drizzle with tahini and olive oil',
      'Season with za\'atar or sumac'
    ],
    tags: ['mediterranean', 'vegetarian', 'healthy', 'bowl'],
    calories: 380,
    protein: 14,
    carbs: 48,
    fat: 16
  },

  // BREAKFAST
  {
    title: 'Protein Scramble Bowl',
    description: 'Fluffy eggs with vegetables and cheese',
    cuisine: 'American',
    mealType: 'breakfast',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 10,
    baseIngredients: ['eggs', 'vegetables', 'cheese'],
    optionalIngredients: ['spinach', 'tomatoes', 'mushrooms', 'avocado'],
    instructions: [
      'Whisk eggs with salt and pepper',
      'Sauté vegetables until tender',
      'Pour eggs over vegetables',
      'Scramble gently until just set',
      'Add cheese and fold in',
      'Top with avocado if desired'
    ],
    tags: ['breakfast', 'eggs', 'protein', 'quick'],
    calories: 320,
    protein: 24,
    carbs: 8,
    fat: 22
  },
  {
    title: 'Overnight Oats',
    description: 'Creamy oats with fruit and nuts',
    cuisine: 'American',
    mealType: 'breakfast',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 0,
    baseIngredients: ['oats', 'milk', 'yogurt'],
    optionalIngredients: ['berries', 'honey', 'nuts', 'chia seeds'],
    instructions: [
      'Combine oats, milk, and yogurt',
      'Add chia seeds if using',
      'Refrigerate overnight',
      'In morning, stir and add toppings',
      'Top with berries and nuts',
      'Drizzle with honey'
    ],
    tags: ['breakfast', 'healthy', 'meal-prep', 'vegetarian'],
    calories: 280,
    protein: 12,
    carbs: 42,
    fat: 8
  },

  // MORE FLEXIBLE PANTRY RECIPES
  {
    title: 'Simple Baked Chicken',
    description: 'Seasoned chicken baked to perfection',
    cuisine: 'American',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 30,
    baseIngredients: ['chicken'],
    optionalIngredients: ['olive oil', 'garlic', 'lemon', 'herbs'],
    instructions: [
      'Preheat oven to 400°F',
      'Season chicken with salt, pepper, and any herbs',
      'Drizzle with olive oil',
      'Bake for 30-35 minutes until cooked through',
      'Let rest 5 minutes before serving',
      'Pair with any vegetables or grains'
    ],
    tags: ['chicken', 'simple', 'healthy', 'meal-prep'],
    calories: 280,
    protein: 42,
    carbs: 0,
    fat: 12
  },
  {
    title: 'Tomato Basil Pasta',
    description: 'Fresh tomato sauce with basil over pasta',
    cuisine: 'Italian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 20,
    baseIngredients: ['pasta', 'tomatoes'],
    optionalIngredients: ['garlic', 'basil', 'olive oil', 'parmesan'],
    instructions: [
      'Cook pasta in salted water',
      'Sauté garlic in olive oil',
      'Add diced tomatoes and simmer',
      'Season with salt, pepper, basil',
      'Toss pasta with sauce',
      'Top with parmesan and fresh basil'
    ],
    tags: ['italian', 'pasta', 'vegetarian', 'simple'],
    calories: 380,
    protein: 12,
    carbs: 68,
    fat: 8
  },
  {
    title: 'Egg Fried Rice',
    description: 'Quick fried rice with eggs and vegetables',
    cuisine: 'Asian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 10,
    baseIngredients: ['rice', 'eggs'],
    optionalIngredients: ['vegetables', 'soy sauce', 'green onions', 'sesame oil'],
    instructions: [
      'Use leftover or day-old rice',
      'Scramble eggs and set aside',
      'Stir-fry any vegetables you have',
      'Add rice and break up clumps',
      'Mix in soy sauce and eggs',
      'Top with green onions'
    ],
    tags: ['asian', 'rice', 'eggs', 'quick', 'leftovers'],
    calories: 320,
    protein: 14,
    carbs: 48,
    fat: 10
  },
  {
    title: 'Chicken and Rice Bowl',
    description: 'Seasoned chicken over rice with vegetables',
    cuisine: 'American',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 25,
    baseIngredients: ['chicken', 'rice'],
    optionalIngredients: ['vegetables', 'soy sauce', 'garlic', 'ginger'],
    instructions: [
      'Cook rice according to package directions',
      'Season and cook chicken',
      'Sauté any vegetables you have',
      'Slice chicken',
      'Serve over rice with vegetables',
      'Drizzle with soy sauce or any sauce'
    ],
    tags: ['chicken', 'rice', 'bowl', 'simple'],
    calories: 420,
    protein: 38,
    carbs: 45,
    fat: 10
  },
  {
    title: 'Veggie Pasta Primavera',
    description: 'Pasta with whatever vegetables you have',
    cuisine: 'Italian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 15,
    baseIngredients: ['pasta', 'vegetables'],
    optionalIngredients: ['garlic', 'olive oil', 'parmesan', 'tomatoes'],
    instructions: [
      'Cook pasta in salted water',
      'Sauté garlic in olive oil',
      'Add any vegetables, cook until tender',
      'Toss with pasta and pasta water',
      'Season with salt, pepper, herbs',
      'Top with parmesan if available'
    ],
    tags: ['italian', 'pasta', 'vegetarian', 'flexible'],
    calories: 360,
    protein: 12,
    carbs: 64,
    fat: 8
  },
  {
    title: 'Bean and Rice Bowl',
    description: 'Protein-packed beans with rice and toppings',
    cuisine: 'Mexican',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 15,
    baseIngredients: ['beans', 'rice'],
    optionalIngredients: ['onion', 'tomatoes', 'cheese', 'salsa', 'avocado'],
    instructions: [
      'Cook rice',
      'Heat beans with cumin and chili powder',
      'Layer rice and beans in bowl',
      'Top with any available toppings',
      'Add salsa, cheese, avocado if you have them',
      'Squeeze lime on top'
    ],
    tags: ['mexican', 'vegetarian', 'budget', 'protein'],
    calories: 380,
    protein: 16,
    carbs: 68,
    fat: 4
  },
  {
    title: 'Stir-Fry Whatever Bowl',
    description: 'Quick stir-fry using any protein and vegetables',
    cuisine: 'Asian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 12,
    baseIngredients: ['vegetables'],
    optionalIngredients: ['chicken', 'beef', 'rice', 'soy sauce', 'garlic', 'ginger'],
    instructions: [
      'Cut any protein and vegetables into bite-size pieces',
      'Heat wok or large pan very hot',
      'Stir-fry protein first, set aside',
      'Stir-fry harder vegetables, then softer ones',
      'Add protein back with soy sauce',
      'Serve over rice or alone'
    ],
    tags: ['asian', 'stir-fry', 'flexible', 'quick'],
    calories: 320,
    protein: 24,
    carbs: 28,
    fat: 12
  },
  {
    title: 'Omelet with Veggies',
    description: 'Fluffy omelet filled with any vegetables',
    cuisine: 'French',
    mealType: 'breakfast',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 8,
    baseIngredients: ['eggs'],
    optionalIngredients: ['cheese', 'vegetables', 'herbs', 'mushrooms', 'tomatoes'],
    instructions: [
      'Whisk 2-3 eggs with salt and pepper',
      'Heat butter in non-stick pan',
      'Pour eggs and swirl to coat pan',
      'Add any diced vegetables and cheese',
      'Fold omelet in half when mostly set',
      'Slide onto plate and serve'
    ],
    tags: ['breakfast', 'eggs', 'quick', 'flexible'],
    calories: 240,
    protein: 18,
    carbs: 4,
    fat: 16
  },
  {
    title: 'Roasted Vegetable Medley',
    description: 'Any vegetables roasted with herbs',
    cuisine: 'Mediterranean',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 30,
    baseIngredients: ['vegetables'],
    optionalIngredients: ['olive oil', 'garlic', 'herbs', 'lemon'],
    instructions: [
      'Preheat oven to 425°F',
      'Chop any vegetables into similar sizes',
      'Toss with olive oil, salt, pepper, herbs',
      'Spread on baking sheet',
      'Roast 25-30 minutes until caramelized',
      'Squeeze lemon over before serving'
    ],
    tags: ['vegetarian', 'healthy', 'simple', 'versatile'],
    calories: 180,
    protein: 4,
    carbs: 24,
    fat: 8
  },
  {
    title: 'Quick Chicken Soup',
    description: 'Comforting soup with chicken and vegetables',
    cuisine: 'American',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 25,
    baseIngredients: ['chicken', 'broth'],
    optionalIngredients: ['vegetables', 'noodles', 'rice', 'herbs'],
    instructions: [
      'Bring broth to simmer',
      'Add diced chicken and cook through',
      'Add any vegetables you have',
      'Add noodles or rice if using',
      'Season with herbs, salt, pepper',
      'Simmer until vegetables are tender'
    ],
    tags: ['soup', 'chicken', 'comfort', 'flexible'],
    calories: 220,
    protein: 28,
    carbs: 18,
    fat: 6
  },
  {
    title: 'Grain Bowl with Protein',
    description: 'Healthy bowl with grains, protein, and vegetables',
    cuisine: 'American',
    mealType: 'lunch',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 20,
    baseIngredients: ['rice'],
    optionalIngredients: ['chicken', 'beans', 'vegetables', 'avocado', 'sauce'],
    instructions: [
      'Cook rice or quinoa as base',
      'Prepare any protein you have',
      'Chop and prepare vegetables',
      'Layer bowl with grain, protein, vegetables',
      'Top with avocado if available',
      'Drizzle with any dressing or sauce'
    ],
    tags: ['bowl', 'healthy', 'flexible', 'meal-prep'],
    calories: 380,
    protein: 24,
    carbs: 48,
    fat: 12
  },
  {
    title: 'Quesadilla with Whatever',
    description: 'Crispy quesadilla with cheese and fillings',
    cuisine: 'Mexican',
    mealType: 'lunch',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 10,
    baseIngredients: ['tortillas'],
    optionalIngredients: ['cheese', 'chicken', 'beans', 'vegetables', 'salsa'],
    instructions: [
      'Place tortilla in hot pan',
      'Add cheese on half of tortilla',
      'Add any protein or vegetables you have',
      'Fold tortilla in half',
      'Cook until golden and crispy on both sides',
      'Cut into wedges and serve with salsa'
    ],
    tags: ['mexican', 'quick', 'flexible', 'cheese'],
    calories: 320,
    protein: 14,
    carbs: 38,
    fat: 14
  },
  {
    title: 'Tuna or Chicken Salad',
    description: 'Protein salad with crisp vegetables',
    cuisine: 'American',
    mealType: 'lunch',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 0,
    baseIngredients: ['lettuce'],
    optionalIngredients: ['chicken', 'tuna', 'vegetables', 'cheese', 'dressing'],
    instructions: [
      'Chop lettuce and any vegetables',
      'Add cooked chicken or canned tuna',
      'Top with cheese if available',
      'Add any other toppings you like',
      'Dress with olive oil and vinegar or any dressing',
      'Toss and serve'
    ],
    tags: ['salad', 'healthy', 'protein', 'quick'],
    calories: 280,
    protein: 28,
    carbs: 12,
    fat: 14
  },
  {
    title: 'Savory Oatmeal Bowl',
    description: 'Oats cooked savory with egg and vegetables',
    cuisine: 'American',
    mealType: 'breakfast',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 12,
    baseIngredients: ['oats', 'eggs'],
    optionalIngredients: ['vegetables', 'cheese', 'soy sauce', 'green onions'],
    instructions: [
      'Cook oats with water or broth instead of milk',
      'Season with salt, pepper, soy sauce',
      'Top with fried or poached egg',
      'Add sautéed vegetables',
      'Sprinkle with cheese and green onions',
      'Enjoy a savory breakfast alternative'
    ],
    tags: ['breakfast', 'oats', 'savory', 'protein'],
    calories: 320,
    protein: 18,
    carbs: 38,
    fat: 12
  },
  {
    title: 'Sheet Pan Chicken and Veggies',
    description: 'One-pan meal with chicken and roasted vegetables',
    cuisine: 'American',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 35,
    baseIngredients: ['chicken', 'vegetables'],
    optionalIngredients: ['potatoes', 'olive oil', 'herbs', 'lemon'],
    instructions: [
      'Preheat oven to 425°F',
      'Cut chicken and vegetables into even pieces',
      'Toss everything with olive oil and seasonings',
      'Arrange on sheet pan',
      'Roast 35-40 minutes until chicken is done',
      'Squeeze lemon over everything before serving'
    ],
    tags: ['chicken', 'vegetables', 'easy-cleanup', 'healthy'],
    calories: 360,
    protein: 36,
    carbs: 24,
    fat: 14
  },
  {
    title: 'Rice and Beans',
    description: 'Classic comfort food with rice and seasoned beans',
    cuisine: 'Latin',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 20,
    baseIngredients: ['rice', 'beans'],
    optionalIngredients: ['onion', 'garlic', 'tomatoes', 'cilantro'],
    instructions: [
      'Cook rice according to package',
      'Sauté onion and garlic if you have them',
      'Add beans with cumin, paprika',
      'Simmer until thickened',
      'Serve beans over rice',
      'Top with cilantro and any vegetables'
    ],
    tags: ['budget', 'vegetarian', 'protein', 'simple'],
    calories: 340,
    protein: 14,
    carbs: 64,
    fat: 4
  },
  {
    title: 'Pasta with Butter and Cheese',
    description: 'Simple, comforting pasta with butter and parmesan',
    cuisine: 'Italian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 2,
    cookTime: 12,
    baseIngredients: ['pasta'],
    optionalIngredients: ['butter', 'parmesan', 'garlic', 'herbs'],
    instructions: [
      'Cook pasta in well-salted water',
      'Reserve 1 cup pasta water',
      'Toss hot pasta with butter',
      'Add pasta water to create creamy sauce',
      'Stir in parmesan cheese',
      'Top with black pepper and herbs'
    ],
    tags: ['italian', 'pasta', 'simple', 'comfort', 'vegetarian'],
    calories: 420,
    protein: 14,
    carbs: 68,
    fat: 12
  },
  {
    title: 'Breakfast Burrito',
    description: 'Scrambled eggs with fillings wrapped in tortilla',
    cuisine: 'Mexican',
    mealType: 'breakfast',
    difficulty: 'Easy',
    prepTime: 5,
    cookTime: 10,
    baseIngredients: ['eggs', 'tortillas'],
    optionalIngredients: ['cheese', 'beans', 'vegetables', 'salsa', 'avocado'],
    instructions: [
      'Scramble eggs with salt and pepper',
      'Warm tortilla',
      'Fill with eggs and any toppings',
      'Add cheese, beans, vegetables if you have them',
      'Roll up burrito style',
      'Optional: toast in pan for crispy exterior'
    ],
    tags: ['breakfast', 'eggs', 'mexican', 'filling'],
    calories: 380,
    protein: 20,
    carbs: 42,
    fat: 16
  },
  {
    title: 'Simple Chicken Tacos',
    description: 'Seasoned chicken in tortillas with toppings',
    cuisine: 'Mexican',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 10,
    cookTime: 15,
    baseIngredients: ['chicken', 'tortillas'],
    optionalIngredients: ['lettuce', 'tomatoes', 'cheese', 'salsa', 'sour cream'],
    instructions: [
      'Season chicken with cumin, paprika, garlic powder',
      'Cook chicken and dice or shred',
      'Warm tortillas',
      'Fill with chicken',
      'Top with any vegetables and toppings you have',
      'Serve with lime wedges'
    ],
    tags: ['mexican', 'chicken', 'tacos', 'quick'],
    calories: 360,
    protein: 32,
    carbs: 38,
    fat: 10
  },
  {
    title: 'Veggie Stir-Fry',
    description: 'Quick vegetable stir-fry with Asian flavors',
    cuisine: 'Asian',
    mealType: 'dinner',
    difficulty: 'Easy',
    prepTime: 8,
    cookTime: 10,
    baseIngredients: ['vegetables'],
    optionalIngredients: ['rice', 'soy sauce', 'garlic', 'ginger', 'sesame oil'],
    instructions: [
      'Cut all vegetables into similar sizes',
      'Heat wok or large pan very hot',
      'Stir-fry vegetables starting with hardest first',
      'Add garlic and ginger near the end',
      'Season with soy sauce and sesame oil',
      'Serve over rice or alone'
    ],
    tags: ['asian', 'vegetarian', 'healthy', 'quick'],
    calories: 180,
    protein: 6,
    carbs: 28,
    fat: 6
  }
]

class LocalRecipeGenerator {
  private static instance: LocalRecipeGenerator

  static getInstance(): LocalRecipeGenerator {
    if (!LocalRecipeGenerator.instance) {
      LocalRecipeGenerator.instance = new LocalRecipeGenerator()
    }
    return LocalRecipeGenerator.instance
  }

  /**
   * Generate personalized recipes BUILT FROM USER'S PANTRY
   * Focus: Use what they have to save money!
   */
  async generatePersonalizedRecipes(context: {
    pantryItems: string[]
    allergies: string[]
    dietaryPreferences: string[]
    householdSize: number
    count: number
  }) {
    const { pantryItems, allergies, dietaryPreferences, count } = context

    if (__DEV__) {
      console.log('🏗️ LocalRecipeGenerator called with:', {
        pantryItems: pantryItems.length,
        allergies: allergies.length,
        dietary: dietaryPreferences.length,
        count
      })
    }

    if (!pantryItems || pantryItems.length === 0) {
      if (__DEV__) console.warn('No pantry items provided')
      return []
    }

    if (__DEV__) console.log(`🏗️ Building recipes from ${pantryItems.length} pantry items...`)

    // Filter recipes based on allergies and dietary preferences
    let availableRecipes = RECIPE_TEMPLATES.filter(recipe => {
      // Check allergies
      const hasAllergen = allergies.some(allergy => {
        const allergyLower = allergy.toLowerCase()
        return recipe.baseIngredients.some(ing => ing.toLowerCase().includes(allergyLower)) ||
               recipe.optionalIngredients.some(ing => ing.toLowerCase().includes(allergyLower))
      })
      if (hasAllergen) return false

      // Check dietary preferences
      if (dietaryPreferences.includes('vegetarian') || dietaryPreferences.includes('vegan')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'turkey', 'meat']
        const hasMeat = recipe.baseIngredients.some(ing => 
          meatKeywords.some(meat => ing.toLowerCase().includes(meat))
        )
        if (hasMeat) return false
      }

      return true
    })

    // MONEY-SAVING FOCUS: Score recipes based on PANTRY MATCH PERCENTAGE
    const scoredRecipes = availableRecipes.map(recipe => {
      const pantryLower = pantryItems.map(p => p.toLowerCase())
      const allIngredients = [...recipe.baseIngredients, ...recipe.optionalIngredients]
      
      let matchedCount = 0
      let totalCount = allIngredients.length
      
      // Count how many ingredients user already has
      allIngredients.forEach(ing => {
        const ingLower = ing.toLowerCase()
        const hasIngredient = pantryLower.some(p => {
          const pLower = p.toLowerCase()
          // Smart matching: "chicken breast" matches "chicken", "spaghetti" matches "pasta"
          return pLower.includes(ingLower) || 
                 ingLower.includes(pLower) ||
                 (ingLower.includes('chicken') && pLower.includes('chicken')) ||
                 (ingLower.includes('pasta') && pLower.includes('pasta')) ||
                 (ingLower.includes('spaghetti') && pLower.includes('pasta'))
        })
        if (hasIngredient) matchedCount++
      })

      const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0
      const missingCount = totalCount - matchedCount

      return { 
        recipe, 
        score: matchPercentage,
        matchPercentage,
        matchedCount,
        totalCount,
        missingCount
      }
    })

    // FILTER: Only show recipes with 50%+ pantry match (save money!)
    const goodMatches = scoredRecipes.filter(r => r.matchPercentage >= 50)
    
    if (goodMatches.length === 0) {
      console.warn('⚠️ No recipes with 50%+ pantry match found')
      // Fallback: show best available recipes anyway
      scoredRecipes.sort((a, b) => b.score - a.score)
      return scoredRecipes.slice(0, count).map(r => r.recipe)
    }

    // Sort by pantry match percentage (highest first = save most money)
    goodMatches.sort((a, b) => b.matchPercentage - a.matchPercentage)

    console.log(`💰 Found ${goodMatches.length} recipes with 50%+ pantry match`)
    console.log(`🥇 Best match: ${goodMatches[0].matchPercentage}% (${goodMatches[0].recipe.title})`)
    
    // Select diverse high-match recipes
    const selectedRecipes = []
    const usedCuisines = new Set<string>()
    const usedMealTypes = new Set<string>()

    // Priority 1: Get the absolute best matches first (70%+)
    const excellentMatches = goodMatches.filter(r => r.matchPercentage >= 70)
    for (const item of excellentMatches) {
      if (selectedRecipes.length >= count) break
      selectedRecipes.push(item.recipe)
      usedCuisines.add(item.recipe.cuisine)
      usedMealTypes.add(item.recipe.mealType)
      console.log(`✅ Selected: ${item.recipe.title} (${item.matchPercentage}% match, only need ${item.missingCount} more items)`)
    }

    // Priority 2: Add good matches (50-69%) with cuisine diversity
    for (const item of goodMatches) {
      if (selectedRecipes.length >= count) break
      if (selectedRecipes.includes(item.recipe)) continue

      // Add if we need more recipes or it's a new cuisine
      if (!usedCuisines.has(item.recipe.cuisine) || selectedRecipes.length < count * 0.7) {
        selectedRecipes.push(item.recipe)
        usedCuisines.add(item.recipe.cuisine)
        usedMealTypes.add(item.recipe.mealType)
        console.log(`✅ Selected: ${item.recipe.title} (${item.matchPercentage}% match, need ${item.missingCount} more items)`)
      }
    }

    // If still need more, add remaining good matches
    for (const item of goodMatches) {
      if (selectedRecipes.length >= count) break
      if (!selectedRecipes.includes(item.recipe)) {
        selectedRecipes.push(item.recipe)
        console.log(`✅ Selected: ${item.recipe.title} (${item.matchPercentage}% match)`)
      }
    }

    console.log(`💡 Generated ${selectedRecipes.length} money-saving recipes!`)
    console.log('📋 Generated recipe titles:', selectedRecipes.map(r => r.title))
    return selectedRecipes
  }
}

export const localRecipeGenerator = LocalRecipeGenerator.getInstance()

