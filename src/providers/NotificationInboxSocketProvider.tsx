/**
 * Kết nối Socket inbox notification-service sau khi đăng nhập.
 */
import React, { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { useAuth } from '../context/AuthContext';
import {
  connectWorkspaceNotificationSocket,
  disconnectWorkspaceNotificationSocket,
} from '../services/notificationSocketService';

const EV = 'notification_inbox_refresh';

export function notifyInboxChanged() {
  DeviceEventEmitter.emit(EV);
}

type Props = { children: React.ReactNode };

export function NotificationInboxSocketProvider({ children }: Props) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectWorkspaceNotificationSocket();
      return undefined;
    }

    let unsubCallbacks: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      const s = await connectWorkspaceNotificationSocket();
      if (cancelled || !s) return;
      const onAny = () => notifyInboxChanged();
      s.on('notification:new', onAny);
      s.on('notification:read', onAny);
      s.on('notification:unread_count', onAny);
      unsubCallbacks.push(() => {
        s.off('notification:new', onAny);
        s.off('notification:read', onAny);
        s.off('notification:unread_count', onAny);
      });
    })();

    return () => {
      cancelled = true;
      for (const fn of unsubCallbacks) fn();
      disconnectWorkspaceNotificationSocket();
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

export { EV as NOTIFICATION_INBOX_REFRESH_EVENT };
