// ─── Shared Redis Connection ─────────────────────────────────────────────────
const IORedis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,   // does NOT connect at require() time; connects on first command
  retryStrategy(times) {
    if (times === 1) {
      console.warn(`\n⚠️  Redis unavailable (${redisUrl})`);
      console.warn("   Queue/clip features disabled until Redis is connected.");
      console.warn("   Free Redis at https://upstash.com  →  set REDIS_URL in .env\n");
    }
    return Math.min(5000 * times, 60000); // 5s, 10s … up to 60s
  },
});

// Suppress ECONNREFUSED noise — must be registered synchronously
connection.on("error", () => {});
connection.on("connect", () => console.log("✅  Redis connected"));

// Trigger first connection attempt in the background (non-blocking)
connection.connect().catch(() => {});

module.exports = connection;
