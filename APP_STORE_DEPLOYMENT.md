# 🚀 SAVR App Store Connect Deployment Guide

## 📱 Current Version: 1.0.1

### **Latest Features in This Build:**
- ✅ **Bulletproof Allergy Detection** - Risk levels (HIGH_RISK, POSSIBLE_RISK, INSUFFICIENT_DATA)
- ✅ **Enhanced Notifications** - Expiry alerts, weekly reminders, collaborative lists
- ✅ **Improved Expiry OCR** - Extremely accurate date scanning with validation
- ✅ **Fixed Refresh Token Errors** - Graceful session handling
- ✅ **Receipt Scanning** - Two-pass validation for complete accuracy
- ✅ **Recipe Generation** - Local generator with pantry matching
- ✅ **All Core Features** - Pantry, recipes, lists, budget tracking

---

## 🛠️ **Step 1: Prerequisites**

### **1.1 Install/Update EAS CLI**
```bash
npm install -g eas-cli@latest
```

### **1.2 Login to EAS**
```bash
eas login
```

### **1.3 Verify Apple Developer Account**
Make sure you have:
- ✅ Active Apple Developer Program membership ($99/year)
- ✅ App Store Connect access
- ✅ Bundle ID: `com.arnavsaluja.savr` registered

### **1.4 Check Environment Variables**
Ensure your `.env` file has all required keys:
```bash
# Required for production
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_OPENAI_API_KEY=your-openai-key

# Optional but recommended
EXPO_PUBLIC_UNSPLASH_ACCESS_KEY=your-unsplash-key
```

---

## 🏗️ **Step 2: Build for App Store**

### **Option A: Production Build (Recommended for App Store)**
```bash
eas build --platform ios --profile production
```

This will:
- ✅ Build with production optimizations
- ✅ Auto-increment build number
- ✅ Use store distribution
- ✅ Ready for App Store submission

### **Option B: TestFlight Build (For Testing First)**
```bash
eas build --platform ios --profile production
# Then submit to TestFlight for testing before App Store
```

---

## 📤 **Step 3: Submit to App Store Connect**

### **3.1 Automatic Submission (Recommended)**
After build completes, submit automatically:
```bash
eas submit --platform ios --profile production
```

This will:
- ✅ Upload to App Store Connect
- ✅ Process automatically
- ✅ Appear in TestFlight within 10-15 minutes

### **3.2 Manual Submission (Alternative)**
If automatic submission fails:
1. Download the `.ipa` file from EAS dashboard
2. Use **Transporter** app (from Mac App Store)
3. Upload to App Store Connect manually

---

## ⏱️ **Step 4: Processing Timeline**

1. **Build Time:** 10-15 minutes
2. **App Store Connect Processing:** 5-10 minutes
3. **TestFlight Processing:** 5-10 minutes
4. **App Review (if submitting to App Store):** 1-3 days

**Total Time to TestFlight:** ~30 minutes  
**Total Time to App Store:** 1-3 days

---

## 📋 **Step 5: App Store Connect Setup**

### **5.1 Complete App Information**
In [App Store Connect](https://appstoreconnect.apple.com):

1. **App Information:**
   - Name: SAVR
   - Subtitle: Smart Grocery Management
   - Category: Food & Drink
   - Privacy Policy URL: (required)

2. **Pricing & Availability:**
   - Set price (Free or Paid)
   - Select countries

3. **App Privacy:**
   - Data collection disclosures
   - Camera usage (for scanning)
   - Photo library (for receipts)
   - Location (if used)

### **5.2 Screenshots & Metadata**
Required screenshots:
- iPhone 6.7" (iPhone 14 Pro Max)
- iPhone 6.5" (iPhone 11 Pro Max)
- iPhone 5.5" (iPhone 8 Plus)

Optional but recommended:
- iPad Pro 12.9"
- App Preview videos

### **5.3 App Description**
```
SAVR - Smart Grocery Management

Transform your grocery shopping with AI-powered pantry management, 
recipe suggestions, and budget tracking.

Features:
• Barcode & Receipt Scanning
• Smart Pantry Management
• Personalized Recipe Suggestions
• Budget Tracking & Savings
• Expiry Date Alerts
• Collaborative Shopping Lists
• Allergy Detection
• AI Assistant (SAGE)
```

---

## 🧪 **Step 6: TestFlight Testing**

### **6.1 Add Testers**
1. Go to App Store Connect → TestFlight
2. Add internal testers (up to 100)
3. Add external testers (up to 10,000)
4. Send invitations

### **6.2 Test Checklist**
Before submitting for App Review, test:
- ✅ Barcode scanning works
- ✅ Receipt scanning extracts all items
- ✅ Allergy detection shows correct risk levels
- ✅ Notifications are scheduled correctly
- ✅ Expiry date OCR is accurate
- ✅ Recipes load and display correctly
- ✅ Pantry items save and sync
- ✅ Collaborative lists work
- ✅ Budget tracking calculates correctly
- ✅ No crashes or errors

---

## 📤 **Step 7: Submit for App Review**

### **7.1 Complete Submission**
1. Go to App Store Connect → Your App
2. Click **"Submit for Review"**
3. Answer export compliance questions:
   - **Does your app use encryption?** → No (ITSAppUsesNonExemptEncryption: false)
4. Submit

### **7.2 Review Information**
- **First-time submissions:** 1-3 days
- **Updates:** Usually 24-48 hours
- **Rejections:** Fix issues and resubmit

---

## 🔧 **Troubleshooting**

### **Build Fails**
```bash
# Check build status
eas build:list

# View detailed logs
eas build:view [BUILD_ID]

# Common fixes:
# - Update EAS CLI: npm install -g eas-cli@latest
# - Clear cache: eas build --platform ios --profile production --clear-cache
```

### **Submission Fails**
```bash
# Check submission status
eas submit:list

# View submission logs
eas submit:view [SUBMISSION_ID]

# Common issues:
# - Apple ID not linked: eas device:create
# - Missing credentials: EAS will prompt to create
# - Version conflict: Update version in app.config.js
```

### **Common Issues**

**1. "Bundle ID already exists"**
- Solution: Use existing bundle ID or create new one in Apple Developer Portal

**2. "Missing compliance information"**
- Solution: Answer export compliance questions in App Store Connect

**3. "Missing privacy policy"**
- Solution: Add privacy policy URL in App Store Connect

**4. "Invalid icon"**
- Solution: Ensure `assets/icon.png` is 1024x1024px, no transparency

**5. "Missing screenshots"**
- Solution: Upload required screenshots for all device sizes

---

## ✅ **Pre-Deployment Checklist**

Before deploying, verify:

### **Configuration**
- [ ] Version number is correct (`app.config.js`)
- [ ] Bundle ID matches Apple Developer Portal
- [ ] All environment variables are set
- [ ] App icon exists (`assets/icon.png`)
- [ ] Splash screen exists (`assets/splash.png`)

### **Code Quality**
- [ ] No linter errors (`read_lints` shows 0 errors)
- [ ] All features tested locally
- [ ] No console errors in production build
- [ ] Error boundaries in place

### **App Store Connect**
- [ ] App created in App Store Connect
- [ ] Bundle ID registered
- [ ] Privacy policy URL added
- [ ] Screenshots uploaded
- [ ] App description written
- [ ] Keywords added

### **Testing**
- [ ] TestFlight build tested on device
- [ ] All core features work
- [ ] No crashes or errors
- [ ] Performance is acceptable

---

## 🚀 **Quick Deployment Commands**

```bash
# 1. Update EAS CLI
npm install -g eas-cli@latest

# 2. Login to EAS
eas login

# 3. Build for production
eas build --platform ios --profile production

# 4. Submit to App Store Connect
eas submit --platform ios --profile production

# 5. Monitor status
eas build:list
eas submit:list
```

---

## 📊 **Version History**

### **v1.0.1 (Current)**
- Bulletproof allergy detection
- Enhanced notifications
- Improved expiry OCR
- Fixed refresh token errors
- Receipt scanning improvements

### **Next Version (v1.0.2)**
- Consider bumping version after testing
- Update changelog in App Store Connect

---

## 📞 **Support Resources**

- **EAS Documentation:** https://docs.expo.dev/eas/
- **App Store Connect:** https://appstoreconnect.apple.com
- **Apple Developer:** https://developer.apple.com
- **Expo Dashboard:** https://expo.dev

---

## 🎯 **Expected Results**

After successful deployment:
- ✅ Build appears in EAS dashboard
- ✅ App appears in App Store Connect
- ✅ Available in TestFlight within 30 minutes
- ✅ Ready for App Review submission
- ✅ Can be distributed to testers

**Ready to deploy! 🚀**

