import http from 'http';
import { app } from './app';
import { env } from './config/env';
import './modules/round/round.worker';
import { ensureRoundProgress } from './modules/round/round.engine';
import { initSockets } from './sockets';

async function bootstrap() {
  // Self-healing: verifies the active round (if any) actually has a job
  // scheduled to advance it, and fixes it if not -- e.g. after a Redis/queue
  // flush, a crash, or the server being off past a round's expected end time.
  await ensureRoundProgress();

  const httpServer = http.createServer(app);
  initSockets(httpServer);

  // Bind explicitly to 127.0.0.1 -- avoids Windows' occasionally-flaky
  // IPv4/IPv6 "localhost" resolution causing intermittent ERR_CONNECTION_REFUSED.
  httpServer.listen(env.port, '127.0.0.1', () => {
    console.log(`🚀 ColorWin server running on http://127.0.0.1:${env.port}`);
  });
}

bootstrap();
