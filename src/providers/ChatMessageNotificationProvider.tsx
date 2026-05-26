/**
 * Foreground: nhận `chat:message` qua Socket — bật local notification nếu không phải tin của GV và không đang mở đúng thread
 */
import React, { useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { getFocusedChatConversationId } from '../lib/chatNotificationFocus';
import { chatService } from '../services/chatService';
import { presentChatMessageLocalNotification } from '../services/chatLocalNotification';
import type { ChatConversation, ChatMessage } from '../types/chat';

type Props = { children: React.ReactNode };

/** Tin của chính giáo viên — không báo foreground */
export function isTeacherOwnChatMessage(
  message: ChatMessage,
  teacherEmail?: string | null
): boolean {
  const em = String(teacherEmail || '').trim().toLowerCase();
  const snapEmail = String(message.senderSnapshot?.email || '')
    .trim()
    .toLowerCase();
  const role = message.senderSnapshot?.role;
  if (role === 'teacher' && snapEmail && em && snapEmail === em) return true;
  return false;
}

export function ChatMessageNotificationProvider({ children }: Props) {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    let detach: (() => void) | undefined;

    const run = async () => {
      const socket = await chatService.getSocket();
      if (!socket || !mounted) return;

      const onMessage = (payload: {
        conversation: ChatConversation;
        message: ChatMessage;
      }) => {
        const { conversation, message } = payload;
        if (isTeacherOwnChatMessage(message, user?.email)) return;

        const focused = getFocusedChatConversationId();
        const cid = String(conversation._id).trim();
        if (focused && focused === cid) return;

        void presentChatMessageLocalNotification(conversation, message).catch((err) => {
          if (__DEV__) console.warn('[ChatForegroundNotify]', err);
        });
      };

      socket.on('chat:message', onMessage);
      detach = () => socket.off('chat:message', onMessage);
    };

    void run();

    return () => {
      mounted = false;
      detach?.();
    };
  }, [isAuthenticated, user?.email]);

  return <>{children}</>;
}
