# 🚀 Quick Deployment Steps - App Store Connect

## ✅ Current Status
- EAS CLI: ✅ Installed
- EAS Login: ✅ Logged in as `nav004`
- Build Number: ✅ Auto-incremented to 13
- Configuration: ✅ Ready

---

## 📤 **Deployment Options**

### **Option 1: Interactive Build (Recommended)**
Run the build command and provide Apple credentials when prompted:

```bash
eas build --platform ios --profile production
```

When prompted:
- **"Do you want to log in to your Apple account?"** → Type `yes` and press Enter
- Enter your Apple ID email
- Enter your Apple ID password
- If 2FA is enabled, enter the verification code

### **Option 2: Pre-configure Credentials**
If you want to set up credentials first:

```bash
# Configure Apple credentials
eas credentials

# Then build
eas build --platform ios --profile production
```

### **Option 3: Use Existing Credentials**
If credentials are already set up in EAS:

```bash
# Build with existing credentials
eas build --platform ios --profile production --non-interactive
```

---

## 🏗️ **Complete Deployment Workflow**

### **Step 1: Build the App**
```bash
eas build --platform ios --profile production
```

**What happens:**
- Builds iOS app with production optimizations
- Increments build number (currently 13)
- Uploads to EAS servers
- Takes ~10-15 minutes

**Monitor progress:**
- Watch in terminal
- Or check: https://expo.dev/accounts/nav004/projects/savr-mobile/builds

### **Step 2: Submit to App Store Connect**
After build completes:

```bash
eas submit --platform ios --profile production
```

**What happens:**
- Uploads `.ipa` to App Store Connect
- Processes automatically
- Appears in TestFlight within 10-15 minutes

### **Step 3: Complete App Store Connect Setup**
1. Go to: https://appstoreconnect.apple.com
2. Navigate to your app
3. Complete required information:
   - App description
   - Screenshots
   - Privacy policy URL
   - Export compliance answers

### **Step 4: Submit for Review**
1. In App Store Connect, click **"Submit for Review"**
2. Answer export compliance: **"Does your app use encryption?"** → **No**
3. Submit

---

## ⚡ **Quick Commands**

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production

# Check build status
eas build:list

# Check submission status
eas submit:list
```

---

## 🔍 **Troubleshooting**

### **If build asks for Apple credentials:**
1. Type `yes` when prompted
2. Enter Apple ID credentials
3. Complete 2FA if required

### **If credentials already exist:**
```bash
# Use non-interactive mode
eas build --platform ios --profile production --non-interactive
```

### **If build fails:**
```bash
# View build logs
eas build:view [BUILD_ID]

# Check for errors
eas build:list --status=errored
```

---

## 📋 **Pre-Submission Checklist**

Before submitting to App Store:

- [ ] App builds successfully
- [ ] TestFlight build tested on device
- [ ] All features work correctly
- [ ] Screenshots uploaded to App Store Connect
- [ ] App description written
- [ ] Privacy policy URL added
- [ ] Export compliance answered
- [ ] Keywords added
- [ ] App icon is 1024x1024px

---

## 🎯 **Next Steps**

1. **Run the build command** (it will prompt for Apple credentials)
2. **Wait for build to complete** (~10-15 minutes)
3. **Submit to App Store Connect** using `eas submit`
4. **Complete App Store Connect setup**
5. **Submit for review**

**Ready to deploy! 🚀**

