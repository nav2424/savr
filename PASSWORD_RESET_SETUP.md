# Password Reset – Setup and Configuration

## Overview

The password reset flow allows users to reset their password via email. When a user clicks "Forgot password?" on the sign-in screen, they receive an email with a reset link that opens the app.

## Flow

1. User enters email on sign-in screen and taps "Forgot password?"
2. App calls `supabase.auth.resetPasswordForEmail()` with redirect URL `savr://password-reset`
3. User receives email with reset link
4. User clicks link → app opens at `/password-reset` screen
5. User enters new password and confirms
6. Password is updated and user is redirected to sign-in

## Supabase Configuration

### 1. Add Redirect URL

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - `savr://password-reset`
3. Optional: add `savr://**` to allow any path under the `savr` scheme
4. Save

### 2. Email Template (Optional)

Supabase uses a default password reset email template. To customize:

1. Go to **Authentication** → **Email Templates**
2. Select **Reset Password** template
3. Customize the message (the `{{ .ConfirmationURL }}` variable contains the reset link)
4. Save

## Environment Variable (Optional)

If you want to use a different redirect URL (e.g., for web fallback):

```bash
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL=https://yourapp.com/password-reset
```

If not set, defaults to `savr://password-reset`.

## Testing

1. **Test forgot password flow:**
   - Go to sign-in screen
   - Enter a valid email address
   - Tap "Forgot password?"
   - Check email inbox for reset link

2. **Test reset link:**
   - Click the reset link in email
   - App should open at password reset screen
   - Enter new password and confirm
   - Should see success message and redirect to sign-in

3. **Test error cases:**
   - Invalid email format → shows validation error
   - Expired link → shows "Session Expired" alert
   - Password mismatch → shows validation error
   - Password too short → shows validation error

## Troubleshooting

### Reset link doesn't open app

- **Check Supabase Redirect URLs:** Ensure `savr://password-reset` is in the allow list
- **Check email link:** The link should start with `savr://password-reset#access_token=...`
- **Check app scheme:** Verify `app.config.js` has `scheme: "savr"`

### Reset email not received

- **Check SMTP:** Same as email verification (see `SMTP_SETUP_COMPLETE.md`)
- **Check spam folder:** Reset emails may be filtered
- **Check Supabase logs:** Go to **Authentication** → **Logs** to see delivery status

### "Session Expired" error

- Reset links expire after a set time (default: 1 hour)
- User must request a new reset link
- Check Supabase **Authentication** → **Settings** → **Password Reset** for expiration settings

### Password update fails

- Ensure user has a valid session (link was clicked and processed)
- Check Supabase logs for specific error
- Verify password meets requirements (min 6 characters)

## Security Notes

- Reset links are single-use and expire after a set time
- Users must be authenticated (via the reset link) to change password
- Password validation enforces minimum length (6 characters)
- Old password is not required for reset (by design)
