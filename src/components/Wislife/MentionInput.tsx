import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInput,
} from 'react-native';
import {
  Suggestion,
  SuggestionsProvidedProps,
  Triggers,
  replaceTriggerValues,
  useMentions,
} from 'react-native-controlled-mentions';
import { TouchableOpacity } from '../Common';
import { postService } from '../../services/postService';
import { getAvatar } from '../../utils/avatar';

// Kiểu dữ liệu cho user được mention
export interface MentionUser {
  _id: string;
  fullname: string;
  email: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
}

// Extended suggestion với thông tin user
interface MentionSuggestion extends Suggestion {
  _id: string;
  fullname: string;
  email: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
}

interface MentionInputProps {
  // Required props
  value: string;
  onChangeText: (text: string) => void;
  // Optional mention props
  onMentionsChange?: (mentionedUsers: MentionUser[]) => void;
  containerStyle?: StyleProp<ViewStyle>;
  suggestionsContainerStyle?: StyleProp<ViewStyle>;
  suggestionsAbove?: boolean;
  // TextInput props
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  autoFocus?: boolean;
  inputRef?: React.Ref<any>;
  inputOffsetY?: number;
  className?: string;
  style?: StyleProp<TextStyle>;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChangeText,
  onMentionsChange,
  containerStyle,
  suggestionsContainerStyle,
  suggestionsAbove = false,
  // TextInput props
  placeholder,
  placeholderTextColor,
  multiline,
  textAlignVertical,
  autoFocus,
  inputRef,
  inputOffsetY = 0,
  className,
  style,
}) => {
  // State để lưu danh sách users gợi ý
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  // State loading khi search
  const [loading, setLoading] = useState(false);
  // Track các users đã được mention trong text
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  // Current trigger props từ thư viện
  const [triggerProps, setTriggerProps] = useState<SuggestionsProvidedProps | null>(null);
  
  // Ref để lưu timeout của debounce
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search function với debounce
  const searchUsers = useCallback(async (keyword: string) => {
    // Clear timeout cũ
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (keyword.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Debounce 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await postService.searchUsersForMention(keyword, 8);
        // Convert sang format của thư viện
        const formattedSuggestions: MentionSuggestion[] = results.map((user: MentionUser) => ({
          id: user._id,
          name: user.fullname,
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          avatarUrl: user.avatarUrl,
          department: user.department,
          jobTitle: user.jobTitle,
        }));
        setSuggestions(formattedSuggestions);
      } catch (error) {
        console.error('[MentionInput] Search error:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  // Trigger search khi keyword thay đổi
  useEffect(() => {
    const keyword = triggerProps?.keyword;
    if (keyword !== undefined) {
      searchUsers(keyword);
    } else {
      setSuggestions([]);
      setLoading(false);
    }
    
    // Cleanup timeout khi unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [triggerProps?.keyword, searchUsers]);

  // Handle triggers change từ thư viện - memoize để tránh re-render
  const handleTriggersChange = useCallback((triggers: Triggers<'mention'>) => {
    setTriggerProps(triggers.mention);
  }, []);
  
  // Memoize triggersConfig để tránh re-render
  const triggersConfig = useMemo(() => ({
    mention: {
      trigger: '@',
      allowedSpacesCount: 2, // Cho phép tên có 2 space (VD: "Nguyễn Văn A")
      isInsertSpaceAfterMention: true,
      textStyle: {
        color: '#FF7A00', // Màu cam cho mention
        fontWeight: '600' as const,
      },
    },
  }), []);

  const { triggers, textInputProps } = useMentions({
    value,
    onChange: onChangeText,
    triggersConfig,
  });

  useEffect(() => {
    handleTriggersChange(triggers);
  }, [triggers, handleTriggersChange]);
  
  // Memoize input style — style từ màn cha merge sau để không bị đè fontSize/minHeight
  const inputStyle = useMemo(
    () => [
      {
        backgroundColor: 'transparent',
        color: '#1F2937',
        fontSize: 16,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
      },
      style,
    ],
    [style]
  );

  /**
   * Dùng style đã merge (mặc định + màn cha) để ô overlay placeholder trùng padding với TextInput.
   * Trên Android, Text có includeFontPadding mặc định còn TextInput có includeFontPadding: false —
   * nếu không đồng bộ thì cụt cursor lên trên, chữ hint tụt xuống dưới.
   */
  const mergedInputFlat = StyleSheet.flatten(inputStyle) as TextStyle;
  const resolvedTextAlignVertical =
    multiline ? textAlignVertical || 'top' : textAlignVertical || 'center';
  const overlayTextAlignVertical =
    multiline && resolvedTextAlignVertical === 'center' ? 'top' : resolvedTextAlignVertical;
  const fallbackPadVertical =
    multiline && overlayTextAlignVertical !== 'bottom'
      ? overlayTextAlignVertical === 'center'
        ? 0
        : 12
      : 0;
  const overlayPadTop =
    typeof mergedInputFlat.paddingTop === 'number'
      ? mergedInputFlat.paddingTop
      : typeof mergedInputFlat.paddingVertical === 'number'
        ? mergedInputFlat.paddingVertical
        : fallbackPadVertical;
  const overlayPadBottom =
    typeof mergedInputFlat.paddingBottom === 'number'
      ? mergedInputFlat.paddingBottom
      : typeof mergedInputFlat.paddingVertical === 'number'
        ? mergedInputFlat.paddingVertical
        : fallbackPadVertical;
  const overlayPadLeft =
    typeof mergedInputFlat.paddingLeft === 'number'
      ? mergedInputFlat.paddingLeft
      : typeof mergedInputFlat.paddingHorizontal === 'number'
        ? mergedInputFlat.paddingHorizontal
        : 0;
  const overlayPadRight =
    typeof mergedInputFlat.paddingRight === 'number'
      ? mergedInputFlat.paddingRight
      : typeof mergedInputFlat.paddingHorizontal === 'number'
        ? mergedInputFlat.paddingHorizontal
        : 0;
  const overlayJustifyContent =
    overlayTextAlignVertical === 'center'
      ? 'center'
      : overlayTextAlignVertical === 'bottom'
        ? 'flex-end'
        : 'flex-start';
  const placeholderFontSize =
    typeof mergedInputFlat.fontSize === 'number' ? mergedInputFlat.fontSize : 16;
  const placeholderLineHeight =
    typeof mergedInputFlat.lineHeight === 'number' ? mergedInputFlat.lineHeight : undefined;
  const inputOffsetStyle =
    inputOffsetY && typeof overlayPadTop === 'number'
      ? {
          paddingTop: overlayPadTop + inputOffsetY,
          paddingBottom:
            typeof overlayPadBottom === 'number'
              ? Math.max(0, overlayPadBottom - inputOffsetY)
              : overlayPadBottom,
        }
      : {};

  // Handle chọn suggestion
  const handleSelectSuggestion = (suggestion: MentionSuggestion) => {
    if (triggerProps?.onSelect) {
      triggerProps.onSelect(suggestion);
      
      // Track user đã mention
      const user: MentionUser = {
        _id: suggestion._id,
        fullname: suggestion.fullname,
        email: suggestion.email,
        avatarUrl: suggestion.avatarUrl,
        department: suggestion.department,
        jobTitle: suggestion.jobTitle,
      };
      const updatedMentions = [...mentionedUsers];
      if (!updatedMentions.find((u) => u._id === user._id)) {
        updatedMentions.push(user);
        setMentionedUsers(updatedMentions);
        onMentionsChange?.(updatedMentions);
      }
      
      // Clear suggestions
      setSuggestions([]);
      setTriggerProps(null);
    }
  };

  // Render suggestions dropdown
  const renderSuggestions = () => {
    // Chỉ hiển thị khi có keyword (đang gõ @...)
    if (triggerProps?.keyword === undefined) {
      return null;
    }

    return (
      <View
        className={`absolute left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 z-50 ${
          suggestionsAbove ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
        style={[
          {
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
          },
          suggestionsContainerStyle,
        ]}
      >
        {loading ? (
          <View className="py-4 items-center justify-center">
            <ActivityIndicator size="small" color="#FF7A00" />
            <Text className="text-sm text-gray-500 mt-2">Đang tìm kiếm...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          triggerProps.keyword && triggerProps.keyword.length > 0 ? (
            <View className="py-4 items-center justify-center">
              <Text className="text-sm text-gray-500">Không tìm thấy kết quả</Text>
            </View>
          ) : null
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 240 }}
            nestedScrollEnabled={true}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item._id}
                className="flex-row items-center px-3 py-2 border-b border-gray-100"
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                  <Image
                    source={{ uri: getAvatar(item) }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                    {item.fullname}
                  </Text>
                  {(item.jobTitle || item.department) && (
                    <Text className="text-sm text-gray-500" numberOfLines={1}>
                      {item.jobTitle || item.department}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={[{ position: 'relative' }, containerStyle]}>
      {/* Suggestions phía trên nếu suggestionsAbove = true */}
      {suggestionsAbove && renderSuggestions()}
      
      {/* Khung chứa input + placeholder — áp className min-h/min-w từ màn compose */}
      <View className={className} style={{ position: 'relative' }}>
        {/* Custom placeholder vì thư viện có thể không hỗ trợ */}
        {!value && placeholder && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              paddingTop: overlayPadTop,
              paddingBottom: overlayPadBottom,
              paddingLeft: overlayPadLeft,
              paddingRight: overlayPadRight,
              justifyContent: overlayJustifyContent,
              alignItems: 'flex-start',
            }}>
            <Text
              pointerEvents="none"
              style={{
                fontSize: placeholderFontSize,
                ...(placeholderLineHeight != null ? { lineHeight: placeholderLineHeight } : {}),
                color: placeholderTextColor || '#9CA3AF',
                ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
              }}>
              {placeholder}
            </Text>
          </View>
        )}

        {/* zIndex để luôn nhận tap trước lớp placeholder (một số máy/Android) */}
        <TextInput
          ref={inputRef}
          {...textInputProps}
          multiline={multiline}
          autoFocus={autoFocus}
          textAlignVertical={resolvedTextAlignVertical}
          underlineColorAndroid="transparent"
          style={[
            ...(Array.isArray(inputStyle) ? inputStyle : [inputStyle]),
            { zIndex: 1 },
            // Dịch riêng baseline của TextInput thật, placeholder overlay vẫn giữ nguyên.
            inputOffsetStyle,
            Platform.OS === 'android' ? { elevation: 2 } : {},
          ]}
        />
      </View>
      
      {/* Suggestions phía dưới nếu suggestionsAbove = false */}
      {!suggestionsAbove && renderSuggestions()}
    </View>
  );
};

export default MentionInput;

// Export helper để lấy mention IDs từ text
export const extractMentionIds = (text: string, mentionedUsers: MentionUser[]): string[] => {
  const ids: string[] = [];
  
  // Regex để tìm tất cả mentions trong text với format của thư viện
  // Format: @[name](id) hoặc {@}[name](id)
  const mentionRegex = /(?:\{@\}|\@)\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionId = match[2]; // ID trong ngoặc ()
    if (!ids.includes(mentionId)) {
      ids.push(mentionId);
    }
  }
  
  // Fallback: check mentionedUsers nếu regex không match
  if (ids.length === 0) {
    mentionedUsers.forEach((user) => {
      if (text.includes(`@${user.fullname}`)) {
        ids.push(user._id);
      }
    });
  }
  
  return ids;
};

// Helper để lấy plain text từ mention format
// Thư viện có thể lưu dạng @[name](id) hoặc {@}[name](id), convert về dạng @name
export const getMentionPlainText = (text: string): string => {
  // Thử dùng hàm của thư viện trước
  try {
    const result = replaceTriggerValues(text, ({ name }) => `@${name}`);
    // Nếu không thay đổi gì, có thể format khác - dùng regex fallback
    if (result === text && text.includes('[') && text.includes('](')) {
      // Format {@}[name](id) hoặc @[name](id)
      return text.replace(/(?:\{@\}|\@)\[([^\]]+)\]\([^)]+\)/g, '@$1');
    }
    return result;
  } catch {
    // Fallback: dùng regex để convert
    return text.replace(/(?:\{@\}|\@)\[([^\]]+)\]\([^)]+\)/g, '@$1');
  }
};

/**
 * Hiển thị nội dung post/comment đã lưu với @mention in đậm + màu cam (#F97316),
 * cùng cách tách token như parent-portal JournalDetailScreen (không bắt buộc chữ hoa đầu từ).
 */
export const MentionRichText: React.FC<{
  content: string;
  /** Class cho Text bọc ngoài (cỡ chữ, màu nền chữ) */
  className?: string;
  /** Class cho span @mention */
  mentionClassName?: string;
}> = ({
  content,
  className = 'text-base leading-5 text-gray-800',
  mentionClassName = 'font-bold text-[#F97316]',
}) => {
  const normalized = getMentionPlainText(content);
  const parts = normalized.split(/(@[^\s@]+(?:\s+[^\s@]+){0,2})/g);
  return (
    <Text className={className}>
      {parts.map((part, index) =>
        part.startsWith('@') && part.trim().length > 1 ? (
          <Text key={`m-${index}`} className={mentionClassName}>
            {part.trim()}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
};
