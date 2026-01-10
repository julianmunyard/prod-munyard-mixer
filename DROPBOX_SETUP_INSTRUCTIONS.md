# Dropbox Setup Instructions - FIX MISCONFIGURATION ERROR

## Current Error:
"App is misconfigured - Could not communicate"

This happens because your **localhost:3000** domain is not registered in your Dropbox app.

## Step-by-Step Fix:

### 1. Go to Dropbox App Console
Open: https://www.dropbox.com/developers/apps

### 2. Find Your App
- Look for the app with key: **tgtfykx9u7aqyn2**
- Click on it to open settings

### 3. Go to Settings Tab
- Click on the **"Settings"** tab in your app dashboard

### 4. Register Domains
Scroll down to **"Chooser / Saver / Embedder domains"** section

Add the following domains (one per line, NO http:// or https://):
```
localhost
munyardmixer.com
```

**IMPORTANT (from Dropbox official docs):**
- ✅ Use `localhost` (WITHOUT the port number `:3000`)
- ✅ Use `munyardmixer.com` (without www, without https://)
- ❌ DON'T include `http://` or `https://`
- ❌ DON'T include port numbers like `:3000`
- ❌ DON'T include trailing slashes
- ❌ DON'T include paths

**Why just `localhost`?**
Dropbox automatically handles all ports for localhost. When you register `localhost`, it works for `localhost:3000`, `localhost:8080`, etc.

### 5. Save Changes
- Click **"Save"** button at the bottom
- Wait **1-2 minutes** for changes to propagate through Dropbox's systems

### 6. Test Again
- Refresh your browser page
- Clear browser cache if needed (Cmd/Ctrl + Shift + R)
- Try the Dropbox button again

## Verification:

After saving, the domains section should show:
```
Chooser / Saver / Embedder domains:
localhost
munyardmixer.com
```

## Troubleshooting:

### "Add" Button is Greyed Out / Disabled:

If the "Add" button is disabled even after typing `localhost`:

1. **Type in the input field first:**
   - Click in the text input field
   - Type exactly: `localhost` (no spaces, no quotes)
   - The button should enable when valid text is entered

2. **Check browser console for errors:**
   - Press F12 to open developer tools
   - Check Console tab for JavaScript errors
   - Fix any errors that might be blocking the form

3. **Try different browsers:**
   - Try Chrome, Firefox, or Safari
   - Sometimes browser extensions interfere

4. **Clear browser cache/cookies:**
   - Clear cache for dropbox.com
   - Or try incognito/private mode

5. **Check if localhost already exists:**
   - Look carefully at the list above the input
   - `localhost` might already be there but not visible
   - Try refreshing the page

6. **Try using 127.0.0.1 instead:**
   - Some users report `127.0.0.1` works when `localhost` doesn't
   - Add `127.0.0.1` as an alternative

7. **Manual domain entry (if available):**
   - Some Dropbox apps allow comma-separated domains
   - Try: `localhost,munyardmixer.com` in one field

8. **Contact Dropbox support:**
   - If nothing works, contact Dropbox developer support
   - They may need to enable domain editing for your app

### Still getting error after 2 minutes?
1. **Double-check the format**: Make sure it's exactly `localhost` (NO port, NO http://)
2. **Check for typos**: Make sure there are no extra spaces
3. **Check app key**: Verify you're editing the correct app (key: tgtfykx9u7aqyn2)
4. **Clear browser cache**: Hard refresh with Cmd/Ctrl + Shift + R
5. **Wait longer**: Sometimes it takes 3-5 minutes for changes to propagate

### Note about localhost:
According to Dropbox's official documentation, you should register just `localhost` (without the port). Dropbox automatically handles all ports (3000, 8080, etc.) when `localhost` is registered.

### Production Deployment:
When deploying to production (munyardmixer.com), make sure:
- `munyardmixer.com` is in the domains list
- Your production URL matches exactly (no www prefix)
- Wait for DNS to propagate if domain was just changed

## Quick Test:
After setup, you should see in browser console:
- `✅ Dropbox ready` 
- When clicking button: Dropbox chooser opens (not error page)
