# ngrok Quick Setup

## Step 1: Create Free ngrok Account
1. Go to: https://dashboard.ngrok.com/signup
2. Sign up with email (free account)
3. Verify your email

## Step 2: Get Your Authtoken
1. After logging in, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy your authtoken (long string of characters)

## Step 3: Install Authtoken
Run this command (replace YOUR_AUTH_TOKEN with the token you copied):
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Step 4: Start ngrok
```bash
ngrok http 3000
```

You'll see:
```
Forwarding  https://abc123-def456.ngrok.io -> http://localhost:3000
```

## Step 5: Add ngrok Domain to Dropbox
1. Copy the ngrok domain (e.g., `abc123-def456.ngrok.io`)
2. Go to: https://www.dropbox.com/developers/apps
3. Your app → Settings → "Chooser / Saver / Embedder domains"
4. Add the ngrok domain
5. Save and wait 1-2 minutes

## Step 6: Use ngrok URL
Open `https://abc123-def456.ngrok.io` instead of `localhost:3000`

**Done!** Dropbox will work because both are HTTPS.
