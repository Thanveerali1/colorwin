import { Worker } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { lockRound, previewResult, finalizeRound, startNextRound } from './round.engine';

export const roundWorker = new Worker(
  'round-phase-transitions',
  async (job) => {
    switch (job.name) {
      case 'lockRound':
        return lockRound(job.data.roundId);
      case 'previewResult':
        return previewResult(job.data.roundId);
      case 'finalizeRound':
        return finalizeRound(job.data.roundId, job.data.result);
      case 'startNextRound':
        return startNextRound();
    }
  },
  { connection: redisConnection }
);

roundWorker.on('completed', (job) => {
  console.log(`✅ Round job completed: ${job.name}`);
});

roundWorker.on('failed', (job, err) => {
  console.error(`❌ Round job failed: ${job?.name}`, err);
});