# Quick Fix: HTTPS for Localhost (Fix Dropbox Communication)

## The Problem
Browsers block HTTPS (Dropbox) → HTTP (localhost) communication. You need HTTPS for localhost.

## ✅ Already Done:
- mkcert installed
- SSL certificates created (`localhost+1.pem` and `localhost+1-key.pem`)

## Final Step - Install Trust Certificate:

Run this command (you'll need to enter your Mac password):
```bash
mkcert -install
```

This trusts the certificate so your browser won't show warnings.

## Then Use HTTPS Dev Server:

Instead of `npm run dev`, use:
```bash
npm run dev:https
```

Your app will be at: **https://localhost:3000** (note the HTTPS!)

## Add localhost to Dropbox:

1. Go to: https://www.dropbox.com/developers/apps
2. Your app → Settings → "Chooser / Saver / Embedder domains"
3. Add: `localhost` (already done, but verify it's there)
4. Save

## Test:

1. Open: `https://localhost:3000` (HTTPS, not HTTP!)
2. Click Dropbox button
3. Should work now because both are HTTPS!

---

**Note:** If you get a browser security warning about the certificate, click "Advanced" → "Proceed to localhost". This is normal for self-signed certificates.
