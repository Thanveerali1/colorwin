import { Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';

export const roundQueue = new Queue('round-phase-transitions', {
  connection: redisConnection,
});
