require("dotenv").config();
const { Queue } = require("bullmq");
const connection = require("../lib/redis");

async function run() {
  const pollQueue = new Queue("auto-republish-poller", { connection });
  const repeatables = await pollQueue.getRepeatableJobs();
  console.log("Found repeatable jobs:", repeatables.length);
  for (const job of repeatables) {
    if (job.cron !== "*/1 * * * *") {
      console.log("Removing old job:", job.key);
      await pollQueue.removeRepeatableByKey(job.key);
    }
  }
  process.exit(0);
}
run();
