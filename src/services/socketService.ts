import { io, Socket } from 'socket.io-client';
import { CHAT_SOCKET_URL, CHAT_SOCKET_PATH } from '../config/constants';

let socket: Socket | null = null;
let groupSocket: Socket | null = null;

// Socket cho chat 1-1
export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(CHAT_SOCKET_URL, {
      path: CHAT_SOCKET_PATH,
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
    groupSocket = io(`${CHAT_SOCKET_URL}/groupchat`, {
      path: CHAT_SOCKET_PATH,
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
