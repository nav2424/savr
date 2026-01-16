# 🖼️ Cost-Effective Image Setup Guide

## 💰 Cost Breakdown

| Service | Cost | Quality | Setup |
|---------|------|---------|-------|
| **Unsplash** | 🆓 Free | Excellent | API key required |
| **Smart Stock** | 🆓 Free | Excellent | No setup needed |

## 🚀 Quick Setup (Recommended)

### Option 1: Zero Setup (Works Immediately)
The system will automatically use:
1. **Smart Stock Images** - Curated high-quality Unsplash images with intelligent selection

**No configuration needed!** Just use the app and images will work.

### Option 2: Add Unsplash API (Enhanced Quality)
1. Go to [unsplash.com/developers](https://unsplash.com/developers)
2. Create a free account
3. Create a new application
4. Copy your Access Key
5. Add to your environment variables:
   ```bash
   UNSPLASH_ACCESS_KEY=your_key_here
   ```

## 🎯 How It Works

### **Tier 1: Smart Stock Selection (Always Works)**
1. **Curated High-Quality Images**: Hand-picked Unsplash images with intelligent matching
2. **Multiple Images Per Category**: 3+ options for each cooking method/ingredient
3. **Hash-Based Variety**: Ensures different images for similar recipes

### **Tier 2: Enhanced with Unsplash API (Optional)**
1. **Unsplash API**: Free with API key - recipe-specific search results
2. **Fallback to Smart Stock**: Always works as backup

### **Smart Image Selection**
- **Cooking Methods**: Sautéed, Roasted, Grilled, Braised, etc.
- **Proteins**: Chicken, Beef, Fish, Pork with multiple image options
- **Cuisines**: Pasta, Curry, Pizza, Burger with variety
- **Hash-Based Selection**: Ensures different images for similar recipes

## 📊 Image Quality & Variety

### **Smart Stock Selection**
- ✅ Always works (no API calls)
- ✅ High-quality curated images
- ✅ Recipe-specific matching
- ✅ Multiple options per category
- ✅ Hash-based variety

### **Unsplash API**
- ✅ Free with API key
- ✅ High-quality photos
- ✅ Recipe-specific search
- ✅ Professional photography

### **Smart Stock Selection**
- ✅ Always works
- ✅ Multiple images per category
- ✅ Hash-based variety
- ✅ No API calls needed

## 🔧 Configuration

The system automatically tries services in this order:
1. **Unsplash API** (if API key provided)
2. **Smart Stock Selection** (always works)

## 💡 Pro Tips

1. **Start with zero setup** - it works immediately
2. **Add Unsplash API key** for better quality
3. **Images are cached** - no repeated API calls
4. **Fallback always works** - you'll never have missing images

## 🎨 Image Variety

Each recipe gets a unique image based on:
- **Recipe title keywords**
- **Cooking method detection**
- **Hash-based selection** from multiple options
- **Category-specific image pools**

This ensures maximum variety even with similar recipes!
