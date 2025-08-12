import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { Alert } from 'react-native';
import { Message, GroupInfo } from '../types/message';
import { CustomEmoji } from '../hooks/useEmojis';
import { CHAT_SERVICE_URL, API_BASE_URL } from '../config/constants';

interface UseGroupMessageOperationsProps {
  groupInfo: GroupInfo | null;
  currentUserId: string | null;
}

export const useGroupMessageOperations = ({
  groupInfo,
  currentUserId,
}: UseGroupMessageOperationsProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);

  // Batched storage operations
  const saveMessagesQueue = useRef<Map<string, Message[]>>(new Map());
  const saveMessagesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce mechanism for handleLoadMore
  const lastLoadMoreCall = useRef<number>(0);
  const loadMoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force reset tất cả loading states
  const forceResetLoadingStates = useCallback(() => {
    console.log('🔄 [GroupMessageOps] Force resetting all loading states');
    setIsLoadingMore(false);
    setLoading(false);
    setHasMoreMessages(false);
  }, []);

  // Reset page khi group thay đổi
  useEffect(() => {
    if (groupInfo?._id) {
      console.log('📄 [GroupMessageOps] Resetting page to 1 for new group:', groupInfo._id);
      setPage(1);
      setHasMoreMessages(true);
      lastLoadMoreCall.current = 0;
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }
    }
  }, [groupInfo?._id]);

  // Timeout để tự động reset isLoadingMore nếu bị stuck
  useEffect(() => {
    if (isLoadingMore) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ [GroupMessageOps] isLoadingMore stuck for too long, force resetting...');
        forceResetLoadingStates();
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isLoadingMore, forceResetLoadingStates]);

  // Hàm lưu tin nhắn vào AsyncStorage với batching
  const saveMessagesToStorage = useCallback(async (chatId: string, messages: Message[]) => {
    saveMessagesQueue.current.set(chatId, messages);

    if (saveMessagesTimeout.current) {
      clearTimeout(saveMessagesTimeout.current);
    }

    saveMessagesTimeout.current = setTimeout(async () => {
      try {
        const promises = Array.from(saveMessagesQueue.current.entries()).map(([id, msgs]) => {
          const key = `group_messages_${id}`;
          return AsyncStorage.setItem(key, JSON.stringify(msgs));
        });

        await Promise.all(promises);
        saveMessagesQueue.current.clear();
      } catch (error) {
        console.error('Error saving group messages to storage:', error);
      }
    }, 1000);
  }, []);

  // Hàm lấy tin nhắn từ AsyncStorage
  const loadMessagesFromStorage = useCallback(async (chatId: string) => {
    try {
      const key = `group_messages_${chatId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const messages = JSON.parse(stored) as Message[];
        return messages;
      }
    } catch (error) {
      console.error('Error loading group messages from storage:', error);
    }
    return [];
  }, []);

  // Hàm load tin nhắn từ server
  const loadMessages = useCallback(
    async (chatId: string, pageNum: number = 1, append: boolean = false) => {
      console.log(
        '🔗 [GroupMessageOps] Loading messages for group:',
        chatId,
        'page:',
        pageNum,
        'append:',
        append
      );

      if (!chatId || typeof chatId !== 'string' || chatId.length !== 24) {
        console.warn('❌ [GroupMessageOps] Invalid chatId:', chatId);
        setIsLoadingMore(false);
        if (!append) setLoading(false);
        return;
      }

      if (append && isLoadingMore) {
        console.log('⏭️ [GroupMessageOps] Already loading more, skipping...');
        return;
      }

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          console.error('No auth token found');
          setLoading(false);
          setIsLoadingMore(false);
          return;
        }

        if (append && !isLoadingMore) {
          setIsLoadingMore(true);
        } else if (!append) {
          setLoading(true);
        }

        const url = `${CHAT_SERVICE_URL}/messages/${chatId}?page=${pageNum}&limit=20`;
        console.log('🔗 [GroupMessageOps] Fetching messages:', url);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📝 [GroupMessageOps] Received data:', data);

        let newMessages: Message[] = [];
        let hasMore = false;

        if (data && typeof data === 'object') {
          if (data.success === true && Array.isArray(data.messages)) {
            newMessages = data.messages;
            hasMore = data.pagination?.hasMore || false;
          } else if (Array.isArray(data)) {
            newMessages = data;
            hasMore = data.length === 20;
          }
        }

        const validMessages = newMessages.filter(
          (msg) => msg && msg._id && msg.sender && msg.createdAt
        );

        const sortedMessages = validMessages.sort(
          (a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Process replyTo - populate replyTo objects if they are just IDs
        const processedMessages = sortedMessages.map((msg) => {
          const replyTo = (msg as any).replyTo;
          if (replyTo && typeof replyTo === 'string') {
            // If replyTo is just an ID, find the actual message
            const replyToMessage = sortedMessages.find((m) => m._id === replyTo);
            if (replyToMessage) {
              console.log('🔄 [GroupMessageOps] Populated replyTo for message:', msg._id);
              return {
                ...msg,
                replyTo: replyToMessage,
              };
            }
          } else if (replyTo && typeof replyTo === 'object' && !replyTo.sender) {
            // If replyTo is an object but missing sender data, try to populate it
            const replyToId = replyTo._id || replyTo;
            const replyToMessage = sortedMessages.find((m) => m._id === replyToId);
            if (replyToMessage) {
              console.log('🔄 [GroupMessageOps] Fixed incomplete replyTo for message:', msg._id);
              return {
                ...msg,
                replyTo: replyToMessage,
              };
            }
          }
          return msg;
        });

        console.log('📊 [GroupMessageOps] Processed messages:', {
          total: processedMessages.length,
          hasMore,
          page: pageNum,
          withReply: processedMessages.filter((m) => m.replyTo).length,
        });

        // Debug: Log sample messages to check structure
        if (processedMessages.length > 0) {
          console.log(
            '🔍 [GroupMessageOps] Sample message keys:',
            Object.keys(processedMessages[0])
          );
          const replyMessages = processedMessages.filter((m) => m.replyTo);
          if (replyMessages.length > 0) {
            console.log(
              '🔍 [GroupMessageOps] Sample reply message:',
              JSON.stringify(replyMessages[0], null, 2)
            );
          }
        }

        if (append) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((msg) => msg._id));
            const newUniqueMessages = processedMessages.filter((msg) => !existingIds.has(msg._id));
            const combined = [...newUniqueMessages, ...prev];
            saveMessagesToStorage(chatId, combined);
            return combined;
          });
          setPage(pageNum);
        } else {
          setMessages(processedMessages);
          saveMessagesToStorage(chatId, processedMessages);
          setPage(1);
        }

        setHasMoreMessages(hasMore);
      } catch (error) {
        console.error('❌ [GroupMessageOps] Error loading messages:', error);
        if (!append) {
          const cachedMessages = await loadMessagesFromStorage(chatId);
          if (cachedMessages.length > 0) {
            console.log('📱 [GroupMessageOps] Using cached messages:', cachedMessages.length);
            setMessages(cachedMessages);
          }
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [isLoadingMore, saveMessagesToStorage, loadMessagesFromStorage]
  );

  // Handle load more với debounce
  const handleLoadMore = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastLoadMoreCall.current;

    if (timeSinceLastCall < 1000) {
      console.log('⏭️ [GroupMessageOps] Debouncing load more request');
      return;
    }

    if (!hasMoreMessages || isLoadingMore || !groupInfo?._id) {
      console.log('⏭️ [GroupMessageOps] Skip load more:', {
        hasMoreMessages,
        isLoadingMore,
        hasGroupId: !!groupInfo?._id,
      });
      return;
    }

    lastLoadMoreCall.current = now;

    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }

    loadMoreTimeoutRef.current = setTimeout(() => {
      const nextPage = page + 1;
      console.log(`📄 [GroupMessageOps] Loading page ${nextPage} for group ${groupInfo?._id}`);
      loadMessages(groupInfo._id, nextPage, true);
    }, 200);
  }, [hasMoreMessages, isLoadingMore, groupInfo?._id, page, loadMessages]);

  // Hàm gửi tin nhắn
  const sendMessage = useCallback(
    async (
      content: string,
      emojiParam?: CustomEmoji,
      replyToId?: string
    ): Promise<Message | null> => {
      if (!groupInfo?._id || !currentUserId) {
        console.error('Missing groupInfo or currentUserId');
        return null;
      }

      if (!content.trim() && !emojiParam) {
        console.error('Message content is empty');
        return null;
      }

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          throw new Error('No auth token found');
        }

        let requestBody: any = {
          chatId: groupInfo._id,
          content: content.trim(),
          type: 'text',
        };

        if (replyToId) {
          requestBody.replyTo = replyToId;
        }

        if (emojiParam) {
          // Nếu là emoji custom (có _id là ObjectId)
          if (emojiParam._id && emojiParam._id.length === 24) {
            requestBody.isEmoji = true;
            requestBody.emojiId = emojiParam._id;
            requestBody.emojiType = emojiParam.type;
            requestBody.emojiName = emojiParam.name;
            requestBody.emojiUrl = emojiParam.url;
            requestBody.content = ''; // custom emoji không cần text
            requestBody.type = 'text'; // Vẫn là text, không phải emoji
          } else {
            // Nếu là emoji unicode, chỉ gửi content là ký tự emoji, KHÔNG set isEmoji
            requestBody.content = emojiParam.code;
            requestBody.type = 'text';
          }
        }

        console.log('📤 [GroupMessageOps] Sending message:', requestBody);

        const response = await fetch(`${CHAT_SERVICE_URL}/message`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📨 [GroupMessageOps] Server response status:', response.status);
        console.log(
          '📨 [GroupMessageOps] Server response headers:',
          response.headers.get('content-type')
        );

        // Kiểm tra Content-Type trước khi parse JSON
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

          if (isJson) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
              console.warn('Cannot parse error response as JSON:', parseError);
              // Đọc response as text để debug
              const textResponse = await response.text();
              console.error('Server response (HTML/Text):', textResponse.substring(0, 200));
            }
          } else {
            // Response không phải JSON, có thể là HTML error page
            const textResponse = await response.text();
            console.error('Server returned non-JSON response:', textResponse.substring(0, 200));
            errorMessage = 'Server trả về lỗi không mong đợi. Vui lòng thử lại sau.';
          }

          throw new Error(errorMessage);
        }

        if (!isJson) {
          throw new Error('Server trả về dữ liệu không đúng định dạng JSON');
        }

        const newMessage = await response.json();
        console.log('✅ [GroupMessageOps] Message sent successfully:', newMessage._id);
        console.log(
          '🔍 [GroupMessageOps] Full message response:',
          JSON.stringify(newMessage, null, 2)
        );

        // Add message to local state immediately for better UX
        if (newMessage && newMessage._id) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg._id === newMessage._id);
            if (exists) return prev;

            const updatedMessages = [...prev, newMessage].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            saveMessagesToStorage(groupInfo._id, updatedMessages);
            return updatedMessages;
          });
        }

        return newMessage;
      } catch (error) {
        console.error('❌ [GroupMessageOps] Error sending message:', error);
        Alert.alert(
          'Lỗi',
          error instanceof Error ? error.message : 'Không thể gửi tin nhắn. Vui lòng thử lại.'
        );
        return null;
      }
    },
    [groupInfo?._id, currentUserId, saveMessagesToStorage]
  );

  // Hàm upload file/ảnh đơn lẻ
  const uploadAttachment = useCallback(
    async (file: any, type: 'image' | 'file') => {
      if (!groupInfo?._id || !currentUserId) return null;

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) throw new Error('No auth token found');

        // Test server connectivity trước
        console.log('🔍 [GroupMessageOps] Testing server connectivity...');
        try {
          const testResponse = await fetch(`${CHAT_SERVICE_URL}/list`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('🔍 [GroupMessageOps] Server test response:', testResponse.status);
        } catch (testError) {
          console.error('🔍 [GroupMessageOps] Server connectivity test failed:', testError);
        }

        console.log('📤 [GroupMessageOps] Trying upload with file...', {
          chatId: groupInfo._id,
          fileUri: file.uri?.substring(0, 50),
          fileName: file.name,
          fileType: file.type,
          apiBaseUrl: API_BASE_URL,
        });

        // Thử endpoint upload-attachment trước
        const uploadFormData = new FormData();
        uploadFormData.append('chatId', groupInfo._id);
        uploadFormData.append('file', {
          uri: file.uri,
          name: file.fileName || file.name || (type === 'image' ? 'image.jpg' : 'file.bin'),
          type:
            file.mimeType ||
            file.type ||
            (type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        } as any);

        console.log('📤 [GroupMessageOps] Trying upload-attachment endpoint first...');

        let response = await fetch(`${CHAT_SERVICE_URL}/upload-attachment`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: uploadFormData,
        });

        // Nếu upload-attachment thất bại, thử endpoint message
        if (!response.ok) {
          console.log(
            `🔄 [GroupMessageOps] upload-attachment failed (${response.status}), trying message endpoint...`
          );

          const messageFormData = new FormData();
          messageFormData.append('chatId', groupInfo._id);
          messageFormData.append('content', type === 'image' ? '📷' : '📎'); // Content ngắn gọn
          messageFormData.append('type', type);

          // Append file
          messageFormData.append('file', {
            uri: file.uri,
            name: file.fileName || file.name || (type === 'image' ? 'image.jpg' : 'file.bin'),
            type:
              file.mimeType ||
              file.type ||
              (type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
          } as any);

          response = await fetch(`${CHAT_SERVICE_URL}/message`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              // Không set Content-Type cho FormData
            },
            body: messageFormData,
          });
        }

        // Kiểm tra Content-Type trước khi parse JSON
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
          let errorMessage = `Upload failed: ${response.status}`;

          if (isJson) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
              console.warn('Cannot parse upload error response as JSON:', parseError);
              const textResponse = await response.text();
              console.error('Upload server response (HTML/Text):', textResponse.substring(0, 200));
            }
          } else {
            const textResponse = await response.text();
            console.error(
              'Upload server returned non-JSON response:',
              textResponse.substring(0, 200)
            );
            errorMessage = 'Server trả về lỗi upload không mong đợi. Vui lòng thử lại sau.';
          }

          throw new Error(errorMessage);
        }

        if (!isJson) {
          throw new Error('Server trả về dữ liệu upload không đúng định dạng JSON');
        }

        const newMessage = await response.json();
        console.log('✅ [GroupMessageOps] Upload successful:', newMessage._id);

        if (newMessage && newMessage._id) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg._id === newMessage._id);
            if (exists) return prev;

            const updatedMessages = [...prev, newMessage].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            saveMessagesToStorage(groupInfo._id, updatedMessages);
            return updatedMessages;
          });
        }

        return newMessage;
      } catch (error) {
        console.error('Error uploading attachment:', error);
        Alert.alert(
          'Lỗi',
          error instanceof Error ? error.message : 'Không thể tải lên file. Vui lòng thử lại.'
        );
        return null;
      }
    },
    [groupInfo?._id, currentUserId, saveMessagesToStorage]
  );

  // Hàm upload nhiều file/ảnh cùng lúc
  const uploadMultipleAttachments = useCallback(
    async (files: any[], type: 'image' | 'file') => {
      if (!groupInfo?._id || !currentUserId || !files || files.length === 0) return [];

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) throw new Error('No auth token found');

        console.log(
          '📤 [GroupMessageOps] Using upload-multiple endpoint for',
          files.length,
          'files'
        );

        const formData = new FormData();
        formData.append('chatId', groupInfo._id);
        formData.append('type', type === 'image' ? 'multiple-images' : 'multiple-files');

        files.forEach((file, index) => {
          const fileInfo = {
            uri: file.uri,
            name:
              file.fileName || file.name || `${type}_${index}.${type === 'image' ? 'jpg' : 'bin'}`,
            type:
              file.mimeType ||
              file.type ||
              (type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
          };
          console.log(`📎 [GroupMessageOps] Adding file ${index} to formData:`, fileInfo);
          formData.append('files', fileInfo as any);
        });

        // Sử dụng endpoint upload-multiple chuyên dụng
        const response = await fetch(`${CHAT_SERVICE_URL}/upload-multiple`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        // Kiểm tra Content-Type trước khi parse JSON
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
          // Nếu endpoint upload-multiple không hoạt động, fallback về upload từng file một
          if (response.status === 404 || response.status === 500) {
            console.log(
              '🔄 [GroupMessageOps] upload-multiple not available, falling back to individual uploads...'
            );
            const results: (Message | null)[] = [];

            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              console.log(
                `📤 [GroupMessageOps] Uploading file ${i + 1}/${files.length}:`,
                file.name || file.uri
              );

              const result = await uploadAttachment(file, type);
              results.push(result);

              // Delay nhỏ giữa các upload để tránh quá tải
              if (i < files.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }

            const successfulUploads = results.filter((result) => result !== null);
            console.log(
              `✅ [GroupMessageOps] Successfully uploaded ${successfulUploads.length}/${files.length} files (individual)`
            );

            return results;
          }

          let errorMessage = `Multiple upload failed: ${response.status}`;

          if (isJson) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
              console.warn('Cannot parse multiple upload error response as JSON:', parseError);
              const textResponse = await response.text();
              console.error(
                'Multiple upload server response (HTML/Text):',
                textResponse.substring(0, 200)
              );
            }
          } else {
            const textResponse = await response.text();
            console.error(
              'Multiple upload server returned non-JSON response:',
              textResponse.substring(0, 200)
            );
            errorMessage =
              'Server trả về lỗi upload nhiều file không mong đợi. Vui lòng thử lại sau.';
          }

          throw new Error(errorMessage);
        }

        if (!isJson) {
          throw new Error('Server trả về dữ liệu upload nhiều file không đúng định dạng JSON');
        }

        const newMessage = await response.json();
        console.log('✅ [GroupMessageOps] Multiple upload server response:', newMessage);

        if (newMessage && newMessage._id) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg._id === newMessage._id);
            if (exists) return prev;

            const updatedMessages = [...prev, newMessage].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            saveMessagesToStorage(groupInfo._id, updatedMessages);
            return updatedMessages;
          });

          return [newMessage];
        }

        return [];
      } catch (error) {
        console.error('Error uploading multiple attachments:', error);
        Alert.alert(
          'Lỗi',
          error instanceof Error
            ? error.message
            : 'Có lỗi xảy ra khi tải lên nhiều file. Vui lòng thử lại.'
        );
        return [];
      }
    },
    [groupInfo?._id, currentUserId, uploadAttachment, saveMessagesToStorage]
  );

  // Xử lý khi nhận tin nhắn mới
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === newMessage._id);
        if (exists) return prev;

        // Process replyTo for new message
        let processedMessage = newMessage;
        const replyTo = (newMessage as any).replyTo;
        if (replyTo && typeof replyTo === 'string') {
          // If replyTo is just an ID, find the actual message
          const replyToMessage = prev.find((m) => m._id === replyTo);
          if (replyToMessage) {
            console.log('🔄 [GroupMessageOps] Populated replyTo for new message:', newMessage._id);
            processedMessage = {
              ...newMessage,
              replyTo: replyToMessage,
            };
          }
        }

        const updatedMessages = [...prev, processedMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        if (groupInfo?._id) {
          saveMessagesToStorage(groupInfo._id, updatedMessages);
        }

        return updatedMessages;
      });
    },
    [groupInfo?._id, saveMessagesToStorage]
  );

  // Xử lý cập nhật trạng thái đã đọc
  const handleMessageRead = useCallback(
    ({ userId, chatId: updatedChatId }: { userId: string; chatId: string }) => {
      if (updatedChatId === groupInfo?._id) {
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            readBy: msg.readBy?.includes(userId) ? msg.readBy : [...(msg.readBy || []), userId],
          }))
        );
      }
    },
    [groupInfo?._id]
  );

  // Xử lý thu hồi tin nhắn
  const handleMessageRevoked = useCallback(
    ({ messageId, chatId: updatedChatId }: { messageId: string; chatId: string }) => {
      if (updatedChatId === groupInfo?._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  isRevoked: true,
                  content: '',
                  fileUrl: undefined,
                  fileUrls: undefined,
                  fileName: undefined,
                  fileSize: undefined,
                  emojiUrl: undefined,
                  emojiType: undefined,
                  emojiId: undefined,
                  isEmoji: false,
                }
              : msg
          )
        );
      }
    },
    [groupInfo?._id]
  );

  // Đánh dấu tin nhắn đã đọc
  const markMessagesAsRead = useCallback(async (chatId: string, userId: string, token: string) => {
    try {
      await fetch(`${CHAT_SERVICE_URL}/messages/${chatId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, []);

  return {
    messages,
    setMessages,
    loading,
    isLoadingMore,
    hasMoreMessages,
    loadMessages,
    handleLoadMore,
    sendMessage,
    uploadAttachment,
    uploadMultipleAttachments,
    handleNewMessage,
    handleMessageRead,
    handleMessageRevoked,
    markMessagesAsRead,
    forceResetLoadingStates,
  };
};
