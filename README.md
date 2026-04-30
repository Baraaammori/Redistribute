# Redistribute.io

**Post once. Everywhere.** Cross-platform video distribution for creators.

Connect YouTube, TikTok, and Instagram → pick a video → choose destinations → we handle the upload.

---

## Quick Start

### Prerequisites
- Node.js v18+
- A [Supabase](https://supabase.com) project (free tier works)
- Redis (local or [Upstash](https://upstash.com) free tier)
- Stripe account (free, test mode)
- Platform OAuth apps (see below)

---

## 1. Database Setup

1. Go to your Supabase project → **SQL Editor**
2. Paste and run the contents of `supabase_schema.sql`
3. This creates `users`, `platform_accounts`, `reposts`, and `shop_items` tables

---

## 2. Backend Setup

```bash
cd Backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials (see comments in the file), then:

```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server runs on `http://localhost:5000`

### Getting your credentials

**Supabase:**
- Go to supabase.com → your project → Settings → API
- Copy `Project URL` → `SUPABASE_URL`
- Copy `service_role` secret key → `SUPABASE_SERVICE_KEY`

**JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Redis:**
- Local: install Redis and use `redis://localhost:6379`
- Cloud: sign up at [upstash.com](https://upstash.com), create a Redis DB, copy the URL

**Stripe:**
- Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys
- Copy `Secret key` → `STRIPE_SECRET_KEY`
- Create a Product → Recurring price of $12/mo → copy `price_id` → `STRIPE_PRO_PRICE_ID`
- Webhooks → Add endpoint `http://localhost:5000/api/stripe/webhook` → copy secret → `STRIPE_WEBHOOK_SECRET`
- For local testing: `stripe listen --forward-to localhost:5000/api/stripe/webhook`

---

## 3. Platform OAuth Setup

### YouTube (easiest, ~10 minutes)
1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. APIs & Services → Enable "YouTube Data API v3"
3. Credentials → Create OAuth 2.0 Client → Web app
4. Add redirect URI: `http://localhost:5000/api/accounts/youtube/callback`
5. Copy Client ID and Secret → `.env`

### TikTok (1-2 weeks for production approval)
1. [developers.tiktok.com](https://developers.tiktok.com) → Create app
2. Request scopes: `video.list`, `video.upload`
3. Add redirect URI: `http://localhost:5000/api/accounts/tiktok/callback`
4. Use sandbox mode for testing with your own account

### Instagram (requires Facebook Business account)
1. [developers.facebook.com](https://developers.facebook.com) → Create app → Consumer type
2. Add Instagram Basic Display product
3. Add redirect URI: `http://localhost:5000/api/accounts/instagram/callback`
4. Add your Instagram as a test user

> **Tip for early development:** Start with YouTube only. It's the fastest to approve and lets you test the full flow. Add TikTok and Instagram once your core product works.

---

## 4. Frontend Setup

```bash
cd Frontend
npm install
cp .env.example .env
# .env only needs: REACT_APP_API_URL=http://localhost:5000
npm start
```

App runs on `http://localhost:3000`

---

## Project Structure

```
redistribute/
├── Backend/
│   ├── server.js              # Express entry point
│   ├── lib/supabase.js        # Supabase client
│   ├── middleware/auth.js     # JWT middleware
│   ├── routes/
│   │   ├── auth.js            # /api/auth/*
│   │   ├── admin.js           # /api/admin/*
│   │   ├── shop.js            # /api/shop/*
│   │   ├── accounts.js        # /api/accounts/* (OAuth)
│   │   ├── videos.js          # /api/videos/* (fetch from platforms)
│   │   ├── reposts.js         # /api/reposts/* (create + BullMQ worker)
│   │   └── stripe.js          # /api/stripe/*
│   ├── package.json
│   └── .env.example
│
├── Frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.tsx            # Router
│   │   ├── index.tsx
│   │   ├── lib/api.ts         # API client
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   └── CartContext.tsx
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── pages/
│   │       ├── Landing/       # Home, About, Pricing, Contact
│   │       ├── auth/          # Login, Register
│   │       ├── Dashboard/     # Full dashboard with sidebar
│   │       ├── admin/         # Admin login + product CRUD
│   │       ├── Shopping.tsx
│   │       └── Cart.tsx
│   ├── package.json
│   └── .env.example
│
└── supabase_schema.sql        # Run this first in Supabase SQL Editor
```

---

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/about` | About page |
| `/pricing` | Pricing page |
| `/contact` | Contact page |
| `/shopping` | Creator equipment shop |
| `/cart` | Shopping cart |
| `/login` | User login |
| `/register` | User register |
| `/dashboard` | Overview |
| `/dashboard/repost` | New repost wizard |
| `/dashboard/queue` | Repost queue |
| `/dashboard/accounts` | Connected platforms |
| `/dashboard/billing` | Plan + Stripe portal |
| `/admin/login` | Admin login |
| `/admin` | Product management |

---

## Deployment

**Frontend (Vercel):**
```
Build command: npm run build
Output dir: build
Env var: REACT_APP_API_URL=https://your-backend.com
```

**Backend (Render / Fly.io / Railway):**
- Set all `.env` variables in the hosting platform
- Make sure `NODE_ENV=production`
- Update `FRONTEND_URL` to your production frontend URL
- Update all OAuth redirect URIs to use your production backend URL

---

Built by Mohammed Awad. Creative Commons license.
