import { useEffect, useRef, useCallback } from 'react';
import { Message } from '../types/message';

interface UseSocketEventsProps {
    socketRef: React.MutableRefObject<any>;
    chatId: string | null;
    currentUserId: string | null;
    chatPartnerId: string;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setOtherTyping: React.Dispatch<React.SetStateAction<boolean>>;
    saveMessagesToStorage: (chatId: string, messages: Message[]) => Promise<void>;
}

export const useSocketEvents = ({
    socketRef,
    chatId,
    currentUserId,
    chatPartnerId,
    setMessages,
    setOtherTyping,
    saveMessagesToStorage
}: UseSocketEventsProps) => {
    const typingResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Setup socket event listeners
    useEffect(() => {
        if (!socketRef.current || !chatId) return;

        const socket = socketRef.current;

        // Message events
        const handleReceiveMessage = (newMessage: Message) => {
            console.log('Received new message:', newMessage);
            
            // Reset typing indicator if message from chat partner
            if (newMessage.sender._id === chatPartnerId) {
                setOtherTyping(false);
                if (typingResetTimeoutRef.current) {
                    clearTimeout(typingResetTimeoutRef.current);
                }
            }
            
            setMessages(prev => {
                const exists = prev.some(msg => msg._id === newMessage._id);
                if (exists) return prev;

                const updatedMessages = [...prev, newMessage].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                saveMessagesToStorage(chatId, updatedMessages);
                return updatedMessages;
            });
        };

        // Typing events
        const handleUserTyping = ({ userId, chatId: eventChatId }: { userId: string, chatId: string }) => {
            if (eventChatId === chatId && userId === chatPartnerId) {
                setOtherTyping(true);
                
                // Auto-reset after 5 seconds
                if (typingResetTimeoutRef.current) {
                    clearTimeout(typingResetTimeoutRef.current);
                }
                typingResetTimeoutRef.current = setTimeout(() => {
                    setOtherTyping(false);
                }, 5000);
            }
        };

        const handleUserStopTyping = ({ userId, chatId: eventChatId }: { userId: string, chatId: string }) => {
            if (eventChatId === chatId && userId === chatPartnerId) {
                setOtherTyping(false);
                if (typingResetTimeoutRef.current) {
                    clearTimeout(typingResetTimeoutRef.current);
                }
            }
        };

        // Message read events
        const handleMessageRead = ({ userId, chatId: eventChatId }: { userId: string, chatId: string }) => {
            if (eventChatId === chatId) {
                setMessages(prev => prev.map(msg => ({
                    ...msg,
                    readBy: msg.readBy?.includes(userId) ? msg.readBy : [...(msg.readBy || []), userId]
                })));
            }
        };

        // Online/Offline events
        const handleUserOnline = ({ userId }: { userId: string }) => {
            if (userId === chatPartnerId) {
                console.log('Chat partner is now online');
            }
        };

        const handleUserOffline = ({ userId }: { userId: string }) => {
            if (userId === chatPartnerId) {
                console.log('Chat partner is now offline');
                setOtherTyping(false);
            }
        };

        // Register event listeners
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('userTyping', handleUserTyping);
        socket.on('userStopTyping', handleUserStopTyping);
        socket.on('messageRead', handleMessageRead);
        socket.on('userOnline', handleUserOnline);
        socket.on('userOffline', handleUserOffline);

        return () => {
            // Cleanup
            if (typingResetTimeoutRef.current) {
                clearTimeout(typingResetTimeoutRef.current);
            }
            
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('userTyping', handleUserTyping);
            socket.off('userStopTyping', handleUserStopTyping);
            socket.off('messageRead', handleMessageRead);
            socket.off('userOnline', handleUserOnline);
            socket.off('userOffline', handleUserOffline);
        };
    }, [chatId, chatPartnerId, setMessages, setOtherTyping, saveMessagesToStorage]);

    // Emit typing events
    const emitTyping = useCallback(() => {
        if (socketRef.current && chatId && currentUserId) {
            socketRef.current.emit('typing', { chatId, userId: currentUserId });
        }
    }, [chatId, currentUserId]);

    const emitStopTyping = useCallback(() => {
        if (socketRef.current && chatId && currentUserId) {
            socketRef.current.emit('stopTyping', { chatId, userId: currentUserId });
        }
    }, [chatId, currentUserId]);

    return {
        emitTyping,
        emitStopTyping
    };
};

export default useSocketEvents; 