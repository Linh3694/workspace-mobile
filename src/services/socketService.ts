import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/constants';

let socket: Socket | null = null;

export const getSocket = (token: string): Socket => {
    if (!socket) {
        socket = io(API_BASE_URL, {
            query: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};