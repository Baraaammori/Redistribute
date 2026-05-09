require("dotenv").config();
const supabase = require("../lib/supabase");
const { repostQueue } = require("../routes/reposts");

async function retry() {
  const { data: reposts } = await supabase.from("reposts").select("id").eq("status", "failed").order("created_at", { ascending: false }).limit(1);
  if (reposts && reposts.length > 0) {
    const repostId = reposts[0].id;
    console.log("Retrying repost:", repostId);
    await supabase.from("reposts").update({ status: "pending", error: null }).eq("id", repostId);
    await repostQueue.add("repost", { repostId }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
    console.log("Job queued!");
  } else {
    console.log("No failed jobs found.");
  }
  process.exit(0);
}

retry();
