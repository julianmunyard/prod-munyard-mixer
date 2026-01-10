# Alternative Solution: Use ngrok or Similar Tunnel

If you can't add `localhost` to Dropbox domains (Add button greyed out), use a tunnel service:

## Option 1: Use ngrok (Recommended)

### Setup:
1. Install ngrok: https://ngrok.com/download
2. Run your Next.js dev server: `npm run dev`
3. In a new terminal, run: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Add that URL's domain (e.g., `abc123.ngrok.io`) to Dropbox App Console
6. Access your app via the ngrok URL instead of localhost

**Pros:**
- Works when Dropbox console is broken
- Can share with team members
- HTTPS (required by some services)

**Cons:**
- Free tier has limitations
- URL changes each time (unless paid plan)
- Requires separate terminal

## Option 2: Use Cloudflare Tunnel (Free, Permanent)

1. Install Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/
2. Create a tunnel: `cloudflared tunnel create munyard-mixer`
3. Configure route to localhost:3000
4. Get permanent URL
5. Add that domain to Dropbox

**Pros:**
- Free forever
- Permanent URL
- More reliable

**Cons:**
- Slightly more setup
- Requires Cloudflare account

## Option 3: Use Production Domain

If you have `munyardmixer.com` already set up:
1. Deploy to production (even staging subdomain)
2. Use production/staging URL for testing
3. Dropbox works with production domain

**Pros:**
- No extra setup
- Tests real environment

**Cons:**
- Requires deployment
- Slower development cycle

## Quick Fix for Development

For now, while you troubleshoot the Dropbox console:
- Keep testing locally without Dropbox integration
- Use local file upload (device button) for development
- Set up Dropbox properly when ready for production testing
