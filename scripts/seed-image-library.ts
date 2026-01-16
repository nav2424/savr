/**
 * Seed curated fallback images into Supabase storage + image_library index.
 *
 * 1. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *
 * 2. Run with ts-node or `node --loader ts-node/esm scripts/seed-image-library.ts`
 */

import { createClient } from '@supabase/supabase-js'

type CuratedImage = {
  path: string
  sourceUrl: string
  class: string
  primary: string
  method: string
  source: 'curated' | 'unsplash' | 'pexels'
  credit?: {
    user?: string
    username?: string
    link?: string
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'images'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
})

const curatedImages: CuratedImage[] = [
  {
    path: 'recipes/fish/bake/baked-salmon-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1600&q=80',
    class: 'fish',
    primary: 'salmon',
    method: 'bake',
    source: 'curated',
    credit: {
      user: 'David B Townsend',
      username: 'dbtownsend',
      link: 'https://unsplash.com/photos/salmon-fillet-plate'
    }
  },
  {
    path: 'recipes/seafood/saute/sauteed-shrimp-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=1600&q=80',
    class: 'seafood',
    primary: 'shrimp',
    method: 'saute',
    source: 'curated',
    credit: {
      user: 'Taylor Grote',
      username: 'taylor_grote',
      link: 'https://unsplash.com/photos/shrimp-in-gray-pan-vuxU1wv0P9g'
    }
  },
  {
    path: 'recipes/poultry/roast/roasted-chicken-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1604908177076-a18b0a7ec1b0?w=1600&q=80',
    class: 'poultry',
    primary: 'chicken',
    method: 'roast',
    source: 'curated',
    credit: {
      user: 'Claudio Schwarz',
      username: 'purzlbaum',
      link: 'https://unsplash.com/photos/roasted-chicken-on-white-ceramic-plate-Mkws3g43Q7A'
    }
  },
  {
    path: 'recipes/meat/grill/grilled-steak-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1600&q=80',
    class: 'meat',
    primary: 'steak',
    method: 'grill',
    source: 'curated',
    credit: {
      user: 'Chad Montano',
      username: 'briewilly',
      link: 'https://unsplash.com/photos/grilled-beef-steak-with-sauce-MqT0asuoIcU'
    }
  },
  {
    path: 'recipes/vegetarian/saute/vegetarian-stirfry-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=1600&q=80',
    class: 'vegetarian',
    primary: 'vegetables',
    method: 'saute',
    source: 'curated',
    credit: {
      user: 'Szabo Viktor',
      username: 'lenscap',
      link: 'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-Q21C90I4pTI'
    }
  },
  {
    path: 'recipes/vegetarian/salad/green-salad-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1600&q=80',
    class: 'vegetarian',
    primary: 'salad',
    method: 'salad',
    source: 'curated',
    credit: {
      user: 'Anna Pelzer',
      username: 'annapelzer',
      link: 'https://unsplash.com/photos/green-vegetable-salad-on-white-ceramic-plate-IGfIGP5ONV0'
    }
  },
  {
    path: 'recipes/dessert/general/chocolate-dessert-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=1600&q=80',
    class: 'dessert',
    primary: 'chocolate',
    method: 'general',
    source: 'curated'
  },
  {
    path: 'recipes/breakfast/general/breakfast-plate-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1600&q=80',
    class: 'breakfast',
    primary: 'breakfast',
    method: 'general',
    source: 'curated'
  },
  {
    path: 'recipes/general/general/neutral-plate-1.jpg',
    sourceUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1600&q=80',
    class: 'general',
    primary: 'dish',
    method: 'general',
    source: 'curated'
  }
]

async function fetchImageBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`)
  }
  return response.arrayBuffer()
}

async function uploadImage(curated: CuratedImage) {
  console.log(`📤 Uploading ${curated.path}`)
  const buffer = await fetchImageBuffer(curated.sourceUrl)

  const upload = await supabase.storage.from(BUCKET).upload(curated.path, buffer, {
    contentType: 'image/jpeg',
    upsert: true
  })

  if (upload.error) {
    throw upload.error
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(curated.path)
  const publicUrl = publicUrlData.publicUrl

  const upsert = await supabase.from('image_library').upsert(
    {
      path: curated.path,
      deterministic_key: null,
      class: curated.class,
      primary_item: curated.primary,
      method: curated.method,
      source: curated.source,
      provider_id: curated.credit?.username,
      credit_user: curated.credit?.user,
      credit_username: curated.credit?.username,
      credit_link: curated.credit?.link,
      alt_text: buildAltText(curated)
    },
    { onConflict: 'path' }
  )

  if (upsert.error) {
    throw upsert.error
  }

  console.log(`✅ Stored at ${publicUrl}`)
}

function buildAltText(image: CuratedImage): string {
  const pieces = []
  if (image.method && image.method !== 'general') {
    pieces.push(image.method)
  }
  pieces.push(image.primary)
  pieces.push('dish on plate')
  return pieces.filter(Boolean).join(' ')
}

async function run() {
  console.log(`🚀 Seeding ${curatedImages.length} curated images`)

  for (const curated of curatedImages) {
    try {
      await uploadImage(curated)
    } catch (error) {
      console.error(`❌ Failed to store ${curated.path}`, error)
    }
  }

  console.log('✨ Seeding complete')
}

run().catch((error) => {
  console.error('Unexpected error during seeding:', error)
  process.exit(1)
})

