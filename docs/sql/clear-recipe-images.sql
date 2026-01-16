UPDATE public.recipes
SET image_url = NULL
WHERE image_url IS NOT NULL;

SELECT 
  COUNT(*) as total_recipes,
  COUNT(image_url) as recipes_with_images,
  COUNT(*) - COUNT(image_url) as recipes_without_images
FROM public.recipes;
