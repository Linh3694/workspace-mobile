/**
 * Banner hệ thống khi app foreground — tin chat từ PH (debounce theo conversation)
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ChatConversation, ChatMessage } from '../types/chat';

const DEBOUNCE_MS = 2600;
const lastPresentedAtByConversation = new Map<string, number>();

async function ensureChatChannelAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('chat', {
    name: 'Trao đổi — Chat phụ huynh',
    description: 'Tin nhắn realtime với phụ huynh',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function presentChatMessageLocalNotification(
  conversation: ChatConversation,
  message: ChatMessage
): Promise<void> {
  const convId = String(conversation._id);
  const now = Date.now();
  const last = lastPresentedAtByConversation.get(convId) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  lastPresentedAtByConversation.set(convId, now);

  await ensureChatChannelAndroid();

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const senderName = (message.senderSnapshot?.name || 'Người gửi').trim();
  const preview = (message.content || '').trim().slice(0, 180);
  const title = (conversation.title || 'Trao đổi').trim();
  const body =
    preview.length > 0 ? `${senderName}: ${preview}` : `${senderName}: Tin nhắn mới`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: {
        type: 'chat_message',
        conversationId: convId,
        conversation_id: convId,
        chatId: convId,
        class_id: conversation.classId,
        school_year_id: conversation.schoolYearId,
      },
    },
    trigger: Platform.OS === 'android' ? { channelId: 'chat' } : null,
  });
}
