import { Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

new Worker(
  "scoring",
  async (job) => {
    console.log("Scoring job", job.id);
  },
  { connection }
);

new Worker(
  "sync",
  async (job) => {
    console.log("Sync job", job.id);
  },
  { connection }
);
