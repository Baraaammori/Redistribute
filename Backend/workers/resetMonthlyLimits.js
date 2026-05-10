const cron = require("node-cron");
const supabase = require("../lib/supabase");

// Runs at 00:00 on the 1st of every month
// Resets reposts_used to 0 for all free-plan users.
// This is a safety-net — the billing/status endpoint already computes usage
// live from the reposts table, but this keeps the users.reposts_used column
// in sync for any legacy code that reads it.
function startMonthlyResetCron() {
  cron.schedule("0 0 1 * *", async () => {
    console.log("[resetMonthlyLimits] Running monthly repost counter reset for free users…");
    try {
      const { error } = await supabase
        .from("users")
        .update({ reposts_used: 0 })
        .eq("plan", "free");
      if (error) {
        // Column may not exist in all environments — log and continue
        console.warn("[resetMonthlyLimits] Reset skipped (column may not exist):", error.message);
      } else {
        console.log("[resetMonthlyLimits] ✅ Monthly reset complete");
      }
    } catch (err) {
      console.error("[resetMonthlyLimits] ❌ Unexpected error:", err.message);
    }
  }, { timezone: "UTC" });

  console.log("[resetMonthlyLimits] Monthly reset cron scheduled (UTC 00:00 on the 1st)");
}

module.exports = { startMonthlyResetCron };
