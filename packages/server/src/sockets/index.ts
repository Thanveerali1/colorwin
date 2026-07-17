import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../lib/jwt';
import { setBroadcaster } from '../modules/round/round.engine';

export function initSockets(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        (socket as any).userId = payload.userId;
      } catch {
        // invalid token -- treat as an anonymous viewer, don't block connection
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} — reason: ${reason}`);
    });
  });

  setBroadcaster((event, payload) => {
    io.emit(event, payload);
  });

  return io;
}
