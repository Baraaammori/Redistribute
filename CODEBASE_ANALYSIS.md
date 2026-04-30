# Redistribute 2.0 — Codebase Analysis
> What's built, what's missing, and what needs to change to become UploadOnce AI

---

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React (CRA) + TypeScript + inline styles |
| Backend | Node.js + Express |
| Queue | BullMQ + IORedis |
| Database | Supabase (PostgreSQL) |
| Billing | Stripe (Checkout + Portal + Webhooks) |
| Auth | Custom JWT (not Supabase Auth) |
| Storage | None (downloads video to /tmp) |
| Video Processing | None (no FFmpeg at all) |

---

## ✅ What IS Built (Working Features)

### Backend — Express API
| Route File | What It Does | Status |
|---|---|---|
| `routes/auth.js` | Register + Login with JWT | ✅ Done |
| `routes/accounts.js` | YouTube + TikTok + Instagram OAuth | ✅ Done |
| `routes/videos.js` | Fetch videos from YouTube / TikTok / Instagram | ✅ Done |
| `routes/reposts.js` | Create repost job + BullMQ worker + YouTube/TikTok upload | ✅ Done |
| `routes/stripe.js` | Stripe Checkout + Portal + Webhooks | ✅ Done |
| `routes/shop.js` | Shop items CRUD | ✅ Done |
| `routes/admin.js` | Admin login endpoint | ✅ Done |
| `middleware/auth.js` | JWT auth middleware | ✅ Done |

### Frontend — React App
| Page | What It Does | Status |
|---|---|---|
| Landing + About + Pricing + Contact | Marketing pages | ✅ Done |
| Login + Register | Auth pages | ✅ Done |
| Dashboard Overview | Stats cards + recent reposts | ✅ Done |
| Dashboard > New Repost | 4-step wizard: source → video → destinations → schedule | ✅ Done |
| Dashboard > Queue | List all reposts with status + retry + delete | ✅ Done |
| Dashboard > Accounts | Connect/disconnect YouTube, TikTok, Instagram via OAuth | ✅ Done |
| Dashboard > Billing | Stripe upgrade + billing portal | ✅ Done |
| Shopping + Cart | Creator gear store | ✅ Done |
| Admin Dashboard | Product management | ✅ Done |

### Database Schema (supabase_schema.sql)
| Table | Purpose | Status |
|---|---|---|
| `users` | Auth, plan, Stripe IDs | ✅ Done |
| `platform_accounts` | OAuth tokens per platform | ✅ Done |
| `reposts` | Repost jobs with status | ✅ Done |
| `shop_items` | Creator gear shop | ✅ Done |

### Billing
- Stripe Checkout with 14-day trial ✅
- Stripe billing portal ✅
- Webhook: subscription created/updated/deleted ✅
- Plan enforcement (free = 3 reposts/month) ✅

---

## ❌ What Is MISSING

### 1. Smart Engine (Core Differentiator — Completely Missing)
- No video duration/orientation detection
- No auto-decision logic (long → YouTube + clips, short vertical → TikTok + Shorts)
- No Auto Mode / Manual Mode / Custom Mode selector
- No clip generation whatsoever

### 2. Video Upload (Missing)
- Users can ONLY redistribute existing videos from connected platforms
- There is NO "upload a new video from your computer" feature
- The whole concept of "upload once" does not exist yet
- No drag-and-drop upload UI
- No file upload endpoint on backend

### 3. FFmpeg / Video Processing (Completely Missing)
- No FFmpeg integration at all
- No video analysis (ffprobe)
- No clip cutting
- No aspect ratio conversion (horizontal → vertical)
- No auto-caption generation

### 4. Cloud Storage (Missing)
- Videos are downloaded to `/tmp` during repost then deleted
- No Cloudflare R2 or S3 storage
- No permanent video storage
- Instagram upload is stubbed out with `throw new Error(...)` because it needs public URL storage

### 5. YouTube Shorts Support (Missing)
- No detection of vertical videos for Shorts
- No separate YouTube Shorts upload path

### 6. Real-time Status Updates (Missing)
- Queue status requires manual page refresh or clicking "Refresh" button
- No WebSockets
- No polling mechanism

### 7. Auto-Captions (Missing)
- No Whisper integration
- No SRT/caption generation

### 8. Scheduling UI (Partial)
- Backend supports `scheduled_for` field ✅
- Frontend has schedule step in wizard ✅
- But no visual calendar/scheduler
- No "best time to post" suggestions

### 9. Clip Management (Missing)
- No clips table in DB
- No clip preview UI
- No clip approval before posting

### 10. Analytics (Missing)
- No view counts from platforms
- No engagement metrics
- No performance dashboard

---

## ⚠️ What Needs Fixing / Improving

### Security
- OAuth tokens stored as plaintext in DB — should be encrypted
- No token refresh logic for expired YouTube/TikTok tokens
- Admin password in `.env` as plaintext (acceptable for MVP)

### Instagram Upload
```js
// reposts.js line 117 — this throws an error intentionally:
async function uploadToInstagram(videoPath, title, account) {
  throw new Error("Instagram upload requires a public video URL. Implement uploadToStorage()...");
}
```
Instagram is broken as a destination — needs Supabase Storage or R2.

### Video Download to /tmp
- Downloads to `/tmp` which doesn't persist on Render free tier restarts
- File is deleted after upload but large files could fill `/tmp`
- Needs cloud storage (R2) as intermediate step

### Frontend Tech
- Uses Create React App (CRA) — outdated, slow, will be deprecated
- Should migrate to Next.js or Vite
- Uses inline styles everywhere — hard to maintain at scale
- No Tailwind, no design system

### Backend Tech
- Express is fine but plain JS — no TypeScript
- No input validation (no Zod/Joi)
- No rate limiting
- No error logging (Sentry not integrated)

---

## 📊 Feature Gap Summary

| Feature | Plan | Built |
|---|---|---|
| User auth | ✅ | ✅ |
| YouTube OAuth | ✅ | ✅ |
| TikTok OAuth | ✅ | ✅ |
| Instagram OAuth | ✅ | ✅ |
| Fetch existing videos | ✅ | ✅ |
| Redistribute to YouTube | ✅ | ✅ |
| Redistribute to TikTok | ✅ | ✅ |
| Redistribute to Instagram | ✅ | ❌ (broken) |
| Stripe billing | ✅ | ✅ |
| BullMQ job queue | ✅ | ✅ |
| Scheduling | ✅ | ✅ (partial) |
| **Upload new video from computer** | ✅ | ❌ |
| **Smart engine (auto-detect + decide)** | ✅ | ❌ |
| **FFmpeg clip generation** | ✅ | ❌ |
| **Cloud storage (R2/S3)** | ✅ | ❌ |
| **YouTube Shorts support** | ✅ | ❌ |
| **Auto-captions (Whisper)** | ✅ | ❌ |
| **Real-time status (WebSocket)** | ✅ | ❌ |
| **Analytics dashboard** | ✅ | ❌ |
| **Clip preview + approval** | ✅ | ❌ |
| **Auto/Manual/Custom mode** | ✅ | ❌ |

---

## 🛠️ What To Build Next (Priority Order)

### Priority 1 — Upload System
1. Add `POST /api/videos/upload` endpoint
2. Integrate Cloudflare R2 for storage
3. Build drag-and-drop upload UI on frontend
4. Store video metadata in new `uploaded_videos` table

### Priority 2 — Smart Engine
1. Install FFmpeg + FFprobe on server
2. Build video analyzer (duration, orientation, aspect ratio)
3. Build decision engine (the rules matrix)
4. Add Smart Mode selector to the New Repost wizard

### Priority 3 — Clip Generation
1. FFmpeg clip cutter
2. Add `clips` table to DB
3. Clip preview UI
4. Approve/reject clips before posting

### Priority 4 — Fix Instagram + Token Refresh
1. Use Supabase Storage for Instagram uploads (needs public URL)
2. Add YouTube token refresh logic (tokens expire in 1hr)
3. Add TikTok token refresh logic

### Priority 5 — Polish
1. Migrate frontend from CRA to Vite (faster dev)
2. Add real-time status with polling or WebSockets
3. Add input validation on backend
4. Add Sentry for error monitoring

---

## Verdict

This is a **solid v1 foundation**. The OAuth flows, job queue, billing, and basic repost UI are all working.

The core differentiator of UploadOnce AI — **smart detection + auto-clip generation from a fresh upload** — does not exist yet.

That's the entire next phase of work.

---

> Analysis by Antigravity — April 29, 2026
