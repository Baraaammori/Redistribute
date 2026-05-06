# Redistribute.io — simple-saas

**Post once. Everywhere.** Cross-platform video distribution for creators.

Connect YouTube, TikTok, and Instagram → pick a video → choose destinations → we handle the rest.  
**Auto-Republish** detects new videos on your source platform and distributes them automatically (Pro plan).

---

## What's in this branch

This is the `simple-saas` branch — a lean, production-hardened version of the app.

**Removed from `main`:**
- Shop / cart / product admin
- Caption Studio (Whisper transcription + subtitle burn-in)
- B-Roll editor
- AI clip generator
- Watermark settings
- Admin dashboard

**Added / hardened:**
- Shared OAuth token refresh (`lib/tokenRefresh.js`) covering all three platforms
- Instagram upload fully implemented (Supabase Storage temp URL → IG Reels container → publish)
- Auto-Republish engine: BullMQ poller every 10 min detects new videos on source platforms
- Auto-Republish frontend: per-account toggle, activity feed, overview stats card
- Jest test suite (`Backend/tests/core-flow.test.js`)
- GitHub Actions CI/CD pipeline (lint → test → build → deploy)

---

## Quick Start

### Prerequisites
- Node.js v18+
- [Supabase](https://supabase.com) project (free tier works)
- Redis (local or [Upstash](https://upstash.com) free tier)
- Stripe account (test mode)
- Platform OAuth apps (see below)

---

## 1. Database Setup

Run these in your Supabase project → **SQL Editor**, in order:

```sql
-- Core schema (if starting fresh)
-- paste supabase_schema.sql

-- simple-saas migrations
-- paste Backend/migrations/001_drop_shop_items.sql
-- paste Backend/migrations/002_auto_republish.sql
```

`002_auto_republish.sql` adds four columns to `platform_accounts` and creates the `auto_republish_jobs` table with RLS.

---

## 2. Backend Setup

```bash
cd Backend
npm install
cp .env.example .env   # fill in your values
npm run dev            # nodemon with --max-old-space-size=450
npm start              # production
```

Server runs on `http://localhost:5000`.

### Environment variables

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# JWT
JWT_SECRET=          # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_WEBHOOK_SECRET=

# YouTube OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/accounts/youtube/callback

# TikTok OAuth
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:5000/api/accounts/tiktok/callback

# Instagram / Facebook OAuth
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=http://localhost:5000/api/accounts/instagram/callback

# CORS
FRONTEND_URL=http://localhost:3000
```

---

## 3. Platform OAuth Setup

### YouTube (~10 minutes)
1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. APIs & Services → Enable **YouTube Data API v3**
3. Credentials → Create OAuth 2.0 Client → Web app
4. Add redirect URI: `http://localhost:5000/api/accounts/youtube/callback`
5. Copy Client ID and Secret → `.env`

### TikTok (sandbox available, production needs review)
1. [developers.tiktok.com](https://developers.tiktok.com) → Create app
2. Request scopes: `video.list`, `video.upload`
3. Add redirect URI: `http://localhost:5000/api/accounts/tiktok/callback`
4. Use sandbox mode for testing with your own account

### Instagram (requires Facebook Business/Creator account)
1. [developers.facebook.com](https://developers.facebook.com) → Create app → Consumer type
2. Add **Instagram Graph API** product
3. Add redirect URI: `http://localhost:5000/api/accounts/instagram/callback`
4. Add your Instagram as a test user

> **Tip:** Start with YouTube — fastest approval and lets you test the full flow end-to-end.

---

## 4. Frontend Setup

```bash
cd Frontend
npm install
cp .env.example .env
# REACT_APP_API_URL=http://localhost:5000
npm start
```

App runs on `http://localhost:3000`.

---

## 5. Running Tests

```bash
cd Backend
npm test
```

Tests are in `Backend/tests/core-flow.test.js`. All external dependencies (Supabase, BullMQ, googleapis, axios) are mocked — no real credentials needed.

Covered cases:
- Create repost (pro user, happy path)
- Missing destinations → 400
- Free plan monthly limit → 403
- YouTube OAuth URL generation
- Token expiry detection logic

---

## Project Structure

```
redistribute2.0/
├── Backend/
│   ├── server.js                    # Express entry + BullMQ poller init
│   ├── lib/
│   │   ├── supabase.js              # Supabase client
│   │   ├── tokenRefresh.js          # Shared OAuth token refresh (YT/TikTok/IG)
│   │   ├── ffmpeg.js                # FFprobe analysis, clip cut, thumbnail
│   │   └── storage.js               # Supabase Storage upload helper
│   ├── middleware/auth.js           # JWT middleware
│   ├── workers/
│   │   └── autoRepublishPoller.js  # BullMQ repeatable job (*/10 * * * *)
│   ├── routes/
│   │   ├── auth.js                  # /api/auth/*
│   │   ├── accounts.js              # /api/accounts/* (OAuth + auto-republish status)
│   │   ├── videos.js                # /api/videos/* (fetch from platforms)
│   │   ├── reposts.js               # /api/reposts/* (create + BullMQ worker)
│   │   ├── autoRepublish.js         # /api/auto-republish/*
│   │   └── stripe.js                # /api/stripe/*
│   ├── migrations/
│   │   ├── 001_drop_shop_items.sql
│   │   └── 002_auto_republish.sql
│   ├── tests/
│   │   └── core-flow.test.js
│   └── package.json
│
├── Frontend/
│   ├── src/
│   │   ├── App.tsx                  # Router (no admin/shop/captions routes)
│   │   ├── lib/api.ts               # API client
│   │   ├── contexts/AuthContext.tsx
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── pages/
│   │       ├── Landing/             # Home, About, Pricing, Contact
│   │       ├── auth/                # Login, Register
│   │       └── Dashboard/
│   │           ├── Dashboard.tsx    # Sidebar + all sub-views
│   │           ├── AutoRepublish.tsx # Activity feed
│   │           └── ...
│   └── package.json
│
├── .github/workflows/deploy.yml     # CI/CD pipeline
└── supabase_schema.sql
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/accounts` | List connected platform accounts |
| GET | `/api/accounts/youtube/auth` | YouTube OAuth URL |
| GET | `/api/accounts/tiktok/auth` | TikTok OAuth URL |
| GET | `/api/accounts/instagram/auth` | Instagram OAuth URL |
| GET | `/api/accounts/auto-republish-status` | Auto-republish settings per account |
| GET | `/api/videos` | Fetch videos from connected platforms |
| POST | `/api/reposts` | Create a repost job |
| GET | `/api/reposts` | List repost queue |
| PATCH | `/api/auto-republish/accounts/:platform` | Enable/configure auto-republish (Pro) |
| GET | `/api/auto-republish/activity` | Auto-republish job history |
| PATCH | `/api/auto-republish/:jobId/retry` | Retry a failed auto-republish job |
| POST | `/api/stripe/checkout` | Create checkout session |
| POST | `/api/stripe/webhook` | Stripe webhook handler |
| GET | `/api/stripe/portal` | Customer portal URL |

---

## Auto-Republish

Auto-Republish is a **Pro-only** feature. When enabled for a platform account:

1. A BullMQ repeatable job runs every 10 minutes (`*/10 * * * *`)
2. For each enabled account, the poller fetches the latest video from the source platform
3. If the video ID has changed since last poll, a distribution job is queued
4. The job is processed by the existing repost worker (same flow as manual reposts)
5. Progress is tracked in the `auto_republish_jobs` table

### Enable via Dashboard

Dashboard → Accounts → toggle **Auto-Republish** on any connected account → select target platforms → Save.

### Enable via API

```bash
curl -X PATCH /api/auto-republish/accounts/youtube \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "target_platforms": ["tiktok", "instagram"]}'
```

---

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `simple-saas`:

1. **Lint** — `tsc --noEmit` on frontend
2. **Test** — `npm test` on backend (Jest, mocked dependencies)
3. **Build** — `npm run build` on frontend (artifact uploaded)
4. **Deploy Frontend** — Vercel via `amondnet/vercel-action`
5. **Deploy Backend** — Render deploy hook (POST)

### Required GitHub Secrets

| Secret | Where to find it |
|--------|-----------------|
| `REACT_APP_API_URL` | Your Render backend URL |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General |
| `RENDER_DEPLOY_HOOK` | Render → Service → Settings → Deploy Hook |

---

## Deployment

**Frontend (Vercel):**
```
Build command: npm run build
Output directory: build
Root directory: redistribute2.0/Frontend
Env: REACT_APP_API_URL=https://your-backend.onrender.com
```

**Backend (Render):**
- Set all backend env vars in Render dashboard
- `NODE_ENV=production`
- Update `FRONTEND_URL` to your Vercel URL
- Update all OAuth redirect URIs to your production backend URL

---

Built by Mohammed Awad.
