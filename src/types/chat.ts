import type { User } from '../navigation/AppNavigator';
import { ImageSourcePropType } from 'react-native';

export type NotificationType = 'success' | 'error';

export interface Message {
    _id: string;
    content: string;
    sender: User;
    chat: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    fileUrl?: string;
    fileUrls?: string[];
    isEmoji?: boolean;
    emojiId?: string;
    emojiType?: string;
    emojiName?: string;
    emojiUrl?: string;
    readBy?: string[];
    reactions?: {
        userId: string;
        emojiCode: string;
        isCustom: boolean;
    }[];
    replyTo?: Message;
    isForwarded?: boolean;
    originalSender?: User;
    isPinned?: boolean;
    pinnedBy?: string;
}

export interface MessageReaction {
    userId: string;
    emojiCode: string;
    isCustom: boolean;
    createdAt: string;
}

export interface Chat {
    _id: string;
    participants: User[];
    lastMessage?: Message;
    createdAt: string;
    updatedAt: string;
    category: string;
}

export interface ChatDetailParams {
    user: User;
    chatId?: string;
}

export interface CustomEmoji {
    _id: string;
    name: string;
    code: string;
    url: string | ImageSourcePropType;
    type: string;
    category: string;
} 