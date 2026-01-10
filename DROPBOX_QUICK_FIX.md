# Dropbox Quick Fix - What You Need to Do

## For PRODUCTION (munyardmixer.com) - This fixes it for ALL users:

1. **Go to Dropbox App Console**: https://www.dropbox.com/developers/apps
2. **Click your app** (key: `tgtfykx9u7aqyn2`)
3. **Go to "Settings" tab**
4. **Find "Chooser / Saver / Embedder domains"**
5. **Add**: `munyardmixer.com` (no https://, no www)
6. **Click "Save"**
7. **Wait 2-3 minutes** for changes to propagate

**That's it!** Once `munyardmixer.com` is registered, ALL users accessing your production site will be able to use Dropbox.

---

## For LOCAL DEVELOPMENT (localhost:3000) - Only for you:

If you're testing locally and getting the error, you have 2 options:

### Option 1: Use ngrok (Quick)
1. Install: `brew install ngrok`
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `abc123.ngrok.io`)
4. Add that domain to Dropbox
5. Use the ngrok URL instead of localhost

### Option 2: Just test on production
- Skip local testing
- Deploy to production
- Test Dropbox on `munyardmixer.com` (once domain is added)

---

## IMPORTANT:
- **Production users**: Don't need ngrok, don't need anything installed
- **Just you (developer)**: Need ngrok only if testing locally
- **Production site**: Works once `munyardmixer.com` is added to Dropbox domains

The mixed content error only happens when testing locally with HTTP. Production HTTPS works fine once the domain is registered.
