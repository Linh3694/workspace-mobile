import { useCallback, useRef, useMemo } from 'react';
import { Message } from '../types/message';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useChatOptimization = () => {
    // Batched storage operations
    const saveMessagesQueue = useRef<Map<string, Message[]>>(new Map());
    const saveMessagesTimeout = useRef<NodeJS.Timeout | null>(null);
    
    // Debounced typing
    const debouncedTypingRef = useRef<NodeJS.Timeout | null>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    
    // Message update batching
    const messageUpdateQueue = useRef<Set<string>>(new Set());
    const messageUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

    // Optimized storage save with batching
    const saveMessagesToStorage = useCallback(async (chatId: string, messages: Message[]) => {
        saveMessagesQueue.current.set(chatId, messages);
        
        if (saveMessagesTimeout.current) {
            clearTimeout(saveMessagesTimeout.current);
        }
        
        saveMessagesTimeout.current = setTimeout(async () => {
            try {
                const promises = Array.from(saveMessagesQueue.current.entries()).map(([id, msgs]) => {
                    const key = `chat_messages_${id}`;
                    return AsyncStorage.setItem(key, JSON.stringify(msgs));
                });
                
                await Promise.all(promises);
                saveMessagesQueue.current.clear();
            } catch (error) {
                console.error('Error saving messages to storage:', error);
            }
        }, 1000);
    }, []);

    // Optimized typing handler with debouncing
    const createTypingHandler = useCallback((socketRef: any, chatId: string, currentUserId: string) => {
        return (text: string) => {
            if (!socketRef.current || !chatId || !currentUserId) return;
            
            if (debouncedTypingRef.current) {
                clearTimeout(debouncedTypingRef.current);
            }
            
            debouncedTypingRef.current = setTimeout(() => {
                if (text.trim() !== '') {
                    socketRef.current?.emit('typing', { chatId, userId: currentUserId });
                    
                    if (typingTimeout.current) {
                        clearTimeout(typingTimeout.current);
                    }
                    
                    typingTimeout.current = setTimeout(() => {
                        socketRef.current?.emit('stopTyping', { chatId, userId: currentUserId });
                    }, 3000);
                } else {
                    if (typingTimeout.current) {
                        clearTimeout(typingTimeout.current);
                    }
                    socketRef.current?.emit('stopTyping', { chatId, userId: currentUserId });
                }
            }, 300);
        };
    }, []);

    // Optimized message processing with memoization
    const processMessages = useCallback((messages: Message[]) => {
        const messagesWithTime: any[] = [];
        
        for (let i = 0; i < messages.length; i++) {
            const item = messages[i];
            const prevMsg = messages[i - 1];
            const isDifferentDay = prevMsg?.createdAt && 
                (new Date(item.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString());
            const timeGap = prevMsg?.createdAt ? 
                (new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) : null;
            const showTime = !prevMsg?.createdAt || isDifferentDay || (!!timeGap && timeGap > 10 * 60 * 1000);
            
            if (showTime) {
                messagesWithTime.push({
                    type: 'time',
                    time: item.createdAt,
                    _id: `time-${item.createdAt}-${item._id}`
                });
            }
            messagesWithTime.push(item);
        }
        
        return [...messagesWithTime].reverse();
    }, []);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }
        if (debouncedTypingRef.current) {
            clearTimeout(debouncedTypingRef.current);
        }
        if (saveMessagesTimeout.current) {
            clearTimeout(saveMessagesTimeout.current);
        }
        if (messageUpdateTimeout.current) {
            clearTimeout(messageUpdateTimeout.current);
        }
    }, []);

    return {
        saveMessagesToStorage,
        createTypingHandler,
        processMessages,
        cleanup
    };
};

export default useChatOptimization; 