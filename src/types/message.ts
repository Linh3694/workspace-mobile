import { User } from '../navigation/AppNavigator';

// Re-export User type for convenience
export type { User };

export interface Reaction {
    userId: string;
    emojiCode: string;
    isCustom: boolean;
}

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
    reactions?: Reaction[];
    replyTo?: Message;
    isForwarded?: boolean;
    originalSender?: User;
    isPinned?: boolean;
    pinnedBy?: string;
    isRevoked?: boolean;
}

export interface Chat {
    _id: string;
    participants: User[];
    lastMessage?: Message;
    unreadCount?: number;
    
    // Group chat fields
    name?: string;
    description?: string;
    isGroup?: boolean;
    avatar?: string;
    creator?: User;
    admins?: User[];
    pinnedMessages?: string[];
    settings?: {
        allowMembersToAdd?: boolean;
        allowMembersToEdit?: boolean;
        muteNotifications?: boolean;
    };
    
    createdAt?: string;
    updatedAt?: string;
}

// Group chat specific types
export interface GroupMember extends User {
    isAdmin: boolean;
    isCreator: boolean;
    joinedAt?: string;
}

export interface GroupInfo {
    _id: string;
    name: string;
    description?: string;
    avatar?: string;
    participants: User[];
    creator: User;
    admins: User[];
    settings: {
        allowMembersToAdd: boolean;
    };
    isGroup: true;
    createdAt: string;
    updatedAt: string;
}

export interface GroupTypingUser {
    userId: string;
    user: User;
    timestamp: string;
}

// Socket event types for group chat
export interface GroupSocketEvents {
    userJoinedGroup: { userId: string; chatId: string; timestamp: string };
    userLeftGroup: { userId: string; chatId: string; timestamp: string };
    userTypingInGroup: { userId: string; chatId: string; timestamp: string };
    userStopTypingInGroup: { userId: string; chatId: string; timestamp: string };
    groupMessageRead: { userId: string; chatId: string; messageId: string; timestamp: string };
    groupMemberUpdate: { chatId: string; action: 'added' | 'removed' | 'left'; targetUserId: string; actionBy: string; timestamp: string };
    groupInfoUpdate: { chatId: string; changes: Partial<GroupInfo>; updatedBy: string; timestamp: string };
    groupAdminUpdate: { chatId: string; action: 'promoted' | 'demoted'; targetUserId: string; actionBy: string; timestamp: string };
    groupMembersAdded: { chatId: string; newMembers: string[]; addedBy: string };
    groupMemberRemoved: { chatId: string; removedUserId: string; removedBy: string };
    groupMemberLeft: { chatId: string; leftUserId: string };
    removedFromGroup: { chatId: string; removedBy: string };
    groupInfoUpdated: { chatId: string; updatedBy: string; changes: any };
    groupAdminAdded: { chatId: string; newAdminId: string; addedBy: string };
    groupAdminRemoved: { chatId: string; removedAdminId: string; removedBy: string };
    groupSettingsUpdated: { chatId: string; updatedBy: string; settings: any };
} 