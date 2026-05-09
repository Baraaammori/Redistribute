require("dotenv").config();
const { Queue } = require("bullmq");
const connection = require("../lib/redis");

async function run() {
  const q = new Queue("reposts", { connection });
  console.log("Waiting:", await q.getWaitingCount());
  console.log("Active:", await q.getActiveCount());
  console.log("Delayed:", await q.getDelayedCount());

  const waiting = await q.getWaiting();
  for (const j of waiting) {
    console.log(`Waiting Job ${j.id}: attempt=${j.attemptsMade}`);
  }

  const delayed = await q.getDelayed();
  for (const j of delayed) {
    console.log(`Delayed Job ${j.id}: attempt=${j.attemptsMade}`);
  }

  process.exit(0);
}

run();
