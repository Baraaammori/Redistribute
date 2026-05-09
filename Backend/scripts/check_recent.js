require("dotenv").config();
const supabase = require("../lib/supabase");

async function run() {
  console.log("--- AUTO REPUBLISH JOBS ---");
  const { data: autoJobs } = await supabase.from("auto_republish_jobs").select("id, status, error_message, created_at").order("created_at", { ascending: false }).limit(2);
  console.log(autoJobs);

  console.log("\n--- REPOSTS ---");
  const { data: reposts } = await supabase.from("reposts").select("id, status, error, created_at").order("created_at", { ascending: false }).limit(2);
  console.log(reposts);

  process.exit(0);
}

run();
