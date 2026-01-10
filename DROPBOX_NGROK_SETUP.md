# Dropbox + ngrok Setup (5 Minutes)

## The Problem
- Dropbox Chooser runs on HTTPS
- Your localhost is HTTP  
- Browsers block HTTPS → HTTP communication (mixed content security)
- Error: "Could not find host site window"

## The Solution: ngrok (Free HTTPS Tunnel)

### Step 1: Install ngrok
```bash
# macOS
brew install ngrok

# Or download from: https://ngrok.com/download
# Then unzip and move to /usr/local/bin/
```

### Step 2: Create free ngrok account (optional but recommended)
```bash
# Sign up at https://dashboard.ngrok.com/signup (free)
# Get your authtoken from dashboard
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 3: Start your Next.js dev server
```bash
npm run dev
# Keep this running in terminal 1
```

### Step 4: Start ngrok tunnel
```bash
# In a NEW terminal
ngrok http 3000
```

You'll see:
```
Forwarding  https://abc123-def456.ngrok.io -> http://localhost:3000
```

### Step 5: Add ngrok domain to Dropbox
1. Copy the ngrok domain: `abc123-def456.ngrok.io`
2. Go to: https://www.dropbox.com/developers/apps
3. Click your app (key: `tgtfykx9u7aqyn2`)
4. Go to "Settings" tab
5. Scroll to "Chooser / Saver / Embedder domains"
6. Click "Add" and enter: `abc123-def456.ngrok.io` (no https://)
7. Click "Save"
8. Wait 1-2 minutes for changes to propagate

### Step 6: Use ngrok URL
Instead of `http://localhost:3000`, open:
```
https://abc123-def456.ngrok.io
```

**That's it!** Dropbox will now work because both are HTTPS.

## Tips

### Free ngrok URL changes each time
- Each time you restart ngrok, you get a new URL
- You'll need to add the new domain to Dropbox each time
- **Solution:** Sign up for free ngrok account and use reserved domain (or upgrade to paid for permanent domain)

### Keep ngrok running
- Keep both terminals running:
  - Terminal 1: `npm run dev` (Next.js)
  - Terminal 2: `ngrok http 3000` (tunnel)
- If ngrok stops, Dropbox won't work

### For production
- Once deployed to `munyardmixer.com`, add that domain to Dropbox
- No ngrok needed for production

## Alternative: HTTPS Localhost

If you prefer to use localhost directly, set up HTTPS:
1. Install mkcert: `brew install mkcert && mkcert -install`
2. Generate cert: `mkcert localhost`
3. Update `package.json`:
```json
"dev:https": "next dev --experimental-https --experimental-https-key ./localhost-key.pem --experimental-https-cert ./localhost.pem"
```
4. Run: `npm run dev:https`
5. Access: `https://localhost:3000`
6. Add `localhost` to Dropbox domains

---

**Recommendation:** Use ngrok for development - it's fastest and most reliable.
