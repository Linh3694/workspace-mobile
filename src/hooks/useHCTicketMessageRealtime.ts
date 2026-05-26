/**
 * Frappe Realtime (Redis → socket.io) — tin mới ticket HC; không thay thế get_comments.
 * JWT qua handshake.auth.token (khớp middleware Frappe).
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, FRAPPE_SITE_NAME } from '../config/constants';
import { HC_TICKET_RT_EVENT_NEW_MESSAGE } from '../realtime/hcTicketRealtimeConstants';
import type { AdminTicketMessage } from '../services/administrativeTicketService';

function getHCTicketSocketIOUrl(): string {
  const base = String(BASE_URL || '')
    .replace(/\/$/, '');
  const site = String(FRAPPE_SITE_NAME || 'localhost')
    .replace(/\/$/, '');
  return `${base}/${site}`;
}

export function useHCTicketMessageRealtime(
  ticketId: string | undefined,
  onMessage?: (message: AdminTicketMessage) => void
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    let active = true;
    let socket: Socket | null = null;

    void (async () => {
      const tokenRaw =
        (await AsyncStorage.getItem('authToken')) || (await AsyncStorage.getItem('frappe_token'));
      if (!tokenRaw || !active) {
        return;
      }
      const token = tokenRaw.startsWith('Bearer ') ? tokenRaw : `Bearer ${tokenRaw}`;
      const url = getHCTicketSocketIOUrl();
      const s: Socket = io(url, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      if (!active) {
        s.close();
        return;
      }
      socket = s;

      const onPayload = (data: { ticket_id?: string; message?: AdminTicketMessage }) => {
        if (!data?.ticket_id || data.ticket_id !== ticketId) return;
        const msg = data.message;
        if (!msg?._id) return;
        onMessageRef.current?.(msg);
      };

      s.on('connect', () => {
        if (active) setConnected(true);
      });
      s.on('disconnect', () => {
        if (active) setConnected(false);
      });
      s.on('connect_error', () => {
        if (active) setConnected(false);
      });
      s.on(HC_TICKET_RT_EVENT_NEW_MESSAGE, onPayload);
    })();

    return () => {
      active = false;
      setConnected(false);
      if (socket) {
        socket.off(HC_TICKET_RT_EVENT_NEW_MESSAGE);
        socket.removeAllListeners();
        socket.close();
      }
    };
  }, [ticketId]);

  return { connected };
}
