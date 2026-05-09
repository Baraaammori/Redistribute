require("dotenv").config();
const supabase = require("../lib/supabase");
const { Queue } = require("bullmq");
const connection = require("../lib/redis");

async function run() {
  console.log("--- AUTO REPUBLISH JOBS ---");
  const { data: autoJobs } = await supabase.from("auto_republish_jobs").select("*").order("created_at", { ascending: false }).limit(5);
  console.log(autoJobs);

  console.log("\n--- REPOSTS ---");
  const { data: reposts } = await supabase.from("reposts").select("*").order("created_at", { ascending: false }).limit(5);
  console.log(reposts);

  console.log("\n--- BULLMQ REPOSTS QUEUE ---");
  const q = new Queue("reposts", { connection });
  console.log("Waiting:", await q.getWaitingCount());
  console.log("Active:", await q.getActiveCount());
  console.log("Failed:", await q.getFailedCount());
  console.log("Completed:", await q.getCompletedCount());

  console.log("\n--- FAILED JOBS ---");
  const failed = await q.getFailed();
  for (const j of failed) {
    console.log(`Job ${j.id}: ${j.failedReason}`);
  }

  process.exit(0);
}

run();
