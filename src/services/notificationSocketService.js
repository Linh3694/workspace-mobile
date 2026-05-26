/**
 * Socket.IO notification-service — inbox realtime (staff app).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

import { NOTIFICATION_API_BASE_URL } from '../config/constants';

let socket = null;

export async function connectWorkspaceNotificationSocket() {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('authToken');
  if (!token) return null;

  const base = NOTIFICATION_API_BASE_URL.replace(/\/+$/, '');
  const s = io(base, {
    path: '/api/notifications/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2500,
  });

  socket = s;
  return s;
}

export function disconnectWorkspaceNotificationSocket() {
  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } catch (_) {
    /* ignore */
  }
  socket = null;
}

export function getWorkspaceNotificationSocket() {
  return socket;
}
