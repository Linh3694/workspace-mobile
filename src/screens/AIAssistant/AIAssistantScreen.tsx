// @ts-nocheck
/**
 * AI Assistant Screen - Mobile
 * Giống AIAssistant bản web, khác duy nhất: Role selector đặt ở góc trên bên trái màn hình
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Keyboard,
  Platform,
  Linking,
  AppState,
  InteractionManager,
} from 'react-native';
// @ts-ignore
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { AI_BACKEND_URL } from '../../config/constants';
import { ROUTES } from '../../constants/routes';
import { toast } from '../../components/Toast';
import {
  aiChatFeedbackService,
  AI_CHAT_DISLIKE_REASONS,
} from '../../services/aiChatFeedbackService';
import { BottomSheetModal } from '../../components/Common';

// Liquid Glass - giống BottomTabNavigator, fallback BlurView khi không hỗ trợ
let LiquidGlassView: any = null;
let isLiquidGlassSupported = false;
try {
  const liquidGlass = require('@callstack/liquid-glass');
  LiquidGlassView = liquidGlass.LiquidGlassView;
  isLiquidGlassSupported = liquidGlass.isLiquidGlassSupported ?? false;
} catch {
  // Expo Go hoặc chưa prebuild
}

// React Native không hỗ trợ response.body.getReader() - dùng endpoint non-streaming
const USE_NON_STREAMING = Platform.OS !== 'web';

// Loại bỏ emoji trên mobile — tránh hiển thị [?] khi font không hỗ trợ
function stripEmojiForMobile(text: string): string {
  if (Platform.OS === 'web') return text;
  // Xóa emoji trong báo cáo: 📊 📋 💡 📎
  return text.replace(/📊|📋|💡|📎/g, '').replace(/  +/g, ' ');
}

// Trích xuất gợi ý tappable từ nội dung markdown (backend trả về dạng - *"..."* — mô tả)
function extractSuggestions(content: string): { cleanContent: string; suggestions: string[] } {
  const suggestions: string[] = [];
  // Match cả straight quotes "..." lẫn smart quotes \u201c...\u201d, có/không có dấu *
  const regex = /- \*?["\u201c]([^"\u201d]+)["\u201d]\*?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    suggestions.push(match[1].trim());
  }
  if (suggestions.length === 0) return { cleanContent: content, suggestions: [] };

  let clean = content;
  // Xóa block gợi ý: tiêu đề, danh sách, câu kết
  clean = clean.replace(/\*?\*?Gợi ý:\*?\*?[^\n]*\n?/g, '');
  clean = clean.replace(/^- \*?["\u201c][^"\u201d]+["\u201d]\*?[^\n]*$/gm, '');
  clean = clean.replace(/\*?Anh\/chị cần tôi tra cứu thêm[^*\n]*\??\*?\s*/g, '');
  // Dọn trailing --- và dòng trống thừa
  clean = clean.replace(/\n---\s*\n*$/, '').replace(/\n{3,}/g, '\n\n').trim();

  return { cleanContent: clean, suggestions };
}

const GUEST_NAME_STORAGE_KEY = 'ai_assistant_guest_name';
const CHAT_STREAM_URL = `${AI_BACKEND_URL}/chat/stream`;
const CHAT_URL = `${AI_BACKEND_URL}/chat`;

// Chỉ user có role Mobile BOD mới được dùng AI Assistant
const REQUIRED_AI_ROLE = 'Mobile BOD';

// Dark mode tự động sau 18:30
const DARK_MODE_HOUR = 18;
const DARK_MODE_MINUTE = 30;
function isNightTime(): boolean {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= DARK_MODE_HOUR * 60 + DARK_MODE_MINUTE;
}

// Màu nền xám trắng thống nhất cho glass, bubble, input, gợi ý
const GLASS_BG = {
  light: 'rgba(255, 255, 255, 0.92)',
  dark: 'rgba(55, 55, 60, 0.92)',
};

const THEME = {
  light: {
    bg: '#F2F2F2',
    text: '#111827',
    textMuted: '#6B7280',
    textSecondary: '#374151',
    /** Placeholder ô nhập — tách biệt để dark mode đủ tương phản với nền kính */
    inputPlaceholder: '#6B7280',
    inputBg: GLASS_BG.light,
    userBubble: GLASS_BG.light,
    suggestionChip: GLASS_BG.light,
    suggestionBorder: '#E5E7EB',
    errorBg: '#FEF2F2',
    errorBorder: '#FECACA',
    errorText: '#B91C1C',
    attachmentBg: GLASS_BG.light,
    attachmentBorder: '#E5E7EB',
    codeInline: '#F3F4F6',
    dot: '#9CA3AF',
    modalContent: '#fff',
    modalOverlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    bg: '#000',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    textSecondary: '#D1D5DB',
    /** Trên nền kính xám, placeholder #9CA3AF quá nhạt — dùng xám sáng hơn */
    inputPlaceholder: '#E5E7EB',
    inputBg: GLASS_BG.dark,
    userBubble: GLASS_BG.dark,
    suggestionChip: GLASS_BG.dark,
    suggestionBorder: '#374151',
    errorBg: '#7F1D1D',
    errorBorder: '#991B1B',
    errorText: '#FECACA',
    attachmentBg: GLASS_BG.dark,
    attachmentBorder: '#374151',
    codeInline: '#1F2937',
    dot: '#9CA3AF',
    modalContent: '#1F2937',
    modalOverlay: 'rgba(0,0,0,0.8)',
  },
};

// Component bọc nội dung với Liquid Glass / BlurView - giống BottomTabBar
// variant="input" = hiệu ứng liquid glass thuần như BottomTab (không overlay đậm che mất hiệu ứng)
function GlassContainer({
  children,
  style,
  cornerRadius = 999,
  isDarkMode = false,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: any;
  cornerRadius?: number;
  isDarkMode?: boolean;
  /** "input" = liquid glass thuần như BottomTab, không overlay đậm */
  variant?: 'default' | 'input';
}) {
  const tint = isDarkMode ? 'dark' : 'light';
  const overlayBg = GLASS_BG[isDarkMode ? 'dark' : 'light'];
  // Overlay nhẹ cho variant input - màu trắng (light) / nền dark đủ đậm để chữ trắng dễ đọc
  const inputOverlayBg = isDarkMode ? 'rgba(48, 48, 55, 0.94)' : 'rgba(255, 255, 255, 0.70)';
  // Khi variant input + Liquid Glass: không overlay để hiệu ứng liquid glass lộ ra (giống BottomTab)
  const skipOverlayForLiquidGlass = variant === 'input' && isLiquidGlassSupported;
  // Dark + Liquid Glass: thêm lớp tint mỏng vì không có overlay — tránh nền quá nhạt, chữ khó đọc
  const liquidGlassDarkInputTint =
    isDarkMode && variant === 'input' && skipOverlayForLiquidGlass
      ? 'rgba(36, 36, 42, 0.82)'
      : undefined;
  return (
    <View
      style={[
        glassStyles.wrapper,
        { borderRadius: cornerRadius },
        variant === 'input' && isLiquidGlassSupported && glassStyles.liquidGlassWrapper,
        style,
      ]}>
      {isLiquidGlassSupported && LiquidGlassView ? (
        <>
          <LiquidGlassView {...({ style: StyleSheet.absoluteFill, cornerRadius } as any)} />
          {!skipOverlayForLiquidGlass && (
            <View style={[glassStyles.overlay, { backgroundColor: overlayBg }]} />
          )}
          {liquidGlassDarkInputTint != null && (
            <View style={[glassStyles.overlay, { backgroundColor: liquidGlassDarkInputTint }]} />
          )}
        </>
      ) : (
        <>
          <BlurView intensity={10} tint={tint} {...({ style: StyleSheet.absoluteFill } as any)} />
          <View
            style={[
              glassStyles.overlay,
              {
                backgroundColor: variant === 'input' ? inputOverlayBg : overlayBg,
              },
            ]}
          />
        </>
      )}
      <View style={glassStyles.content}>{children}</View>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  // Khi dùng Liquid Glass cho input - giống BottomTab, không thêm gì che hiệu ứng
  liquidGlassWrapper: {
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  content: {
    flex: 1,
    zIndex: 1,
    ...Platform.select({
      ios: {},
      android: { elevation: 1 },
    }),
  },
});

// Types
interface FormAttachment {
  name: string;
  filename: string;
  description?: string;
  download_url: string;
  file_type: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
  attachments?: FormAttachment[];
  isLoading?: boolean;
  suggestions?: string[];
  /** Phản hồi đã gửi: like / dislike */
  feedback?: 'like' | 'dislike' | null;
}

type UserRole = 'wisers';

// Helper: gửi tin nhắn qua endpoint non-streaming (dùng khi React Native không hỗ trợ getReader)
async function sendMessageNonStreaming(
  question: string,
  conversationHistory: { role: string; content: string }[],
  loadingMessage: Message,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  guestName: string | null,
  user: any,
  selectedRole: UserRole,
  isNewConversation: boolean
) {
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        conversation_history: conversationHistory,
        user_name: guestName || user?.fullname || undefined,
        user: user
          ? {
              email: user.email,
              first_name: user.fullname?.split(' ').pop(),
              last_name: user.fullname?.split(' ').slice(0, -1).join(' '),
              full_name: user.fullname,
              user_image: user.avatar,
              avatar_url: user.avatar,
              roles: user.roles,
            }
          : null,
        is_new_conversation: isNewConversation,
        role: selectedRole,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.answer || 'Xin lỗi, tôi chưa thể trả lời.';

    // Tách gợi ý trước typewriter — chỉ animate phần nội dung, chips hiện sau
    const { cleanContent, suggestions } = extractSuggestions(rawContent);
    const fullContent = suggestions.length > 0 ? cleanContent : rawContent;

    const CHUNK_SIZE = 3;
    const INTERVAL_MS = 25;

    await new Promise<void>((resolve) => {
      let currentIndex = 0;

      const revealNextChunk = () => {
        currentIndex += CHUNK_SIZE;
        const partial = fullContent.slice(0, Math.min(currentIndex, fullContent.length));

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  content: partial,
                  isLoading: partial.length < fullContent.length,
                }
              : msg
          )
        );

        if (partial.length < fullContent.length) {
          setTimeout(revealNextChunk, INTERVAL_MS);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === loadingMessage.id
                ? {
                    ...msg,
                    content: fullContent,
                    sources: data.sources?.length ? data.sources : undefined,
                    attachments: data.attachments?.length ? data.attachments : undefined,
                    suggestions: suggestions.length > 0 ? suggestions : undefined,
                    isLoading: false,
                  }
                : msg
            )
          );
          resolve();
        }
      };

      setTimeout(revealNextChunk, 50);
    });
  } catch (err) {
    console.error('Chat error:', err);
    setError('Không thể kết nối với AI Agent. Vui lòng thử lại.');
    setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));
  }
}

const SUGGESTED_QUESTIONS: string[] = [
  'Bao nhiêu học sinh vắng hôm nay?',
  'Thống kê vi phạm kỷ luật tháng này?',
  'Quy trình bảo trì CSVC như thế nào?',
  'Quy định sử dụng phòng lab và thư viện?',
  'Tỷ lệ điểm danh theo lớp hôm nay?',
  'Chính sách an toàn PCCC của trường?',
];

/** Modal chọn lý do dislike — dùng BottomSheetModal giống Y tế / Kỷ luật */
function DislikeFeedbackModal({
  visible,
  theme,
  isDarkMode,
  selectedReason,
  detail,
  onChangeReason,
  onChangeDetail,
  onSubmit,
  onClose,
  submitting,
}: {
  visible: boolean;
  theme: (typeof THEME)['light'];
  isDarkMode: boolean;
  selectedReason: string;
  detail: string;
  onChangeReason: (r: string) => void;
  onChangeDetail: (t: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting: boolean;
}) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={85} fillHeight keyboardAvoiding>
      <View style={[styles.dislikeSheetHeader, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
        <Text style={[styles.dislikeSheetTitle, { color: theme.text }]}>Góp ý câu trả lời</Text>
        <Text style={[styles.dislikeSheetHint, { color: theme.textMuted }]}>
          Chọn lý do và ghi chú (tuỳ chọn).
        </Text>
      </View>
      <ScrollView
        style={styles.dislikeReasonScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {AI_CHAT_DISLIKE_REASONS.map((reason) => (
          <TouchableOpacity
            key={reason}
            onPress={() => onChangeReason(reason)}
            style={[
              styles.dislikeReasonRow,
              {
                borderColor: selectedReason === reason
                  ? (isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D5DB')
                  : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                backgroundColor:
                  selectedReason === reason
                    ? isDarkMode
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.03)'
                    : 'transparent',
              },
            ]}
            activeOpacity={0.7}>
            <Ionicons
              name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selectedReason === reason ? theme.text : theme.textMuted}
            />
            <Text style={[styles.dislikeReasonText, { color: theme.textSecondary }]}>{reason}</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={[
            styles.dislikeDetailInput,
            {
              borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
              color: theme.text,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F9FAFB',
            },
          ]}
          placeholder="Ghi chú thêm (tuỳ chọn)"
          placeholderTextColor={theme.inputPlaceholder}
          value={detail}
          onChangeText={onChangeDetail}
          multiline
          maxLength={2000}
        />
      </ScrollView>
      <View style={[styles.dislikeSheetFooter, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.dislikeModalBtnSecondary, { borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : '#E5E7EB' }]}
          disabled={submitting}>
          <Text style={[styles.dislikeModalBtnSecondaryText, { color: theme.textSecondary }]}>
            Huỷ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSubmit}
          style={[styles.dislikeModalBtnPrimary, submitting && styles.dislikeModalBtnDisabled]}
          disabled={submitting || !selectedReason.trim()}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dislikeModalBtnPrimaryText}>Gửi</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

// Component hiển thị tin nhắn
function MessageBubble({
  message,
  theme,
  onSuggestionPress,
  onFeedbackLike,
  onFeedbackDislike,
  feedbackBusyId,
}: {
  message: Message;
  theme: (typeof THEME)['light'];
  onSuggestionPress?: (question: string) => void;
  onFeedbackLike?: () => void;
  onFeedbackDislike?: () => void;
  feedbackBusyId?: string | null;
}) {
  const isUser = message.role === 'user';
  // Màu border bảng: trắng/xám trắng theo theme
  const tableBorderColor = theme.bg === '#000' ? 'rgba(255,255,255,0.35)' : '#D1D5DB';
  const isDarkMarkdown = theme.bg === '#000';
  const markdownStylesTheme = {
    body: { color: theme.text, fontSize: 15, lineHeight: 22 },
    strong: { fontWeight: '600' },
    paragraph: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    // Tiêu đề nhỏ hơn trên mobile — tránh oversize
    heading1: { fontSize: 18, fontWeight: '600' as const, marginBottom: 6, color: theme.text },
    heading2: { fontSize: 16, fontWeight: '600' as const, marginBottom: 6, color: theme.text },
    heading3: { fontSize: 15, fontWeight: '600' as const, marginBottom: 4, color: theme.text },
    code_inline: {
      backgroundColor: theme.codeInline,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      color: theme.text,
      borderColor: isDarkMarkdown ? 'rgba(255,255,255,0.2)' : '#E5E7EB',
    },
    // Trích dẫn / lưu ý (> …): mặc định thư viện nền #F5F5F5 + chữ kế thừa body (trắng ở dark) → khối "trắng" khó đọc
    blockquote: {
      backgroundColor: isDarkMarkdown ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      borderLeftWidth: 4,
      borderLeftColor: isDarkMarkdown ? 'rgba(255,255,255,0.35)' : '#D1D5DB',
      borderColor: isDarkMarkdown ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
      marginVertical: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    // Khối code ``` … ```: cùng vấn đề nền sáng + chữ sáng
    code_block: {
      backgroundColor: theme.codeInline,
      color: theme.text,
      borderColor: isDarkMarkdown ? '#374151' : '#E5E7EB',
      borderWidth: 1,
      padding: 10,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: theme.codeInline,
      color: theme.text,
      borderColor: isDarkMarkdown ? '#374151' : '#E5E7EB',
      borderWidth: 1,
      padding: 10,
      borderRadius: 8,
      marginVertical: 8,
    },
    hr: {
      backgroundColor: isDarkMarkdown ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
      height: 1,
    },
    // Bảng markdown - kẻ border trắng/xám để dễ nhìn
    table: {
      borderWidth: 1,
      borderColor: tableBorderColor,
      borderRadius: 8,
      overflow: 'hidden',
      marginVertical: 8,
    },
    thead: {},
    tbody: {},
    th: {
      flex: 1,
      flexShrink: 0,
      padding: 10,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: tableBorderColor,
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: tableBorderColor,
      flexDirection: 'row',
    },
    td: {
      flex: 1,
      flexShrink: 0,
      padding: 10,
      borderRightWidth: 1,
      borderColor: tableBorderColor,
      color: theme.text,
      fontSize: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };

  // Cột đầu tiên (Chỉ số) căn trái — dùng rules override th/td
  const markdownRules = useMemo(
    () => ({
      th: (node, children, parentNodes, styles) => {
        const parentRow = parentNodes?.find((p) => p?.type === 'tr') || parentNodes?.[0];
        const idx = parentRow?.children?.findIndex((c) => c?.key === node?.key);
        const isFirstCol = idx === 0 || node?.index === 0;
        const cellStyle = [
          styles._VIEW_SAFE_th,
          isFirstCol && { alignItems: 'flex-start', justifyContent: 'flex-start' },
        ];
        return (
          <View key={node.key} style={cellStyle}>
            {children}
          </View>
        );
      },
      td: (node, children, parentNodes, styles) => {
        const parentRow = parentNodes?.find((p) => p?.type === 'tr') || parentNodes?.[0];
        const idx = parentRow?.children?.findIndex((c) => c?.key === node?.key);
        const isFirstCol = idx === 0 || node?.index === 0;
        const cellStyle = [
          styles._VIEW_SAFE_td,
          isFirstCol && { alignItems: 'flex-start', justifyContent: 'flex-start' },
        ];
        return (
          <View key={node.key} style={cellStyle}>
            {children}
          </View>
        );
      },
    }),
    []
  );

  const handleLinkPress = useCallback((url: string) => {
    Linking.openURL(url);
    return false; // Ngăn markdown xử lý mặc định
  }, []);

  const showFeedback =
    !isUser &&
    !message.isLoading &&
    Boolean(message.content) &&
    (onFeedbackLike || onFeedbackDislike);
  const feedbackBusy = feedbackBusyId === message.id;

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      <View
        style={[
          styles.messageBubble,
          isUser ? { backgroundColor: theme.userBubble } : styles.assistantBubble,
        ]}>
        {message.isLoading && !message.content ? (
          <View style={styles.loadingRow}>
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>Đang trả lời</Text>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dot1, { backgroundColor: theme.dot }]} />
              <View style={[styles.dot, styles.dot2, { backgroundColor: theme.dot }]} />
              <View style={[styles.dot, styles.dot3, { backgroundColor: theme.dot }]} />
            </View>
          </View>
        ) : isUser ? (
          <Text style={[styles.userMessageText, { color: theme.text }]}>{message.content}</Text>
        ) : (
          <View style={styles.markdownWrapper}>
            <Markdown
              style={markdownStylesTheme}
              rules={markdownRules}
              onLinkPress={handleLinkPress}>
              {stripEmojiForMobile(message.content || '')}
            </Markdown>
          </View>
        )}
      </View>
      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          <Text style={[styles.attachmentsTitle, { color: theme.textMuted }]}>
            📎 Tài liệu liên quan:
          </Text>
          {message.attachments.map((att, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.attachmentItem,
                { backgroundColor: theme.attachmentBg, borderColor: theme.attachmentBorder },
              ]}
              onPress={() => {
                const url = `${AI_BACKEND_URL.replace('/api/ai', '')}${att.download_url}`;
                Linking.openURL(url);
              }}>
              <Ionicons
                name={att.file_type === 'pdf' ? 'document-text' : 'document'}
                size={20}
                color={theme.textMuted}
              />
              <View style={styles.attachmentInfo}>
                <Text
                  style={[styles.attachmentName, { color: theme.textSecondary }]}
                  numberOfLines={1}>
                  {att.name}
                </Text>
                <Text style={[styles.attachmentType, { color: theme.textMuted }]}>
                  {att.file_type.toUpperCase()}
                </Text>
              </View>
              <Ionicons name="download-outline" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Inline suggestion chips — gợi ý tappable */}
      {!isUser && !message.isLoading && message.suggestions && message.suggestions.length > 0 && (
        <View style={styles.inlineSuggestionsWrap}>
          <Text style={[styles.inlineSuggestionsLabel, { color: theme.textMuted }]}>
            Hỏi thêm:
          </Text>
          {message.suggestions.map((q, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => onSuggestionPress?.(q)}
              activeOpacity={0.7}
              style={[
                styles.inlineSuggestionChip,
                {
                  backgroundColor:
                    theme.bg === '#000' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderColor: theme.suggestionBorder,
                },
              ]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={theme.textMuted}
                style={styles.inlineSuggestionIcon}
              />
              <Text
                style={[styles.inlineSuggestionText, { color: theme.textSecondary }]}
                numberOfLines={2}>
                {q}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Thời gian + like/dislike */}
      {showFeedback && (
        <View style={styles.msgFooterRow}>
          <Text style={[styles.msgFooterTime, { color: theme.textMuted }]}>
            {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.msgFooterFeedback}>
            {(!message.feedback || message.feedback === 'like') && onFeedbackLike && (
              <TouchableOpacity
                onPress={onFeedbackLike}
                disabled={Boolean(message.feedback) || feedbackBusy}
                style={[
                  styles.feedbackHit,
                  message.feedback === 'like' && styles.feedbackHitActiveLike,
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Like">
                <MaterialCommunityIcons
                  name={message.feedback === 'like' ? 'thumb-up' : 'thumb-up-outline'}
                  size={18}
                  color={
                    message.feedback === 'like'
                      ? '#059669'
                      : theme.textMuted
                  }
                />
              </TouchableOpacity>
            )}
            {(!message.feedback || message.feedback === 'dislike') && onFeedbackDislike && (
              <TouchableOpacity
                onPress={onFeedbackDislike}
                disabled={Boolean(message.feedback) || feedbackBusy}
                style={[
                  styles.feedbackHit,
                  message.feedback === 'dislike' && styles.feedbackHitActiveDislike,
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Dislike">
                <MaterialCommunityIcons
                  name={message.feedback === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
                  size={18}
                  color={
                    message.feedback === 'dislike'
                      ? '#e11d48'
                      : theme.textMuted
                  }
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const AIAssistantScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // Chỉ user có role Mobile BOD mới được dùng AI Assistant
  const hasAccess = !!(user?.roles ?? []).includes(REQUIRED_AI_ROLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRole: UserRole = 'wisers';
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const prevMessagesLengthRef = useRef(0);
  const isFollowingResponseRef = useRef(true);
  const [isDarkMode, setIsDarkMode] = useState(() => isNightTime());
  const theme = THEME[isDarkMode ? 'dark' : 'light'];

  // Dark mode tự động: kiểm tra khi mount và khi app quay lại foreground
  useEffect(() => {
    const checkDarkMode = () => setIsDarkMode(isNightTime());
    checkDarkMode();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDarkMode();
    });
    const interval = setInterval(checkDarkMode, 60000); // Kiểm tra mỗi phút
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  // Thanh input + gợi ý hiện từ dưới lên cùng bàn phím (keyboardWillShow để animate đồng bộ)
  // Không dùng scheduleLayoutAnimation khi bàn phím hiện - tránh hiệu ứng slide ngang xấu lúc load lần đầu
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        // Đồng bộ layout animation với animation bàn phím để tắt mượt mà
        if (Platform.OS === 'ios' && Keyboard.scheduleLayoutAnimation) {
          Keyboard.scheduleLayoutAnimation(e as any);
        }
        setKeyboardHeight(0);
      }
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Dialog nhập tên ban đầu
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);
  /** Modal dislike: message đang góp ý */
  const [dislikeMessageId, setDislikeMessageId] = useState<string | null>(null);
  const [dislikeReasonDraft, setDislikeReasonDraft] = useState('');
  const [dislikeDetailDraft, setDislikeDetailDraft] = useState('');
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [dislikeSubmitting, setDislikeSubmitting] = useState(false);

  useEffect(() => {
    const loadName = async () => {
      try {
        const saved = await AsyncStorage.getItem(GUEST_NAME_STORAGE_KEY);
        if (saved?.trim()) {
          setGuestName(saved.trim());
          setNameInput(saved.trim());
        } else if (user?.fullname) {
          setNameInput(user.fullname.split(' ').pop() || user.fullname);
        }
      } catch {
        if (user?.fullname) setNameInput(user.fullname.split(' ').pop() || user.fullname);
      }
      setNameLoaded(true);
    };
    loadName();
  }, [user?.fullname]);

  // Tự động mở bàn phím ngay khi vào trang - chờ animation chuyển màn hình xong rồi focus
  useEffect(() => {
    if (hasAccess && guestName && nameLoaded) {
      const task = InteractionManager.runAfterInteractions(() => {
        inputRef.current?.focus();
      });
      return () => task.cancel();
    }
  }, [hasAccess, guestName, nameLoaded]);

  // Cập nhật trạng thái follow: user gần cuối = đang follow, user cuộn lên = không follow
  const updateFollowState = useCallback(
    (e: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const extraPadding = messages.some((m) => m.attachments?.length) ? 24 : 0;
      const bottomPadding = keyboardHeight + 100 + extraPadding;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y - bottomPadding;
      const canScroll = contentSize.height > layoutMeasurement.height;
      const scrolledUp = canScroll && distanceFromBottom >= 80;
      isFollowingResponseRef.current = distanceFromBottom < 80;
      setIsScrolledUp(scrolledUp);
    },
    [messages, keyboardHeight]
  );

  const wasLoadingRef = useRef(false);

  // Auto-scroll: (1) tin nhắn mới, (2) đang streaming, (3) vừa xong streaming (hiện suggestions/sources)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      isFollowingResponseRef.current = true;
      setIsScrolledUp(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.isLoading && last.role === 'assistant' && isFollowingResponseRef.current) {
        scrollRef.current?.scrollToEnd({ animated: false });
      }
      // Khi response vừa hoàn tất (loading → done): cuộn 1 lần cuối để hiện suggestions/sources/footer
      if (wasLoadingRef.current && !last.isLoading && last.role === 'assistant' && isFollowingResponseRef.current) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      }
      wasLoadingRef.current = !!(last.isLoading && last.role === 'assistant');
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      const conversationHistory = messages
        .filter((m) => !m.isLoading && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      const loadingMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, loadingMessage]);

      try {
        // React Native không hỗ trợ response.body.getReader() - dùng endpoint non-streaming
        if (USE_NON_STREAMING) {
          await sendMessageNonStreaming(
            content.trim(),
            conversationHistory,
            loadingMessage,
            setMessages,
            setIsLoading,
            setError,
            guestName,
            user,
            selectedRole,
            messages.length === 0
          );
          return;
        }

        const response = await fetch(CHAT_STREAM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: content.trim(),
            conversation_history: conversationHistory,
            user_name: guestName || user?.fullname || undefined,
            user: user
              ? {
                  email: user.email,
                  first_name: user.fullname?.split(' ').pop(),
                  last_name: user.fullname?.split(' ').slice(0, -1).join(' '),
                  full_name: user.fullname,
                  user_image: user.avatar,
                  avatar_url: user.avatar,
                  roles: user.roles,
                }
              : null,
            is_new_conversation: messages.length === 0,
            role: selectedRole,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader?.();
        if (!reader) throw new Error('Stream not supported');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let sources: any[] = [];
        let attachments: FormAttachment[] = [];
        const ending = 'Anh/chị cần tôi hỗ trợ thêm điều gì không ạ?';

        const appendSuggestion = (text: string) => {
          if (!text) return;
          const toAppend = `\n\n${ending} ${text}`;
          const escaped = ending.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          accumulatedContent = (
            accumulatedContent.replace(new RegExp(`\\s*${escaped}.*$`), '').trim() + toAppend
          ).trim();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === loadingMessage.id ? { ...msg, content: accumulatedContent } : msg
            )
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = done ? '' : (events.pop() ?? '');

          for (const raw of events) {
            const line = raw.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              const type = data.type as string;

              if (type === 'metadata') {
                sources = (data.sources as any[]) ?? [];
                attachments = (data.attachments as FormAttachment[]) ?? [];
              } else if (type === 'token') {
                const token = (data.token as string) ?? '';
                accumulatedContent += token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === loadingMessage.id ? { ...msg, content: accumulatedContent } : msg
                  )
                );
              } else if (type === 'answer') {
                const answer = (data.answer as string) ?? '';
                accumulatedContent = answer;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === loadingMessage.id ? { ...msg, content: answer } : msg
                  )
                );
              } else if (type === 'suggestion') {
                appendSuggestion((data.text as string) ?? '');
              } else if (type === 'done') {
                const suggestionText = (data.suggestion as string) ?? '';
                if (suggestionText) appendSuggestion(suggestionText);
              } else if (type === 'error') {
                throw new Error((data.message as string) ?? 'Stream error');
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
          if (done) break;
        }

        const { cleanContent: streamClean, suggestions: streamSuggestions } =
          extractSuggestions(accumulatedContent || '');
        const assistantMessage: Message = {
          id: loadingMessage.id,
          role: 'assistant',
          content: streamSuggestions.length > 0 ? streamClean : (accumulatedContent || 'Xin lỗi, tôi chưa thể trả lời.'),
          timestamp: new Date(),
          sources: sources.length > 0 ? sources : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          suggestions: streamSuggestions.length > 0 ? streamSuggestions : undefined,
          isLoading: false,
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === loadingMessage.id ? assistantMessage : msg))
        );
      } catch (err) {
        console.error('Chat error:', err);
        setError('Không thể kết nối với AI Agent. Vui lòng thử lại.');
        setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, user, messages, guestName]
  );

  const handleConfirmName = useCallback(async () => {
    const name = nameInput.trim();
    if (!name) return;
    setGuestName(name);
    try {
      await AsyncStorage.setItem(GUEST_NAME_STORAGE_KEY, name);
    } catch {
      // ignore
    }
  }, [nameInput]);

  /** Gửi like/dislike lên Frappe — đồng bộ với web */
  const submitFeedback = useCallback(
    async (
      messageId: string,
      kind: 'like' | 'dislike',
      dislikeReason?: string,
      dislikeDetail?: string
    ): Promise<boolean> => {
      setFeedbackBusyId(messageId);
      try {
        const idx = messages.findIndex((m) => m.id === messageId);
        if (idx < 0) return false;
        const assistantMsg = messages[idx];
        if (assistantMsg.role !== 'assistant' || !assistantMsg.content) return false;

        let userQuestion = '';
        for (let i = idx - 1; i >= 0; i--) {
          if (messages[i].role === 'user' && messages[i].content) {
            userQuestion = messages[i].content;
            break;
          }
        }

        const agentType = 'WISers';
        const res = await aiChatFeedbackService.submitFeedback({
          message_id: messageId,
          agent_type: agentType,
          feedback_type: kind === 'like' ? 'Like' : 'Dislike',
          user_question: userQuestion,
          ai_answer: assistantMsg.content,
          user_email: user?.email,
          user_name: user?.fullname || guestName || undefined,
          ...(kind === 'dislike' && dislikeReason
            ? { dislike_reason: dislikeReason, dislike_detail: dislikeDetail || '' }
            : {}),
        });

        if (res.success) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, feedback: kind } : m))
          );
          toast.success(kind === 'like' ? 'Cảm ơn bạn đã đánh giá!' : 'Đã ghi nhận phản hồi.');
          return true;
        }
        toast.error(res.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
        return false;
      } finally {
        setFeedbackBusyId(null);
      }
    },
    [messages, user, guestName]
  );

  const handleFeedbackLike = useCallback(
    (messageId: string) => {
      void submitFeedback(messageId, 'like');
    },
    [submitFeedback]
  );

  const openDislikeModal = useCallback((messageId: string) => {
    setDislikeMessageId(messageId);
    setDislikeReasonDraft('');
    setDislikeDetailDraft('');
  }, []);

  const handleDislikeModalSubmit = useCallback(async () => {
    if (!dislikeMessageId || !dislikeReasonDraft.trim()) {
      toast.error('Vui lòng chọn lý do');
      return;
    }
    setDislikeSubmitting(true);
    try {
      const ok = await submitFeedback(
        dislikeMessageId,
        'dislike',
        dislikeReasonDraft,
        dislikeDetailDraft
      );
      if (ok) setDislikeMessageId(null);
    } finally {
      setDislikeSubmitting(false);
    }
  }, [dislikeMessageId, dislikeReasonDraft, dislikeDetailDraft, submitFeedback]);

  if (!nameLoaded) return null;

  return (
    <View
      style={[
        styles.container,
        styles.containerRelative,
        { paddingTop: insets.top, backgroundColor: theme.bg },
      ]}>
      {/* Header: chỉ transparent, zIndex cao hơn nội dung chat */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Trợ lý LIAVI</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setMessages([]);
              setInput('');
              setError(null);
            }}
            style={[styles.newChatButton, { backgroundColor: theme.inputBg }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}>
            <View style={styles.newChatButtonIconWrap}>
              <Ionicons name="create-outline" size={18} color={theme.text} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dialog nhập tên - Modal (chỉ hiện khi có quyền truy cập) */}
      <Modal
        visible={hasAccess && !guestName}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={[styles.nameModalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.nameModalContent, { backgroundColor: theme.modalContent }]}>
            <View style={styles.nameModalHeader}>
              <Ionicons name="person-outline" size={24} color={theme.textMuted} />
              <Text style={[styles.nameModalTitle, { color: theme.text }]}>Xin chào! 👋</Text>
            </View>
            <Text style={[styles.nameModalDesc, { color: theme.textMuted }]}>
              Để tôi có thể hỗ trợ anh/chị tốt hơn và xưng hô đúng cách, vui lòng cho tôi biết tên
              của anh/chị.
            </Text>
            <TextInput
              style={[styles.nameInput, { borderColor: theme.attachmentBorder, color: theme.text }]}
              placeholder="Nhập tên của bạn"
              value={nameInput}
              onChangeText={setNameInput}
              placeholderTextColor={theme.inputPlaceholder}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleConfirmName}
              disabled={!nameInput.trim()}
              style={[styles.confirmButton, !nameInput.trim() && styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>Bắt đầu trò chuyện</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DislikeFeedbackModal
        visible={dislikeMessageId != null}
        theme={theme}
        isDarkMode={isDarkMode}
        selectedReason={dislikeReasonDraft}
        detail={dislikeDetailDraft}
        onChangeReason={setDislikeReasonDraft}
        onChangeDetail={setDislikeDetailDraft}
        onSubmit={handleDislikeModalSubmit}
        onClose={() => !dislikeSubmitting && setDislikeMessageId(null)}
        submitting={dislikeSubmitting}
      />

      {/* Nội dung chat - gradient hòa màu safe area với đoạn chat (theme.bg trên -> trong suốt dưới) */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#000', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']
            : [
                theme.bg,
                'rgba(242,242,242,0.9)',
                'rgba(242,242,242,0.6)',
                'rgba(242,242,242,0.3)',
                'rgba(242,242,242,0)',
              ]
        }
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={[styles.chatContentWrapper, { paddingTop: insets.top }]}>
        <View
          style={[styles.chatContent, (!guestName || !hasAccess) && styles.chatContentBlurred]}
          pointerEvents={!guestName || !hasAccess ? 'none' : 'auto'}>
          {messages.length === 0 ? (
            /* Empty state - Greeting tạm ẩn, suggestions và input dùng chung bên dưới */
            <View style={styles.emptyState}>
              {false && (
                <Text style={[styles.greeting, { color: theme.text }]}>
                  Chào{guestName ? ` ${guestName}` : ''}, tôi có thể giúp gì được bạn?
                </Text>
              )}
            </View>
          ) : (
            /* Có tin nhắn - Danh sách full width + Input luôn trên bàn phím */
            <>
              <View style={styles.messagesScrollWrapper}>
                {/* Dùng View thay vì Pressable để tránh chặn gesture scroll khi có bảng biểu */}
                <View style={styles.messagesScrollPressable}>
                <ScrollView
                  ref={scrollRef}
                  style={styles.messagesScroll}
                  contentContainerStyle={[
                    styles.messagesContent,
                    {
                      paddingBottom:
                        keyboardHeight +
                        120 +
                        (messages.some((m) => m.attachments?.length) ? 24 : 0),
                    },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  scrollEventThrottle={16}
                  onScroll={updateFollowState}
                  onScrollEndDrag={updateFollowState}
                  onMomentumScrollEnd={updateFollowState}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={Platform.OS === 'android'}>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      theme={theme}
                      onSuggestionPress={sendMessage}
                      onFeedbackLike={() => handleFeedbackLike(msg.id)}
                      onFeedbackDislike={() => openDislikeModal(msg.id)}
                      feedbackBusyId={feedbackBusyId}
                    />
                  ))}
                </ScrollView>
                </View>
                {/* Gradient fade ở trên cùng - tin nhắn mờ dần khi cuộn lên */}
                <LinearGradient
                  colors={
                    isDarkMode
                      ? ['#000', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']
                      : [theme.bg, 'rgba(242,242,242,0.8)', 'rgba(242,242,242,0)']
                  }
                  locations={[0, 0.5, 1]}
                  style={styles.chatTopFadeGradient}
                  pointerEvents="none"
                />
              </View>
              {error && (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: theme.errorBg, borderColor: theme.errorBorder },
                  ]}>
                  <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text>
                </View>
              )}
              {/* Nút cuộn xuống - chỉ hiện khi user đã cuộn lên */}
              {isScrolledUp && (
                <TouchableOpacity
                  onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  style={[
                    styles.scrollToBottomButton,
                    {
                      bottom:
                        keyboardHeight + 130 + (keyboardHeight ? 0 : Math.max(insets.bottom, 12)),
                      backgroundColor: theme.text,
                    },
                  ]}
                  activeOpacity={0.8}>
                  <Ionicons name="chevron-down" size={22} color={theme.bg} />
                </TouchableOpacity>
              )}
            </>
          )}
          {/* Câu hỏi gợi ý - hàng ngang, chỉ hiện ban đầu, bên trên ô input */}
          {messages.length === 0 && hasAccess && guestName && (
            <View
              style={[
                styles.suggestionsBar,
                {
                  bottom: keyboardHeight + 115 + (keyboardHeight ? 0 : Math.max(insets.bottom, 12)),
                },
              ]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.suggestionsHorizontal}>
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <TouchableOpacity key={idx} onPress={() => sendMessage(q)} activeOpacity={0.8}>
                    <GlassContainer
                      style={styles.suggestionChip}
                      cornerRadius={999}
                      isDarkMode={isDarkMode}>
                      <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>
                        {q}
                      </Text>
                    </GlassContainer>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Thanh input - luôn hiện khi có quyền và tên (dùng chung cho empty state và có tin nhắn) */}
          {hasAccess && guestName && (
            <View
              style={[
                styles.inputFooter,
                {
                  bottom: keyboardHeight || 0,
                  paddingBottom: keyboardHeight ? 12 : Math.max(insets.bottom, 12),
                  backgroundColor: 'transparent',
                },
              ]}>
              <GlassContainer
                style={styles.inputRow}
                cornerRadius={20}
                isDarkMode={isDarkMode}
                variant="input">
                <View style={styles.inputRowInner}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.input, { color: theme.text }]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Bạn muốn hỏi gì?"
                    placeholderTextColor={theme.inputPlaceholder}
                    cursorColor={theme.text}
                    selectionColor={
                      isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(17, 24, 39, 0.25)'
                    }
                    editable={!isLoading}
                    multiline
                    textAlignVertical="top"
                    onFocus={() =>
                      messages.length > 0 &&
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
                    }
                    onSubmitEditing={() => sendMessage(input)}
                  />
                  <TouchableOpacity
                    onPress={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    style={[
                      styles.sendButton,
                      styles.sendButtonPosition,
                      (!input.trim() || isLoading) && styles.sendButtonDisabled,
                    ]}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </GlassContainer>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Overlay Premium - phủ toàn màn hình (header + content) khi user không có role Mobile BOD */}
      {!hasAccess && (
        <View style={styles.premiumOverlay} pointerEvents="auto">
          <BlurView
            intensity={40}
            tint={isDarkMode ? 'dark' : 'light'}
            {...({ style: StyleSheet.absoluteFill } as any)}
          />
          <View style={[styles.premiumCard, { backgroundColor: theme.modalContent }]}>
            <View
              style={[
                styles.premiumIconWrap,
                {
                  backgroundColor: isDarkMode ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.15)',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(251,191,36,0.4)' : 'rgba(245,158,11,0.35)',
                  ...(Platform.OS === 'ios' && {
                    shadowColor: isDarkMode ? '#FCD34D' : '#D97706',
                  }),
                },
              ]}>
              <Ionicons name="lock-closed" size={44} color={isDarkMode ? '#FCD34D' : '#D97706'} />
            </View>
            <Text style={[styles.premiumTitle, { color: theme.text }]}>
              Tính năng giới hạn{'\n'}
            </Text>
            <Text style={[styles.premiumDesc, { color: theme.textMuted }]}>
              Nâng cấp tài khoản để mở khoá AI Assistant và trải nghiệm trợ lý thông minh.
            </Text>
            <Text style={[styles.premiumCta, { color: theme.textSecondary }]}>
              Liên hệ quản trị viên để nâng cấp
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(ROUTES.SCREENS.MAIN as any, {
                  screen: ROUTES.MAIN.HOME,
                })
              }
              style={[styles.premiumHomeButton, { backgroundColor: theme.text }]}
              activeOpacity={0.8}>
              <Ionicons name="home-outline" size={20} color={theme.bg} />
              <Text style={[styles.premiumHomeButtonText, { color: theme.bg }]}>
                Quay về trang chủ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  containerRelative: {
    position: 'relative',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 34,
  },
  // Nhỏ hơn nút role selector (paddingVertical 8 + icon 18 ≈ 34px), icon căn giữa
  newChatButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  newChatButtonIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  backButton: {
    padding: 4,
  },
  chatContentWrapper: {
    flex: 1,
    position: 'relative',
  },
  chatContent: {
    flex: 1,
  },
  chatContentBlurred: {
    opacity: 0.75,
  },
  // Overlay Premium khi user không có role Mobile BOD - zIndex cao để phủ cả role selector
  premiumOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  premiumCard: {
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  premiumIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumTitleVip: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  premiumDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  premiumCta: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  premiumHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  premiumHomeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  nameModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  nameModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nameModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  nameModalDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
    // Reserve space cho suggestions + input để greeting căn giữa vùng phía trên, không bị đè
    paddingBottom: 200,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputRow: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 96,
  },
  inputRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
    minHeight: 72,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPosition: {
    alignSelf: 'flex-end',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 10000,
    elevation: 10000,
  },
  suggestionsHorizontal: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 0,
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
  },
  messagesScrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  messagesScrollPressable: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  // Gradient fade ở trên cùng - tin nhắn mờ dần khi cuộn lên
  chatTopFadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    zIndex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  messageRow: {
    marginBottom: 10,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#F2F2F2',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 4,
  },
  // flexShrink: 0 để bảng biểu (markdown table) không bị co lại, cho phép ScrollView cuộn đúng
  markdownWrapper: {
    flexShrink: 0,
  },
  userMessageText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  attachmentsContainer: {
    marginTop: 8,
    marginLeft: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  attachmentsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  attachmentType: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  inlineSuggestionsWrap: {
    marginTop: 12,
    alignSelf: 'stretch',
    gap: 8,
  },
  inlineSuggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 2,
  },
  inlineSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineSuggestionIcon: {
    flexShrink: 0,
  },
  inlineSuggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  msgFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    marginBottom: 6,
    gap: 4,
  },
  msgFooterTime: {
    fontSize: 14,
    lineHeight: 18,
    marginRight: 2,
    ...(Platform.OS === 'ios' && { fontVariant: ['tabular-nums'] as unknown as string[] }),
  },
  msgFooterFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  feedbackHitActiveLike: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  feedbackHitActiveDislike: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
  },
  dislikeSheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dislikeSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  dislikeSheetHint: {
    fontSize: 14,
  },
  dislikeReasonScroll: {
    flex: 1,
  },
  dislikeReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  dislikeReasonText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  dislikeDetailInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 72,
    maxHeight: 120,
    marginTop: 8,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  dislikeSheetFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dislikeModalBtnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  dislikeModalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dislikeModalBtnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: '#374151',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dislikeModalBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dislikeModalBtnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
  },
  inputFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 16,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },
});

export default AIAssistantScreen;
