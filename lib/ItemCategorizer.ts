// Item Categorizer - Categorizes items for grocery shopping lists
// Returns categories that match the standard pantry categories
// MUST be 100% accurate - no false positives

export function categorizeForShopping(itemName: string): string {
  const name = itemName.toLowerCase().trim()
  
  // CRITICAL: Check meat/seafood FIRST before beverages (to avoid "steak" matching "tea" or other patterns)
  // Meat, Poultry & Seafood - Must be very specific to avoid false matches
  if (name.match(/\b(chicken|beef|pork|fish|salmon|tuna|shrimp|turkey|steak|steaks|bacon|sausage|sausages|ham|lamb|crab|crabs|lobster|lobsters|meat|poultry|seafood|ground beef|ground pork|ground turkey|chicken breast|chicken thigh|chicken wing|chicken wings|ribs|ribeye|sirloin|filet|tenderloin|pork chop|pork chops|brisket|roast|turkey breast|turkey leg|duck|goose|venison|bison|veal|anchovy|anchovies|sardine|sardines|mackerel|cod|halibut|tilapia|trout|scallop|scallops|mussel|mussels|clam|clams|oyster|oysters|octopus|squid|calamari)\b/i)) {
    return 'Meat, Poultry & Seafood'
  }
  
  // Produce - Fruits and Vegetables
  // Check for berries first (before other patterns that might match)
  if (name.match(/\b(strawberry|strawberries|blueberry|blueberries|raspberry|raspberries|blackberry|blackberries|cranberry|cranberries|gooseberry|gooseberries|elderberry|elderberries)\b/i)) {
    return 'Produce'
  }
  
  // Other fruits and vegetables
  if (name.match(/\b(banana|bananas|apple|apples|orange|oranges|tomato|tomatoes|lettuce|cucumber|cucumbers|carrot|carrots|broccoli|spinach|avocado|avocados|lemon|lemons|lime|limes|onion|onions|potato|potatoes|grape|grapes|melon|melons|peach|peaches|pear|pears|plum|plums|mango|mangoes|pineapple|pineapples|kiwi|kiwis|celery|cabbage|cauliflower|asparagus|zucchini|squash|eggplant|mushroom|mushrooms|garlic|ginger|herb|herbs|basil|cilantro|parsley|mint|arugula|kale|chard|collard|mustard greens|bok choy|radish|radishes|turnip|turnips|beet|beets|sweet potato|sweet potatoes|yam|yams|corn|peas|green beans|snap peas|snow peas|bell pepper|bell peppers|red pepper|green pepper|yellow pepper|orange pepper|sweet pepper)\b/i)) {
    return 'Produce'
  }
  
  // Bell peppers (vegetables, not spices) - but exclude spice peppers
  if (name.match(/\b(pepper|peppers)\b/i) && !name.match(/\b(black pepper|white pepper|red pepper flakes|cayenne pepper|chili pepper|jalapeño|habanero|peppercorn|peppercorns)\b/i)) {
    return 'Produce'
  }
  
  // Dairy & Eggs
  if (name.match(/\b(milk|cheese|yogurt|yoghurt|yogourt|butter|cream|egg|eggs|cheddar|mozzarella|parmesan|feta|cottage cheese|sour cream|whipped cream|heavy cream|light cream|half and half|cream cheese|ricotta|mascarpone|gouda|swiss|provolone|brie|camembert|goat cheese|blue cheese|gorgonzola|milk|whole milk|skim milk|2% milk|buttermilk|kefir)\b/i)) {
    return 'Dairy & Eggs'
  }
  
  // Grains, Bread & Pasta - Check BEFORE Pantry Staples
  if (name.match(/\b(pasta|noodles|spaghetti|linguine|fettuccine|penne|rigatoni|macaroni|fusilli|ravioli|tortellini|lasagna|bread|bagel|bagels|muffin|muffins|croissant|croissants|bun|buns|roll|rolls|tortilla|tortillas|pita|pitas|naan|baguette|baguettes|ciabatta|sourdough|rye bread|wheat bread|white bread|whole grain|rice|brown rice|white rice|jasmine rice|basmati rice|wild rice|quinoa|barley|bulgur|couscous|oats|oatmeal|steel cut oats|rolled oats|farro|millet|amaranth|teff|wheat|flour|all purpose flour|bread flour|cake flour|whole wheat flour)\b/i)) {
    return 'Grains, Bread & Pasta'
  }
  
  // Plant-Based Proteins & Legumes
  if (name.match(/\b(tofu|tempeh|seitan|jackfruit|chickpea|chickpeas|garbanzo|garbanzos|lentil|lentils|edamame|falafel|veggie burger|veggie patties|bean|beans|black bean|black beans|kidney bean|kidney beans|pinto bean|pinto beans|navy beans|cannellini beans|white beans|lima beans|black eyed peas|split peas|plant-based|plant based|vegetarian protein|meatless|meat alternative|beyond meat|impossible|soy protein|textured vegetable protein|tvp)\b/i)) {
    return 'Plant-Based Proteins & Legumes'
  }
  
  // Snacks, Sweets & Desserts
  if (name.match(/\b(chip|chips|cracker|crackers|cookie|cookies|candy|chocolate|popcorn|pretzel|pretzels|granola bar|granola bars|protein bar|protein bars|snack bar|snack bars|brownie|brownies|cake|cakes|pie|pies|donut|donuts|doughnut|doughnuts|muffin|muffins|cupcake|cupcakes|ice cream|frozen yogurt|sorbet|gelato|pudding|jello|jell-o|gummy|gummies|licorice|marshmallow|marshmallows|toffee|caramel|fudge)\b/i)) {
    return 'Snacks, Sweets & Desserts'
  }
  
  // Condiments, Sauces & Spreads
  if (name.match(/\b(ketchup|mustard|mayo|mayonnaise|relish|pickle|pickles|hot sauce|bbq sauce|barbecue sauce|dressing|salad dressing|marinade|salsa|guacamole|hummus|pesto|tahini|soy sauce|worcestershire|tabasco|sriracha|chili sauce|teriyaki|hoisin|oyster sauce|fish sauce|vinegar|balsamic|apple cider vinegar|white vinegar|rice vinegar|maple syrup|honey|jam|jelly|preserves|marmalade|nutella|peanut butter|almond butter|cashew butter|sunflower butter)\b/i)) {
    return 'Condiments, Sauces & Spreads'
  }
  
  // Pantry Staples & Essentials - Only basic staples, NOT pasta/rice (already handled above)
  if (name.match(/\b(sugar|brown sugar|powdered sugar|salt|table salt|sea salt|kosher salt|pepper|black pepper|white pepper|peppercorn|peppercorns|oil|olive oil|vegetable oil|canola oil|coconut oil|avocado oil|sesame oil|stock|chicken stock|beef stock|vegetable stock|broth|chicken broth|beef broth|vegetable broth|bouillon|cereal|breakfast cereal|oat|oats|grain|grains|nut|nuts|almond|almonds|cashew|cashews|peanut|peanuts|walnut|walnuts|pecan|pecans|hazelnut|hazelnuts|pistachio|pistachios|macadamia|macadamias|spice|spices|seasoning|seasonings|cinnamon|nutmeg|paprika|cumin|coriander|turmeric|ginger powder|garlic powder|onion powder|baking powder|baking soda|vanilla extract|almond extract|vanilla bean|vanilla beans|cocoa powder|chocolate chips|chocolate bar|chocolate bars|flour|all purpose flour|bread flour|cake flour|whole wheat flour|cornstarch|arrowroot|baking mix|pancake mix|waffle mix)\b/i)) {
    return 'Pantry Staples & Essentials'
  }
  
  // Beverages - Must be specific to avoid false matches
  if (name.match(/\b(water|juice|orange juice|apple juice|cranberry juice|grape juice|soda|pop|cola|pepsi|coke|coffee|tea|green tea|black tea|herbal tea|chai|beer|wine|red wine|white wine|champagne|prosecco|alcohol|alcoholic|drink|drinks|beverage|beverages|smoothie|smoothies|milkshake|milkshakes|lemonade|iced tea|sports drink|energy drink|sparkling water|seltzer|tonic|ginger ale|root beer)\b/i)) {
    return 'Beverages'
  }
  
  // Frozen - Check BEFORE produce to catch "pizza with peppers" correctly
  if (name.match(/\b(frozen|ice cream|frozen vegetables|frozen fruit|frozen berries|frozen meal|frozen dinner|frozen pizza|pizza|pizzas|frozen nuggets|frozen fries|frozen waffles|frozen pancakes|popsicle|popsicles|ice pop|ice pops|frozen entree|frozen entrees|frozen breakfast|frozen lunch|frozen snack|frozen appetizer)\b/i)) {
    return 'Frozen'
  }
  
  // Default - use standard category name
  return 'Non-Food / Misc'
}

// Recategorize items that have incorrect categories (like "Recipe Ingredient", "Ingredients", etc.)
export function recategorizeItem(itemName: string, currentCategory: string): string {
  // Standard categories that match PantryItemFormatter
  const properCategories = [
    'Produce',
    'Meat, Poultry & Seafood',
    'Dairy & Eggs',
    'Grains, Bread & Pasta',
    'Condiments, Sauces & Spreads',
    'Pantry Staples & Essentials',
    'Plant-Based Proteins & Legumes',
    'Snacks, Sweets & Desserts',
    'Beverages',
    'Frozen',
    'Non-Food / Misc'
  ]
  
  // If current category is not a proper shopping category, recategorize
  if (!properCategories.includes(currentCategory)) {
    return categorizeForShopping(itemName)
  }
  
  // Always verify the category is correct - recategorize if wrong
  const correctCategory = categorizeForShopping(itemName)
  
  // If the current category doesn't match the correct one, fix it
  if (currentCategory !== correctCategory) {
    return correctCategory
  }
  
  // If it's "Non-Food / Misc" but should be something more specific, recategorize
  if (currentCategory === 'Non-Food / Misc') {
    const betterCategory = categorizeForShopping(itemName)
    // Only change if we found a more specific category
    if (betterCategory !== 'Non-Food / Misc') {
      return betterCategory
    }
  }
  
  // Otherwise keep the current category
  return currentCategory
}

