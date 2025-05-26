import { User } from './user';

export interface MessageReaction {
    userId: string;
    emojiCode: string;
    isCustom: boolean;
    createdAt: string;
}

export interface Message {
    _id: string;
    chat: string;
    content: string;
    sender: User;
    createdAt: string;
    updatedAt: string;
    type: 'text' | 'image' | 'file' | 'multiple-images';
    fileUrl?: string;
    fileUrls?: string[];
    fileName?: string;
    fileSize?: number;
    isEmoji?: boolean;
    emojiUrl?: string;
    emojiType?: string;
    emojiId?: string;
    reactions?: MessageReaction[];
    readBy: string[];
    replyTo?: Message;
    isForwarded?: boolean;
    originalSender?: User;
    isPinned?: boolean;
    pinnedBy?: string;
}

export interface Chat {
    _id: string;
    participants: User[];
    lastMessage?: Message;
    unreadCount?: number;
    createdAt: string;
    updatedAt: string;
} 