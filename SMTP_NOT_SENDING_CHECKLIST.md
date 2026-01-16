# ✅ SMTP Not Sending - Quick Checklist

## If No Emails in Resend Logs = Supabase Isn't Connecting

Follow this checklist in order:

---

## ✅ Check 1: SMTP Toggle is Actually ON

1. **Go to:** Supabase Dashboard → Settings → Auth → SMTP Settings
2. **Look at "Enable Custom SMTP" toggle**
3. **Is it green/enabled?**
   - If NO → Turn it ON, click Save
   - If YES → Continue to Check 2

4. **Refresh the page** (sometimes UI is stale)
5. **Is it still ON?**
   - If NO → Turn ON, Save, Refresh again

---

## ✅ Check 2: Email Confirmations Enabled

1. **Go to:** Authentication → Providers → Email
2. **Find "Enable email confirmations"**
3. **Is it ON/enabled?**
   - If NO → Turn it ON, click Save
   - If YES → Continue to Check 3

**This is critical!** If email confirmations are OFF, Supabase won't send emails.

---

## ✅ Check 3: SMTP Settings Are Saved

1. **Go to:** Settings → Auth → SMTP Settings
2. **Verify all fields are filled:**
   - Host: `smtp.resend.com`
   - Port: `465` or `587`
   - User: `resend`
   - Password: [Your API key]
   - Sender: `noreply@savrgrocery.com`
   - Name: `SAVR`

3. **Click "Save" button** (even if unchanged)
4. **Wait 10 seconds**
5. **Refresh the page**
6. **Are all fields still there?**
   - If NO → Re-enter and Save again
   - If YES → Continue to Check 4

---

## ✅ Check 4: API Key is Correct

1. **Go to:** Resend Dashboard → API Keys
2. **Copy your API key** (starts with `re_`)
3. **Go to:** Supabase → Settings → Auth → SMTP Settings
4. **Paste API key in "SMTP Password" field**
5. **Make sure:**
   - No extra spaces before/after
   - No line breaks
   - Exact copy from Resend
6. **Click Save**

---

## ✅ Check 5: Try Port 587

Sometimes port 465 doesn't work:

1. **Supabase** → Settings → Auth → SMTP Settings
2. **Change Port to:** `587`
3. **Click Save**
4. **Wait 2 minutes**
5. **Try signup**

If 587 doesn't work, try 465 again.

---

## ✅ Check 6: Complete Reset

If nothing above works:

1. **Turn "Custom SMTP" OFF**
2. **Save**
3. **Wait 30 seconds**
4. **Turn "Custom SMTP" ON**
5. **Re-enter ALL fields:**
   ```
   Host: smtp.resend.com
   Port: 587
   User: resend
   Password: [Fresh API key from Resend]
   Sender: noreply@savrgrocery.com
   Name: SAVR
   ```
6. **Click Save**
7. **Wait 2-3 minutes**
8. **Test signup**

---

## 🎯 Most Likely Issue

Based on your symptoms (no errors, no emails in Resend):

**90% chance it's one of these:**
1. "Enable email confirmations" is OFF
2. "Custom SMTP" toggle not actually enabled
3. Settings not saved (refresh shows they're gone)

**Check these first!**

---

## 📊 What to Verify Right Now

1. **Authentication → Providers → Email**
   - Is "Enable email confirmations" ON? ✅/❌

2. **Settings → Auth → SMTP Settings**
   - Is "Enable Custom SMTP" ON? ✅/❌
   - Are all fields filled? ✅/❌
   - Did you click Save? ✅/❌

3. **After saving, refresh page**
   - Are settings still there? ✅/❌

---

## 🆘 If Still Not Working

Share:
1. Screenshot of "Enable email confirmations" setting (is it ON?)
2. Screenshot of SMTP Settings page (hide API key)
3. After clicking Save, does it show "Settings saved" or any confirmation?

This will help identify the exact issue!


