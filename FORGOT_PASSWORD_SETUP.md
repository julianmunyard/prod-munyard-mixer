# Forgot Password Setup Guide

## Changes Made

✅ **Fixed the forgot password flow** to use PKCE authentication
✅ **Made redirect URL dynamic** (works in both dev and production)
✅ **Improved reset password page** to handle both PKCE and legacy flows

## Required Supabase Dashboard Configuration

To get the forgot password flow working, you need to configure these settings in your Supabase dashboard:

### 1. Configure Redirect URLs

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add these URLs to **Redirect URLs**:
   - `http://localhost:3000/reset-password` (for local development)
   - `https://munyardmixer.com/reset-password` (for production)
   - `https://prod-munyard-mixer.vercel.app/reset-password` (if you have a staging domain)

### 2. Configure Email Templates (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Click on **Reset Password** template
3. Customize the email if desired
4. Make sure the **Redirect URL** in the template points to: `{{ .ConfirmationURL }}`

The email template should include a link like:
```
{{ .ConfirmationURL }}
```

### 3. Enable Email Provider

1. Go to **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. Configure SMTP settings if you want to use custom email (optional)

### 4. Test the Flow

1. Navigate to `/forgot-password` on your site
2. Enter an email address
3. Check your email for the reset link
4. Click the link - it should redirect to `/reset-password` with a code
5. Enter a new password and submit

## Troubleshooting

### Issue: "Invalid redirect URL"
- **Solution**: Make sure you've added the redirect URLs in Supabase dashboard (step 1 above)
- The URL must match exactly (including `http://` vs `https://`)

### Issue: "Link expired or invalid"
- **Solution**: Reset password links expire after 1 hour by default
- Request a new link if the old one expired

### Issue: "Email not received"
- **Solution**: 
  - Check spam folder
  - Verify email provider is enabled in Supabase
  - Check Supabase logs for email sending errors
  - If using custom SMTP, verify SMTP credentials

### Issue: Code exchange fails
- **Solution**: 
  - Make sure you're using PKCE flow (now enabled by default in the code)
  - Clear browser cache and try again
  - Make sure the redirect URL in Supabase matches your site URL

## Code Changes Summary

### `app/forgot-password/page.tsx`
- Added `flowType: 'pkce'` to enable PKCE flow
- Changed redirect URL to be dynamic based on current origin

### `app/reset-password/page.tsx`
- Improved session detection (checks existing session first)
- Better handling of PKCE code exchange
- Added fallback for legacy flow

## Testing Checklist

- [ ] Redirect URLs configured in Supabase
- [ ] Email provider enabled
- [ ] Test forgot password flow in development
- [ ] Test forgot password flow in production
- [ ] Verify email is received
- [ ] Verify reset link works
- [ ] Verify password can be changed
- [ ] Verify login works with new password
