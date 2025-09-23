import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { Alert } from 'react-native';
import { Message, Chat } from '../types/message';
import { CustomEmoji } from '../hooks/useEmojis';
import { CHAT_SERVICE_URL, API_BASE_URL } from '../config/constants';

interface UseMessageOperationsProps {
  chat: Chat | null;
  currentUserId: string | null;
}

export const useMessageOperations = ({ chat, currentUserId }: UseMessageOperationsProps) => {
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
    console.log('🔄 Force resetting all loading states');
    setIsLoadingMore(false);
    setLoading(false);
    setHasMoreMessages(false);
  }, []);

  // Reset page khi chat thay đổi
  useEffect(() => {
    if (chat?._id) {
      console.log('📄 Resetting page to 1 for new chat:', chat._id);
      setPage(1);
      setHasMoreMessages(true);
      // Reset debounce state for new chat
      lastLoadMoreCall.current = 0;
      // Clear any pending timeout
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }
    }
  }, [chat?._id]);

  // Timeout để tự động reset isLoadingMore nếu bị stuck
  useEffect(() => {
    if (isLoadingMore) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ isLoadingMore stuck for too long, force resetting...');
        forceResetLoadingStates();
      }, 10000); // 10 seconds timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoadingMore, forceResetLoadingStates]);

  // Hàm lưu tin nhắn vào AsyncStorage với batching
  const saveMessagesToStorage = useCallback(async (chatId: string, messages: Message[]) => {
    // Add to queue
    saveMessagesQueue.current.set(chatId, messages);

    // Clear existing timeout
    if (saveMessagesTimeout.current) {
      clearTimeout(saveMessagesTimeout.current);
    }

    // Batch save operations
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
    }, 1000); // Batch operations every 1 second
  }, []);

  // Hàm lấy tin nhắn từ AsyncStorage
  const loadMessagesFromStorage = useCallback(async (chatId: string) => {
    try {
      const key = `chat_messages_${chatId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const messages = JSON.parse(stored) as Message[];
        return messages;
      }
    } catch (error) {
      console.error('Error loading messages from storage:', error);
    }
    return [];
  }, []);

  // Hàm load tin nhắn từ server
  const loadMessages = useCallback(
    async (chatId: string, pageNum: number = 1, append: boolean = false) => {
      console.log('🔗 [loadMessages] chatId:', chatId, 'page:', pageNum, 'append:', append);
      if (!chatId || typeof chatId !== 'string' || chatId.length !== 24) {
        console.warn('❌ [loadMessages] Invalid chatId:', chatId);
        // Không coi là lỗi khẩn: nếu chưa có chatId (chưa có lịch sử), chỉ tắt loading
        setIsLoadingMore(false);
        if (!append) setLoading(false);
        return;
      }

      // Prevent multiple simultaneous calls for the same page
      if (append && isLoadingMore) {
        console.log('⏭️ [loadMessages] Already loading more, skipping...');
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

        // Only set loading state if not already loading
        if (append && !isLoadingMore) {
          setIsLoadingMore(true);
        } else if (!append) {
          setLoading(true);
        }

        // Gọi API với pagination
        const url = `${CHAT_SERVICE_URL}/messages/${chatId}?page=${pageNum}&limit=20`;
        console.log('📥 [loadMessages] GET', url);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📥 [loadMessages] Status:', response.status, response.statusText);
        console.log('📥 [loadMessages] Content-Type:', response.headers.get('content-type'));
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Expected JSON but got:', textResponse.substring(0, 200));

            // Fallback to storage if server returns non-JSON
            if (!append) {
              const storedMessages = await loadMessagesFromStorage(chatId);
              setMessages(storedMessages);
            }
            setHasMoreMessages(false);
            // Reset loading states
            setIsLoadingMore(false);
            if (!append) {
              setLoading(false);
            }
            return;
          }

          const data = await response.json();

          // Kiểm tra cấu trúc response - ưu tiên cấu trúc mới
          let responseMessages = [];
          let hasMore = false;

          if (
            data &&
            typeof data === 'object' &&
            data.success === true &&
            Array.isArray(data.messages)
          ) {
            // Cấu trúc response mới với pagination
            responseMessages = data.messages;
            hasMore = data.pagination?.hasMore || false;
          } else if (Array.isArray(data)) {
            // Cấu trúc response cũ - trả về trực tiếp array
            responseMessages = data;
            hasMore = responseMessages.length >= 20;
          } else {
            // Nếu không có tin nhắn nào, set empty array
            responseMessages = [];
            hasMore = false;
          }

          console.log(
            `📦 [loadMessages] Got ${responseMessages.length} messages, hasMore: ${hasMore}`
          );
          setHasMoreMessages(hasMore);

          // Validate messages structure
          const validMessages = responseMessages.filter(
            (msg) => msg && msg._id && msg.sender && msg.createdAt
          );

          if (validMessages.length !== responseMessages.length) {
            console.warn(
              `Filtered out ${responseMessages.length - validMessages.length} invalid messages`
            );
          }

          // Sắp xếp tin nhắn theo thời gian
          const sortedMessages = validMessages.sort(
            (a: Message, b: Message) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          if (append) {
            // Thêm tin nhắn cũ hơn vào đầu danh sách (vì FlatList bị inverted)
            // Tin nhắn từ API đã được sắp xếp từ cũ -> mới
            setMessages((prevMessages) => {
              const existingIds = new Set(prevMessages.map((msg) => msg._id));
              const newOldMessages = sortedMessages.filter((msg) => !existingIds.has(msg._id));

              console.log(
                `📝 [loadMessages] Adding ${newOldMessages.length} older messages to the beginning`
              );
              // Tin nhắn cũ hơn được thêm vào đầu array
              return [...newOldMessages, ...prevMessages];
            });
          } else {
            setMessages(sortedMessages);
          }

          // Lưu vào storage (chỉ lưu khi không append để tránh duplicate)
          if (!append && sortedMessages.length > 0) {
            await saveMessagesToStorage(chatId, sortedMessages);
          }

          // Hoàn tất: tắt loading
          setIsLoadingMore(false);
          if (!append) {
            setLoading(false);
          }
        } else {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.warn(`💡 Messages API endpoint not available (Status: ${response.status})`);
            console.warn('Backend server may not be running or endpoint not implemented yet.');

            // Fallback to storage if server returns HTML error page
            if (!append) {
              try {
                const storedMessages = await loadMessagesFromStorage(chatId);
                if (storedMessages.length > 0) {
                  console.log('📱 Using cached messages from storage');
                  setMessages(storedMessages);
                  setHasMoreMessages(false);
                } else {
                  setMessages([]);
                }
              } catch (storageError) {
                console.warn('Warning: Could not load cached messages:', storageError.message);
                setMessages([]);
              }
            }

            forceResetLoadingStates();
            return;
          }

          // For non-HTML errors, try to get more info
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorText = await response.text();
            // Only log first 100 chars to avoid spam
            errorMessage = errorText.length > 100 ? errorText.substring(0, 100) + '...' : errorText;
          } catch (parseError) {
            // If we can't even read the response, just use status
          }

          console.warn('⚠️ Messages API unavailable:', errorMessage);
          forceResetLoadingStates();
          return;
        }
      } catch (error) {
        // Handle network errors more gracefully
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn('⚠️ Messages API request timed out');
          } else if (
            error.name === 'TypeError' &&
            error.message.includes('Network request failed')
          ) {
            console.warn('⚠️ Network error - server may be offline');
          } else {
            console.warn('⚠️ Error loading messages:', error.message);
          }
        } else {
          console.warn('⚠️ Unknown error loading messages:', error);
        }

        // Fallback: load từ storage nếu API thất bại và không phải append
        if (!append) {
          try {
            const storedMessages = await loadMessagesFromStorage(chatId);
            if (storedMessages.length > 0) {
              console.log('📱 Using cached messages from storage after error');
              setMessages(storedMessages);
              setHasMoreMessages(false);
            } else {
              setMessages([]);
            }
          } catch (storageError) {
            console.warn(
              'Warning: Could not load cached messages after error:',
              storageError.message
            );
            setMessages([]);
          }
        }
      } finally {
        setIsLoadingMore(false);
        if (!append) {
          setLoading(false);
        }
      }
    },
    [isLoadingMore, saveMessagesToStorage, loadMessagesFromStorage, forceResetLoadingStates]
  );

  // Xử lý load more khi scroll lên trên
  const handleLoadMore = useCallback(() => {
    const now = Date.now();

    console.log('handleLoadMore called:', {
      hasChat: !!chat?._id,
      isLoadingMore,
      hasMoreMessages,
      chatId: chat?._id,
      currentPage: page,
      timeSinceLastCall: now - lastLoadMoreCall.current,
    });

    // Debounce: Ignore calls within 1000ms of the last call
    if (now - lastLoadMoreCall.current < 1000) {
      console.log('⏱️ Debounced handleLoadMore call - too soon');
      return;
    }

    if (!chat?._id || isLoadingMore || !hasMoreMessages) {
      console.log('❌ Skip handleLoadMore:', {
        hasChat: !!chat?._id,
        isLoadingMore,
        hasMoreMessages,
      });
      return;
    }

    // Update last call time
    lastLoadMoreCall.current = now;

    // Clear any existing timeout
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
      loadMoreTimeoutRef.current = null;
    }

    // Lưu chatId để tránh stale closure
    const chatId = chat._id;

    console.log('✅ Processing handleLoadMore for chatId:', chatId, 'current page:', page);

    // Set loading state immediately
    setIsLoadingMore(true);

    // Sử dụng functional update để đảm bảo luôn có giá trị page mới nhất
    setPage((currentPage) => {
      const nextPage = currentPage + 1;
      console.log('📄 Setting page from', currentPage, 'to', nextPage, 'for chat:', chatId);

      // Use timeout to ensure state updates are processed
      loadMoreTimeoutRef.current = setTimeout(() => {
        console.log('🚀 Actually loading messages for page:', nextPage);
        loadMessages(chatId, nextPage, true);
      }, 100);

      return nextPage;
    });
  }, [isLoadingMore, hasMoreMessages, chat?._id, page, loadMessages]);

  // Cải thiện hàm tryAlternativeEndpoints
  const tryAlternativeEndpoints = useCallback(async (originalBody: any, token: string) => {
    const endpoints = [
      `${CHAT_SERVICE_URL}/message`, // Main chat service endpoint
      `${CHAT_SERVICE_URL}/send-message`, // Alternative chat service endpoint
    ];

    for (const endpoint of endpoints) {
      try {
        console.log('🔄 Trying alternative endpoint:', endpoint);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(originalBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const newMessage = await res.json();
            if (newMessage && newMessage._id) {
              console.log('✅ Alternative endpoint worked:', endpoint);
              return newMessage;
            }
          }
        }
      } catch (error) {
        console.log('❌ Alternative endpoint failed:', endpoint, error.message);
        continue;
      }
    }

    console.log('❌ All alternative endpoints failed');
    return null;
  }, []);

  // Gửi tin nhắn
  const sendMessage = useCallback(
    async (content: string = '', emojiParam?: CustomEmoji, replyToId?: string) => {
      if ((!content.trim() && !emojiParam) || !chat) return null;

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('❌ No auth token found');
        return null;
      }

      console.log('🔑 Debug send message:', {
        hasToken: !!token,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
        chatId: chat._id,
        content: content.substring(0, 50),
        hasEmoji: !!emojiParam,
      });

      let url = `${CHAT_SERVICE_URL}/message`;
      let body: any = {
        chatId: chat._id,
        content: content.trim(),
        type: 'text',
      };

      if (emojiParam) {
        // Nếu là emoji custom (có _id là ObjectId)
        if (emojiParam._id && emojiParam._id.length === 24) {
          body.isEmoji = true;
          body.emojiId = emojiParam._id;
          body.emojiType = emojiParam.type;
          body.emojiName = emojiParam.name;
          body.emojiUrl = emojiParam.url;
          body.content = ''; // custom emoji không cần text
        } else {
          // Nếu là emoji unicode, chỉ gửi content là ký tự emoji, KHÔNG set isEmoji
          body.content = emojiParam.code;
        }
      }

      // Trường hợp reply
      if (replyToId) {
        url = `${CHAT_SERVICE_URL}/message/reply`;
        body.replyToId = replyToId;
      }

      try {
        console.log('📤 [sendMessage] POST', url, 'body:', body);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('📤 [sendMessage] Status:', res.status, res.statusText);
        console.log('📤 [sendMessage] Content-Type:', res.headers.get('content-type'));

        if (!res.ok) {
          const contentType = res.headers.get('content-type');
          console.log('📡 Response content-type:', contentType);

          // Kiểm tra nếu server trả về HTML (thường là 404 page)
          if (contentType && contentType.includes('text/html')) {
            console.warn('⚠️ Server returned HTML response (likely 404 page)');

            // Thử các endpoint thay thế trước khi báo lỗi
            if (res.status === 404 && !replyToId) {
              // Chỉ thử với tin nhắn thường, không phải reply
              console.log('🔄 Trying alternative endpoints...');
              const alternativeResult = await tryAlternativeEndpoints(body, token);
              if (alternativeResult) {
                setMessages((prev) => {
                  const exists = prev.some((m) => m._id === alternativeResult._id);
                  return exists ? prev : [...prev, alternativeResult];
                });
                await saveMessagesToStorage(chat._id, [...messages, alternativeResult]);
                return alternativeResult;
              }
            }

            if (res.status === 404) {
              console.warn('⚠️ Send message API endpoint not implemented yet (404)');
              Alert.alert(
                'Tính năng đang phát triển',
                'Tính năng gửi tin nhắn đang được phát triển. Vui lòng thử lại sau hoặc liên hệ với quản trị viên.'
              );
            } else {
              console.warn(`⚠️ Server error: ${res.status}`);
              Alert.alert(
                'Lỗi server',
                `Server đang gặp sự cố (${res.status}). Vui lòng thử lại sau.`
              );
            }
            return null;
          }

          // Xử lý JSON error response
          try {
            const errorData = await res.json();
            const errorMessage = errorData.message || errorData.error || 'Không thể gửi tin nhắn';
            console.warn('⚠️ Failed to send message:', res.status, errorMessage);
            Alert.alert('Lỗi gửi tin nhắn', errorMessage);
          } catch (jsonError) {
            // Fallback nếu không parse được JSON
            const errText = await res.text();
            console.warn(
              '⚠️ Failed to send message (non-JSON):',
              res.status,
              errText.substring(0, 100)
            );
            Alert.alert('Lỗi gửi tin nhắn', `Lỗi server (${res.status}). Vui lòng thử lại.`);
          }
          return null;
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('⚠️ Expected JSON response but got:', contentType);
          Alert.alert('Lỗi', 'Server trả về dữ liệu không hợp lệ');
          return null;
        }

        const newMessage = await res.json();
        console.log('✅ Sent new message:', newMessage);

        if (newMessage && newMessage._id) {
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === newMessage._id);
            return exists ? prev : [...prev, newMessage];
          });

          // Lưu vào storage
          await saveMessagesToStorage(chat._id, [...messages, newMessage]);

          return newMessage;
        } else {
          console.warn('⚠️ Invalid message response - missing _id');
          Alert.alert('Lỗi', 'Tin nhắn không được gửi đúng cách');
          return null;
        }
      } catch (error) {
        console.warn('⚠️ Error sending message:', error);

        if (error.name === 'AbortError') {
          Alert.alert('Lỗi kết nối', 'Kết nối bị timeout. Vui lòng kiểm tra mạng và thử lại.');
        } else if (error.message.includes('Network request failed')) {
          Alert.alert('Lỗi mạng', 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        } else {
          Alert.alert('Lỗi gửi tin nhắn', 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại.');
        }
        return null;
      }
    },
    [chat, messages, saveMessagesToStorage, tryAlternativeEndpoints]
  );

  // Upload file/ảnh
  const uploadAttachment = useCallback(
    async (file: any, type: 'image' | 'file') => {
      if (!chat) return;

      const token = await AsyncStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('chatId', chat._id);

      if (type === 'image') {
        formData.append('file', {
          uri: file.uri,
          name: file.fileName || file.name || 'image.jpg',
          type: file.mimeType || file.type || 'image/jpeg',
        } as any);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      try {
        const res = await fetch(`${CHAT_SERVICE_URL}/upload-attachment`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        const newMessage = await res.json();
        if (newMessage && newMessage._id) {
          setMessages((prevMessages) => {
            const exists = prevMessages.some((m) => m._id === newMessage._id);
            return exists ? prevMessages : [...prevMessages, newMessage];
          });

          // Lưu vào storage
          await saveMessagesToStorage(chat._id, [...messages, newMessage]);

          return newMessage;
        }
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể gửi file/ảnh.');
        return null;
      }
    },
    [chat, messages, saveMessagesToStorage]
  );

  // Upload nhiều ảnh
  const uploadMultipleImages = useCallback(
    async (images: any[]) => {
      if (!chat) return;

      const token = await AsyncStorage.getItem('authToken');

      try {
        console.log('Preparing to upload multiple images:', images.length);
        const formData = new FormData();
        formData.append('chatId', chat._id);
        formData.append('type', 'multiple-images');

        images.forEach((img, index) => {
          const fileInfo = {
            uri: img.uri,
            name: img.fileName || img.name || `image_${index}.jpg`,
            type: img.mimeType || img.type || 'image/jpeg',
          };
          console.log(`Adding image ${index} to formData:`, fileInfo);
          formData.append('files', fileInfo as any);
        });

        console.log('Sending request to upload-multiple endpoint');
        const res = await fetch(`${CHAT_SERVICE_URL}/upload-multiple`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        const newMessage = await res.json();
        console.log('Server response for multiple images upload:', newMessage);

        if (newMessage && newMessage._id) {
          setMessages((prevMessages) => {
            const exists = prevMessages.some((m) => m._id === newMessage._id);
            return exists ? prevMessages : [...prevMessages, newMessage];
          });

          // Lưu vào storage
          await saveMessagesToStorage(chat._id, [...messages, newMessage]);

          return newMessage;
        }
      } catch (err) {
        console.error('Error uploading multiple images:', err);
        Alert.alert('Lỗi', 'Không thể gửi nhiều ảnh cùng lúc.');
        return null;
      }
    },
    [chat, messages, saveMessagesToStorage]
  );

  // Đánh dấu tin nhắn đã đọc
  const markMessagesAsRead = useCallback(
    async (chatId: string | null, userId: string, token: string) => {
      if (!chatId) return;

      try {
        const timestamp = new Date().toISOString();
        console.log('🔵 [MARK READ] Starting mark messages as read:', {
          chatId,
          userId,
          timestamp,
        });

        // Cập nhật UI ngay lập tức để responsive hơn
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.sender._id !== userId && (!msg.readBy || !msg.readBy.includes(userId))) {
              return {
                ...msg,
                readBy: [...(msg.readBy || []), userId],
              };
            }
            return msg;
          })
        );

        // Gọi API để đồng bộ với server
        console.log('🌐 [MARK READ] Calling API to mark messages as read');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${CHAT_SERVICE_URL}/read-all/${chatId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ timestamp }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ [MARK READ] Successfully marked messages as read');
        } else {
          // Check if this is a known unimplemented endpoint
          if (response.status === 404) {
            console.warn('⚠️ [MARK READ] API endpoint not implemented yet:', {
              status: response.status,
              endpoint: `/api/chat/read-all/${chatId}`,
            });
            // Don't treat 404 as a critical error - the UI is already updated
            return;
          }

          // For other errors, log them but don't crash
          const contentType = response.headers.get('content-type');
          let errorText = 'Unknown error';

          if (contentType && contentType.includes('application/json')) {
            try {
              const errorData = await response.json();
              errorText = errorData.message || `HTTP ${response.status}`;
            } catch (parseError) {
              errorText = `HTTP ${response.status} - Failed to parse error response`;
            }
          } else {
            // It's probably HTML error page, don't log the full HTML
            errorText = `HTTP ${response.status} - Server returned HTML error page`;
          }

          console.warn('⚠️ [MARK READ] API call failed (non-critical):', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
          });
        }
      } catch (error) {
        // Handle network errors, timeouts, etc.
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn('⚠️ [MARK READ] Request timed out');
          } else {
            console.warn('⚠️ [MARK READ] Network error (non-critical):', error.message);
          }
        } else {
          console.warn('⚠️ [MARK READ] Unknown error (non-critical):', error);
        }
      }
    },
    []
  );

  // Thu hồi tin nhắn
  const revokeMessage = useCallback(async (messageId: string) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${CHAT_SERVICE_URL}/message/${messageId}/revoke`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to revoke message';

        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            console.error('Error parsing error response:', jsonError);
          }
        } else {
          const textResponse = await response.text();
          console.error('Non-JSON error response:', textResponse);
          errorMessage = `Server error: ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      // Cập nhật local state
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

      return true;
    } catch (error) {
      console.error('Error revoking message:', error);
      throw error;
    }
  }, []);

  // Xử lý khi nhận tin nhắn mới
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      setMessages((prev) => {
        // Kiểm tra tin nhắn đã tồn tại chưa
        const exists = prev.some((msg) => msg._id === newMessage._id);
        if (exists) {
          return prev;
        }

        // Thêm tin nhắn mới và sắp xếp lại
        const updatedMessages = [...prev, newMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Lưu vào storage
        if (chat?._id) {
          saveMessagesToStorage(chat._id, updatedMessages);
        }

        return updatedMessages;
      });
    },
    [chat?._id, saveMessagesToStorage]
  );

  // Xử lý cập nhật trạng thái đã đọc
  const handleMessageRead = useCallback(
    ({ userId, chatId: updatedChatId }: { userId: string; chatId: string }) => {
      if (updatedChatId === chat?._id) {
        // Cập nhật UI ngay lập tức
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            readBy: msg.readBy?.includes(userId) ? msg.readBy : [...(msg.readBy || []), userId],
          }))
        );
      }
    },
    [chat?._id]
  );

  // Xử lý thu hồi tin nhắn
  const handleMessageRevoked = useCallback(
    ({ messageId, chatId: updatedChatId }: { messageId: string; chatId: string }) => {
      if (updatedChatId === chat?._id) {
        // Cập nhật UI ngay lập tức
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
    [chat?._id]
  );

  // Kiểm tra server health và log thông tin debug
  const checkServerHealth = useCallback(async () => {
    const healthEndpoints = [
      `${API_BASE_URL}/health`,
      `${API_BASE_URL}/api/health`,
      `${API_BASE_URL}/status`,
      `${API_BASE_URL}/api/status`,
      `${CHAT_SERVICE_URL}/chats`,
    ];

    console.log('🏥 Checking server health...');
    console.log('🌐 API Base URL:', API_BASE_URL);

    for (const endpoint of healthEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`📊 ${endpoint}: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const contentType = res.headers.get('content-type');
          console.log(`📊 Content-Type: ${contentType}`);
        }
      } catch (error) {
        console.log(`📊 ${endpoint}: ERROR - ${error.message}`);
      }
    }
  }, []);

  // Gọi health check khi component mount
  useEffect(() => {
    if (chat?._id) {
      checkServerHealth();
    }
  }, [chat?._id, checkServerHealth]);

  // Cleanup timeout when component unmounts or chat changes
  useEffect(() => {
    return () => {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }
    };
  }, [chat?._id]);

  return {
    messages,
    setMessages,
    loading,
    isLoadingMore,
    hasMoreMessages,
    page,
    setPage,
    loadMessages,
    handleLoadMore,
    sendMessage,
    uploadAttachment,
    uploadMultipleImages,
    markMessagesAsRead,
    revokeMessage,
    handleNewMessage,
    handleMessageRead,
    handleMessageRevoked,
    forceResetLoadingStates,
  };
};
