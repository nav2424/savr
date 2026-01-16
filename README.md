# 🥬 SAVR - Smart Grocery & Recipe App

**Effortless grocery shopping with AI-powered recipe recommendations and automatic household scaling.**

---

## 🎯 What is SAVR?

SAVR is an intelligent grocery and recipe management app that helps families **save money** and **reduce food waste** through:

- **AI Recipe Generation** - Creates recipes from your pantry items
- **Automatic Household Scaling** - All recipes and nutrition auto-scale for your family size
- **Smart Barcode Scanning** - Build your own product database
- **Weighted Ingredient Matching** - Prioritizes important ingredients
- **Intelligent Shopping Lists** - Converts recipe amounts to realistic shopping quantities
- **Zero Duplicates** - Automatically merges pantry items

---

## ✨ Key Features

### 🏠 **Automatic Household Scaling**
Set your household size once (e.g., 4 people) → ALL recipes, nutrition, and shopping lists automatically scale. **No manual calculations ever.**

### 🧠 **AI Recipe Generation**
- Creates custom recipes based on what's in your pantry
- Uses weighted matching (proteins/carbs count more than seasonings)
- Only shows recipes you can actually make
- Sorts by highest match percentage first

### 📸 **Smart Barcode Scanning**
- Scan any grocery product barcode
- 70-80% automatic recognition via Open Food Facts API
- Builds proprietary database (faster over time)
- Manual entry fallback for missing products
- Auto-scales nutrition for household

### 🛒 **Intelligent Shopping Lists**
- One-tap add missing ingredients to lists
- Smart standardization: "0.5 cups sour cream" → "1 container Sour cream"
- Prevents duplicates automatically
- Collaborative lists with family

### 💰 **Money-Saving Focus**
- Only suggests recipes using pantry items
- Reduces food waste
- Tracks savings potential
- Budget-aware recommendations

---

## 📱 App Structure

### Main Tabs:
1. **Home (Dashboard)**
   - Personalized greeting
   - AI-generated recipe suggestions (sorted by match %)
   - Pantry overview
   - Trust indicators
   - Quick actions

2. **Recipes**
   - Database recipes + AI-generated recipes
   - Weighted ingredient matching
   - Filter by meal type, difficulty
   - Save favorites
   - One-tap add missing ingredients to lists

3. **Pantry**
   - Real-time pantry management
   - Barcode scanning (floating button)
   - Auto-merge duplicates
   - Filter by location (fridge/freezer/pantry)
   - Expiry tracking

4. **Lists**
   - Multiple grocery lists
   - Collaborative sharing
   - Smart item adding
   - Category organization

5. **More**
   - User profile (dynamic)
   - Settings
   - Account management

### Additional Screens:
- **Onboarding** - Collects household size, dietary preferences, budget
- **Auth** - Sign in / Sign up
- **Recipe Detail** - Full recipe view with instructions
- **AI Recipe Detail** - AI recipes with available/missing ingredients
- **Scan Barcode** - Camera barcode scanning flow
- **List Detail** - Individual list management

---

## 🏗️ Technical Architecture

### Frontend:
- **Framework**: React Native + Expo
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: React Context + Hooks
- **UI**: Custom components with consistent design system
- **Animations**: React Native Animated API
- **Camera**: Expo Camera (barcode scanning)
- **Image Caching**: Expo Image

### Backend:
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **Storage**: Supabase Storage
- **APIs**: Open Food Facts (product data)

### Key Services:

**Core Services:**
- `AIRecipeGenerator.ts` - Generates recipes from pantry items
- `BarcodeService.ts` - Barcode scanning + product lookup
- `GroceryStandardizer.ts` - Converts recipe → shopping quantities
- `UserPreferencesService.ts` - Manages user preferences
- `AILearningService.ts` - Tracks behavior and learns

**Context Providers:**
- `AuthContext.tsx` - User authentication
- `PantryContext.tsx` - Pantry management with duplicate prevention
- `RecipesContext.tsx` - Recipe management with weighted matching
- `CollaborativeListsContext.tsx` - Shared grocery lists

---

## 🚀 Getting Started

### Prerequisites:
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase account (free tier works)

### Installation:

```bash
# 1. Clone repository
git clone <repo-url>
cd savr-mobile

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Add your Supabase URL and keys to .env

# 4. Run database migrations
# Go to Supabase SQL Editor and run:
# - docs/sql/supabase-schema.sql
# - docs/sql/add-scanned-products-table.sql
# - docs/sql/fix-barcode-and-push-tokens.sql

# 5. Start development server
npx expo start

# 6. Run on device
# Scan QR code with Expo Go app
# Or press 'i' for iOS simulator
# Or press 'a' for Android emulator
```

### Required Permissions:
- **Camera**: For barcode scanning
- **Notifications**: For smart reminders (optional)

---

## 🎨 Design System

### Colors:
- **Primary**: `#6A9571` (SAVR Green)
- **Secondary**: `#5A8461` (Dark Green)
- **Background**: `#F8FAF9` (Off-White)
- **Surface**: `#FFFFFF` (White)
- **Text**: `#1C1C1E` (Near Black)
- **Text Secondary**: `#666666` (Gray)
- **Success**: `#51CF66` (Green)
- **Warning**: `#FFA726` (Orange)
- **Error**: `#FF6B6B` (Red)

### Typography:
- **Large Title**: 28px, 700 weight
- **Title**: 20px, 600 weight
- **Headline**: 17px, 600 weight
- **Body**: 16px, 400 weight
- **Subheadline**: 15px, 400 weight
- **Footnote**: 13px, 400 weight
- **Caption**: 12px, 400 weight

### Components:
- All UI components in `components/PremiumComponents.tsx`
- Consistent shadows, borders, spacing
- Haptic feedback on all interactions

---

## 🧠 How SAVR AI Works

### 1. **Weighted Ingredient Matching**

Not all ingredients are equal. SAVR uses intelligent weighting:

- **Critical (3x)**: Proteins (chicken, beef), Carbs (rice, pasta, tortillas)
- **Important (2x)**: Sauces (salsa), Cheese, Vegetables (lettuce, tomatoes)
- **Optional (1x)**: Seasonings (salt, pepper), Garnishes (lime, cilantro)

**Example:**
```
Chicken Tacos (11 ingredients):
✅ Have: Chicken legs (3pts), Tortillas (3pts), Salsa (2pts) = 8pts
❌ Need: Cheese (2pts), Lettuce (2pts), Tomatoes (1pt), etc. = 8pts
Match: 8/16 = 50% ✅ (Not 3/11 = 27% ❌)
```

### 2. **AI Recipe Generation**

When database recipes aren't enough, AI generates custom recipes:

```typescript
Your Pantry: Chicken legs, Tortillas, Salsa

AI Generates:
→ "Chicken Legs Tacos"
  - Uses ALL 3 pantry items
  - Adds essential taco ingredients
  - Provides complete instructions
  - Accurate taco image
  - 50% match (realistic!)
```

### 3. **Smart Grocery Standardization**

Converts recipe quantities to real shopping amounts:

```
Recipe: "0.5 cups sour cream" → List: "1 container Sour cream"
Recipe: "1 tsp salt" → List: "1 container Salt"
Recipe: "1 lime" → List: "3 pieces Limes" (buy extras!)
```

### 4. **Duplicate Prevention**

Smart merging by barcode or name:

```
Scan Receipt 1: Milk (barcode 123) → Add (qty: 1)
Scan Receipt 2: Milk (barcode 123) → Merge! (qty: 2)
Result: ONE item, not two
```

---

## 📂 Project Structure

```
savr-mobile/
├── app/
│   ├── (tabs)/              # Main app tabs
│   │   ├── index.tsx        # Dashboard
│   │   ├── recipes.tsx      # Recipe browser
│   │   ├── pantry.tsx       # Pantry management
│   │   ├── lists.tsx        # Grocery lists
│   │   └── more.tsx         # Settings/Profile
│   ├── ai-recipe-detail.tsx # AI recipe view
│   ├── auth.tsx             # Authentication
│   ├── onboarding.tsx       # User onboarding
│   ├── recipe-detail.tsx    # Database recipe view
│   ├── scan-barcode.tsx     # Barcode scanning
│   └── list-detail.tsx      # List management
├── lib/
│   ├── AIRecipeGenerator.ts       # AI recipe creation
│   ├── BarcodeService.ts          # Barcode scanning
│   ├── GroceryStandardizer.ts     # Shopping quantity conversion
│   ├── RecipesContext.tsx         # Recipe management
│   ├── PantryContext.tsx          # Pantry management
│   ├── AuthContext.tsx            # Authentication
│   ├── AILearningService.ts       # User behavior learning
│   ├── TrustBuildingService.ts    # Trust indicators
│   └── UserPreferencesService.ts  # Preferences storage
├── components/
│   ├── PremiumComponents.tsx      # Main UI components
│   ├── BarcodeScanner.tsx         # Barcode camera
│   ├── ScanResultModal.tsx        # Scan results
│   ├── ManualProductEntry.tsx     # Manual product add
│   ├── SageAssistantV2.tsx        # Voice assistant
│   └── SimpleRecipeImage.tsx      # Recipe images
├── docs/
│   ├── archive/                   # Old documentation
│   └── sql/                       # Database migrations
├── README.md                      # This file
├── DEVELOPMENT.md                 # Development guide
├── BARCODE_SCANNING_GUIDE.md      # Barcode feature docs
└── APP_ANALYSIS_AND_ROADMAP.md    # Strategic roadmap
```

---

## 🔑 Key Algorithms

### Weighted Match Calculation:
```typescript
ingredients.forEach(ing => {
  weight = ing.importance === 'critical' ? 3 : 
           ing.importance === 'important' ? 2 : 1
  totalWeight += weight
  if (inPantry) matchedWeight += weight
})
matchPercentage = (matchedWeight / totalWeight) * 100
```

### Duplicate Prevention:
```typescript
// Check barcode first (most accurate)
if (item.barcode) {
  existingItem = find(same barcode + location)
}
// Fallback to name matching
if (!existingItem) {
  existingItem = find(same name + location, case-insensitive)
}
// Merge if found, otherwise add new
if (existingItem) {
  updateQuantity(existingItem, existingQty + newQty)
}
```

---

## 🛠️ Development

### Run the app:
```bash
npx expo start
```

### Run on specific platform:
```bash
npx expo start --ios      # iOS simulator
npx expo start --android  # Android emulator
```

### Build for production:
```bash
eas build --platform ios
eas build --platform android
```

---

## 📊 Database Schema

### Main Tables:
- `users` - User accounts and preferences
- `recipes` - Recipe database
- `saved_recipes` - User-saved recipes
- `pantry_items` - User pantry inventory
- `list_items` - Grocery list items
- `scanned_products` - Barcode product cache (proprietary!)
- `user_scanned_history` - Scan tracking
- `push_tokens` - Notification tokens

### Key Features:
- **Row Level Security (RLS)** - User data isolation
- **Real-time subscriptions** - Live updates
- **Automatic timestamps** - created_at, updated_at
- **Cascade deletes** - Clean data removal

---

## 🚀 Recent Improvements

### AI & Intelligence:
- ✅ Weighted ingredient matching (critical 3x, important 2x, optional 1x)
- ✅ AI recipe generation from pantry items
- ✅ Smart deduplication of similar recipes
- ✅ Behavior learning and adaptation

### User Experience:
- ✅ Automatic household scaling everywhere
- ✅ One-tap ingredient → grocery list adding
- ✅ Grocery quantity standardization
- ✅ Duplicate prevention in pantry
- ✅ Full recipe names (no truncation)

### Technical:
- ✅ Barcode scanning with Open Food Facts
- ✅ Local product caching
- ✅ Real-time Supabase integration
- ✅ TypeScript type safety
- ✅ Clean service architecture

---

## 📚 Documentation

- **README.md** (this file) - Overview and getting started
- **DEVELOPMENT.md** - Development guidelines
- **BARCODE_SCANNING_GUIDE.md** - Barcode feature documentation
- **APP_ANALYSIS_AND_ROADMAP.md** - Strategic analysis and roadmap
- **docs/archive/** - Historical documentation
- **docs/sql/** - Database migrations

---

## 🎯 Roadmap

### ✅ Completed (V1.0):
- Onboarding with household preferences
- Dashboard with AI recipe suggestions
- Pantry with barcode scanning
- Recipe browser with weighted matching
- Grocery lists with smart adding
- Automatic household scaling
- Duplicate prevention

### 🔲 In Progress (V1.1):
- Meal planning (weekly calendar)
- Budget tracking (savings visualization)
- Smart notifications (retention)
- Cook mode (hands-free cooking)

### 🔮 Planned (V2.0):
- Recipe sharing (social features)
- Advanced meal planning (AI weekly plans)
- Store integration (pricing, pickup)
- Achievements & gamification

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📝 License

Proprietary - All rights reserved

---

## 🆘 Support

For setup issues, check:
1. **DEVELOPMENT.md** - Development setup
2. **docs/sql/** - Database migrations
3. **docs/archive/** - Feature-specific guides

---

**Built with ❤️ for families who want effortless, money-saving grocery shopping.**
