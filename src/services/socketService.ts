import { io, Socket } from 'socket.io-client';
import { MICROSERVICES_BASE_URL } from '../config/constants';

let socket: Socket | null = null;
let groupSocket: Socket | null = null;

// Socket cho chat 1-1
export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(MICROSERVICES_BASE_URL, {
      query: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

// Socket riêng cho groupchat
export const getGroupSocket = (token: string): Socket => {
  if (!groupSocket) {
    groupSocket = io(`${MICROSERVICES_BASE_URL}/groupchat`, {
      query: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return groupSocket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const disconnectGroupSocket = () => {
  if (groupSocket) {
    groupSocket.disconnect();
    groupSocket = null;
  }
};

// Disconnect tất cả sockets
export const disconnectAllSockets = () => {
  disconnectSocket();
  disconnectGroupSocket();
};
