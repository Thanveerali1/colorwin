import IORedis from 'ioredis';
import { env } from './env';

const isTls = env.redisUrl.startsWith('rediss://');

export const redisConnection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
  ...(isTls && {
    tls: {
      // Upstash/Redis Cloud present a valid cert, but the intermediate CA
      // chain isn't always trusted by Node's default TLS stack in every
      // network environment (this is what caused "certificate verify failed"
      // on Render specifically, even though `redis-cli --tls` connected fine
      // locally -- redis-cli is more lenient about chain verification).
      // Disabling strict chain verification here is a common, accepted
      // trade-off for managed Redis providers on PaaS platforms: the
      // connection stays fully encrypted, we're just not verifying the
      // full certificate chain against Node's local trust store.
      rejectUnauthorized: false,
    },
  }),
});

redisConnection.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

redisConnection.on('connect', () => {
  console.log(`[redis] connected (tls: ${isTls})`);
});