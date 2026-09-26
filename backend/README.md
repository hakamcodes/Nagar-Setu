# Nagar Setu - Backend

A thin proxy in front of AI providers. Its only job is to hold
`ANTHROPIC_API_KEY` and `GROQ_API_KEY` server-side so neither is ever shipped
to the browser. It does not touch Firebase/Firestore - those stay as direct
client SDK calls in the frontend, which is how Firebase is designed to be used.

## Endpoints

- `GET /health` - liveness check.
- `POST /ai/classify` - body `{ description, imageData, zoneName, regionName }`,
  returns the structured-classification JSON.
- `POST /ai/briefing` - body `{ stats, region }`, returns `{ text }`.

Both AI routes try Anthropic Claude first; if that call fails, they silently
retry against Groq before giving up - the caller never knows which provider
answered. If both fail or aren't configured, the frontend automatically falls
back to its own deterministic heuristic - the app keeps working either way.

Both routes are rate-limited (20 requests/minute per IP) and reject malformed
input (missing/oversized `description`, non-string fields, etc.) before
calling any provider.

## Run locally

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY (and optionally GROQ_API_KEY)
npm install
npm run dev
```

Then point the frontend at it: set `VITE_BACKEND_API_BASE_URL=http://localhost:8787`
in `frontend/.env`.

## Deploy on Render

1. [Render dashboard](https://dashboard.render.com) -> New -> Web Service ->
   connect this GitHub repository.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Add environment variables: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
   (`claude-opus-5`), and optionally `GROQ_API_KEY`/`GROQ_MODEL` for the
   backup provider. Leave `ALLOWED_ORIGIN` as `*` only for the very first
   deploy.
6. Deploy, then copy the resulting `https://<name>.onrender.com` URL - the
   frontend needs it as `VITE_BACKEND_API_BASE_URL`.
7. Once the frontend is deployed on Vercel, come back here and set
   `ALLOWED_ORIGIN` to the exact Vercel URL, then redeploy. **Do not leave
   this as `*` in production** - it lets any website call these endpoints
   using your API keys.

Render's free tier spins down on inactivity - the first request after idle can
take a few seconds while it wakes up; the frontend's fallback chain handles
that gracefully (it just falls through to the heuristic if the request times
out or errors).
