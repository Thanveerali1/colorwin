import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('http://127.0.0.1:4000', {
      auth: {
        token: useAuthStore.getState().accessToken,
      },
    });
    socket.on('disconnect', (reason) => {
      console.log('🔌 Client-side disconnect reason:', reason);
    });
    socket.on('connect_error', (err) => {
      console.log('🔌 Connect error:', err.message);
    });
  }
  return socket;
}
