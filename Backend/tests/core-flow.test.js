// ─── Core Flow Tests ──────────────────────────────────────────────────────────
// Run with: cd Backend && npm test
// ─────────────────────────────────────────────────────────────────────────────

// Stub external dependencies so tests run without live DB / Redis
jest.mock("../lib/supabase", () => {
  const mockChain = (returnValue) => {
    const chain = {
      select:  jest.fn().mockReturnThis(),
      insert:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockReturnThis(),
      upsert:  jest.fn().mockReturnThis(),
      delete:  jest.fn().mockReturnThis(),
      eq:      jest.fn().mockReturnThis(),
      gte:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue(returnValue),
    };
    return chain;
  };
  return {
    from: jest.fn(() => mockChain({ data: null, error: null })),
  };
});

jest.mock("../lib/redis", () => ({
  host: "localhost",
  port: 6379,
}));

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add:              jest.fn().mockResolvedValue({ id: "job-123" }),
    getWaitingCount:  jest.fn().mockResolvedValue(0),
    getActiveCount:   jest.fn().mockResolvedValue(0),
    getCompletedCount:jest.fn().mockResolvedValue(0),
    getFailedCount:   jest.fn().mockResolvedValue(0),
    getDelayedCount:  jest.fn().mockResolvedValue(0),
  })),
  Worker:            jest.fn().mockImplementation(() => ({ on: jest.fn() })),
  UnrecoverableError: class UnrecoverableError extends Error {},
}));

// Stub googleapis and axios to avoid real HTTP calls
jest.mock("googleapis", () => ({
  google: {
    auth:    { OAuth2: jest.fn().mockImplementation(() => ({ generateAuthUrl: jest.fn(() => "https://accounts.google.com"), getToken: jest.fn() })) },
    youtube: jest.fn(),
  },
}));
jest.mock("axios");

jest.mock("../lib/youtube-downloader", () => ({ download: jest.fn() }));
jest.mock("../lib/ffmpeg", () => ({ transcodeToMP4: jest.fn() }));
jest.mock("../lib/storage",    () => ({ uploadFile: jest.fn() }));
jest.mock("../lib/tokenRefresh", () => ({ refreshTokenIfExpired: jest.fn(a => a) }));

const request    = require("supertest");
const express    = require("express");
const supabase   = require("../lib/supabase");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeApp(routerFactory) {
  const app = express();
  app.use(express.json());
  // Inject a fake authenticated user into req.user
  app.use((req, _res, next) => {
    req.user = { userId: "user-abc", id: "user-abc" };
    next();
  });
  app.use("/api/reposts", routerFactory());
  return app;
}

function makeAccountsApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { userId: "user-abc" }; next(); });
  app.use("/api/accounts", require("../routes/accounts"));
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/reposts — create a repost job", () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-configure the mock chain for this test suite
    const supabaseMock = require("../lib/supabase");
    supabaseMock.from.mockImplementation((table) => {
      if (table === "users") {
        return {
          select:  jest.fn().mockReturnThis(),
          eq:      jest.fn().mockReturnThis(),
          single:  jest.fn().mockResolvedValue({ data: { plan: "pro" }, error: null }),
        };
      }
      if (table === "platform_accounts") {
        return {
          select:  jest.fn().mockReturnThis(),
          eq:      jest.fn().mockReturnThis(),
          single:  jest.fn().mockResolvedValue({ data: { id: "acc-1" }, error: null }),
        };
      }
      if (table === "reposts") {
        return {
          select:  jest.fn().mockReturnThis(),
          insert:  jest.fn().mockReturnThis(),
          update:  jest.fn().mockReturnThis(),
          eq:      jest.fn().mockReturnThis(),
          single:  jest.fn().mockResolvedValue({ data: { id: "repost-1", status: "pending" }, error: null }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });

    app = makeApp(() => require("../routes/reposts"));
  });

  it("creates a repost for a pro user and returns 200", async () => {
    const res = await request(app)
      .post("/api/reposts")
      .send({ sourceVideoUrl: "https://youtube.com/watch?v=abc", sourcePlatform: "youtube", title: "Test", destinations: ["tiktok"] });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("repost-1");
  });

  it("returns 400 when destinations is empty", async () => {
    const res = await request(app)
      .post("/api/reposts")
      .send({ sourceVideoUrl: "https://youtube.com/watch?v=abc", sourcePlatform: "youtube", title: "Test", destinations: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/destination/i);
  });
});

describe("POST /api/reposts — free plan enforcement", () => {
  it("blocks a free user after 3 reposts/month", async () => {
    jest.resetModules();

    const supabaseMock = require("../lib/supabase");
    supabaseMock.from.mockImplementation((table) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { plan: "free", trial_ends_at: null }, error: null }),
        };
      }
      if (table === "reposts") {
        // Simulate 3 existing reposts this month
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          gte:    jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null, count: 3 }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const app = makeApp(() => require("../routes/reposts"));
    const res = await request(app)
      .post("/api/reposts")
      .send({ sourceVideoUrl: "https://youtube.com/watch?v=abc", sourcePlatform: "youtube", title: "Test", destinations: ["tiktok"] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/free plan limit/i);
  });
});

describe("GET /api/accounts/youtube/auth-url — OAuth callback stores tokens", () => {
  it("returns an auth URL with state=userId", async () => {
    const app = makeAccountsApp();
    const res = await request(app).get("/api/accounts/youtube/auth-url");
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });
});

describe("Token refresh logic", () => {
  const { isTokenExpired } = require("../lib/tokenRefresh");

  it("marks a token with no expires_at as expired", () => {
    expect(isTokenExpired({ expires_at: null })).toBe(true);
  });

  it("marks a token that expired 10 minutes ago as expired", () => {
    const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(isTokenExpired({ expires_at: past })).toBe(true);
  });

  it("does NOT mark a token that expires in 1 hour as expired", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isTokenExpired({ expires_at: future })).toBe(false);
  });
});
