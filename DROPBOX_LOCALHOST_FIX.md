# Quick Fix: Use ngrok for Dropbox Localhost Development

## The Problem:
Dropbox Chooser runs on HTTPS, but your localhost is HTTP. Browsers block communication between HTTPS and HTTP (mixed content security).

## Solution: Use ngrok (5 minutes)

### Step 1: Install ngrok
```bash
# macOS
brew install ngrok

# Or download from: https://ngrok.com/download
```

### Step 2: Run ngrok
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123-def456.ngrok.io -> http://localhost:3000
```

### Step 3: Add ngrok domain to Dropbox
1. Copy the ngrok domain (e.g., `abc123-def456.ngrok.io`)
2. Go to Dropbox App Console → Your App → Settings
3. Add `abc123-def456.ngrok.io` to "Chooser / Saver / Embedder domains"
4. Save and wait 1-2 minutes

### Step 4: Use ngrok URL
Instead of `http://localhost:3000`, use `https://abc123-def456.ngrok.io`

**Done!** Dropbox will now work because both are HTTPS.

## Alternative: Use HTTPS for Localhost

If you want to stick with localhost, you need to set up HTTPS:

### Option A: Next.js HTTPS (Recommended)
1. Install mkcert: `brew install mkcert && mkcert -install`
2. Generate cert: `mkcert localhost`
3. Update package.json:
```json
"dev:https": "next dev --experimental-https --experimental-https-key ./localhost-key.pem --experimental-https-cert ./localhost.pem"
```
4. Run: `npm run dev:https`
5. Access: `https://localhost:3000`

Then add `localhost` to Dropbox (should work with HTTPS).

### Option B: Use 127.0.0.1 instead
Try adding `127.0.0.1` to Dropbox domains instead of `localhost`.

---

**Recommendation:** Use ngrok for now - it's the fastest solution and will work immediately.
