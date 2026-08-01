/**
 * Bottom sheet GV chọn phụ huynh để mở chat 1-1 — bản KHÔNG giới hạn một lớp.
 *
 * Khác {@link NewConversationSheet} (chỉ dùng khi vào Trao đổi từ một lớp cụ thể, dựng row từ
 * `getClassChatScope`): sheet này dựng danh sách từ CÁC NHÓM LỚP mà chính GV là thành viên, nên
 * mở được từ hộp thư gộp. Đây đúng phạm vi "PH của học sinh mình dạy" và không cần API mới.
 *
 * Code twin của `NewParentChatModal.tsx` bên GV web — sửa thì sửa cả hai.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import { chatService, resolveChatAttachmentUrl } from '../../../services/chatService';
import { formatChatDisplayName } from '../exchangeChatThreadUtils';
import { resolveCallerTeacherId } from '../exchangeInfoUtils';

const ROW_AVATAR = 48;

export type ParentChatCandidate = {
  key: string;
  guardianId: string;
  name: string;
  avatarUrl?: string;
  /** Con của PH này trong lớp đó — để phân biệt hai PH trùng tên. */
  studentNames: string[];
  className: string;
  classId: string;
  schoolYearId: string;
  teacherId: string;
  /** Chuỗi đã loại dấu — chỉ dùng cho search nhanh. */
  searchHay: string;
};

const stripDiacritics = (str: string): string =>
  (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

/** PH trong các nhóm lớp GV là thành viên; bỏ người đã rời lớp (`removedAt`). */
function buildCandidates(
  conversations: Awaited<ReturnType<typeof chatService.getConversations>>,
  viewerEmail?: string,
): ParentChatCandidate[] {
  const out: ParentChatCandidate[] = [];
  const seen = new Set<string>();

  for (const conversation of conversations) {
    if (conversation.type !== 'class_general') continue;
    const teacherId = resolveCallerTeacherId(conversation, viewerEmail);
    if (!teacherId || !conversation.classId || !conversation.schoolYearId) continue;

    for (const guardian of (conversation.guardians || []).filter((g) => !g?.removedAt)) {
      const guardianId = String(guardian.guardianId || '').trim();
      if (!guardianId) continue;
      // Một PH có con ở nhiều lớp ⇒ mỗi lớp một dòng (chat 1-1 gắn theo lớp).
      const key = `${conversation.classId}:${guardianId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const name = formatChatDisplayName(guardian.name || guardian.email || '');
      const className = conversation.className || '';
      const studentNames = (guardian.studentNames || [])
        .map((s) => String(s || '').trim())
        .filter(Boolean);

      out.push({
        key,
        guardianId,
        name,
        avatarUrl: guardian.avatarUrl,
        studentNames,
        className,
        classId: conversation.classId,
        schoolYearId: conversation.schoolYearId,
        teacherId,
        searchHay: stripDiacritics(`${name} ${className} ${studentNames.join(' ')}`),
      });
    }
  }

  return out.sort(
    (a, b) =>
      a.className.localeCompare(b.className, 'vi') || a.name.localeCompare(b.name, 'vi'),
  );
}

export function NewParentChatSheet({
  visible,
  viewerEmail,
  openingGuardianId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  viewerEmail?: string;
  openingGuardianId?: string | null;
  onSelect: (candidate: ParentChatCandidate) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [candidates, setCandidates] = useState<ParentChatCandidate[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    // Không truyền page/limit ⇒ backend trả full list, không sót lớp ngoài trang đầu (SIS-166).
    //
    // `scope: 'member'` là bắt buộc: ứng viên chỉ dựng được từ nhóm lớp mà chính người dùng là GV
    // (xem `resolveCallerTeacherId`), trong khi BOD mặc định được backend trả TOÀN TRƯỜNG — tức
    // tải về hàng nghìn nhóm kèm roster rồi loại sạch ở vòng lặp dưới. `fields: 'list'` cắt nốt
    // phần roster không dùng tới (SĐT, quan hệ HS↔PH, môn dạy).
    chatService
      .getConversationsPage({ filter: 'group', scope: 'member', fields: 'list' })
      .then((res) => {
        if (cancelled) return;
        setCandidates(buildCandidates(res.items, viewerEmail));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('[Exchange] NewParentChatSheet load:', e);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, viewerEmail]);

  const shown = useMemo(() => {
    const needle = stripDiacritics(query);
    if (!needle) return candidates;
    return candidates.filter((c) => c.searchHay.includes(needle));
  }, [candidates, query]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeightPercent={78}
      fillHeight
      keyboardAvoiding>
      <View style={{ flex: 1, minHeight: 0 }}>
      <SheetHeader
        icon="chatbubble-ellipses-outline"
        iconColor="#FF7A00"
        title="Chat riêng với phụ huynh"
        closeLabel="Đóng"
        onClose={onClose}
      />

      <View className="px-4 pb-2">
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: '#F1F3F5', height: 44 }}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm phụ huynh, học sinh, lớp…"
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-base text-[#0A2240]"
            style={{ paddingVertical: 0 }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#FF7A00" />
        </View>
      ) : loadError ? (
        <Text className="py-10 text-center text-sm text-gray-400">
          Chưa tải được danh sách phụ huynh.
        </Text>
      ) : shown.length === 0 ? (
        <Text className="py-10 text-center text-sm text-gray-400">
          {candidates.length === 0
            ? 'Chưa có phụ huynh nào trong các lớp bạn dạy.'
            : 'Không tìm thấy phụ huynh phù hợp.'}
        </Text>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const uri = item.avatarUrl ? resolveChatAttachmentUrl(item.avatarUrl) : '';
            const busy = openingGuardianId === item.guardianId;
            return (
              <TouchableOpacity
                onPress={() => onSelect(item)}
                disabled={!!openingGuardianId}
                className="flex-row items-center py-2.5"
                style={{ opacity: openingGuardianId && !busy ? 0.5 : 1 }}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={{
                      width: ROW_AVATAR,
                      height: ROW_AVATAR,
                      borderRadius: ROW_AVATAR / 2,
                      backgroundColor: '#E5E7EB',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: ROW_AVATAR,
                      height: ROW_AVATAR,
                      borderRadius: ROW_AVATAR / 2,
                      backgroundColor: '#7C3AED',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text className="text-base font-bold text-white">
                      {(item.name || '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="ml-3 min-w-0 flex-1">
                  <Text className="text-base font-semibold text-[#0A2240]" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
                    {[item.className, item.studentNames.join(', ')].filter(Boolean).join(' • ')}
                  </Text>
                </View>
                {busy ? <ActivityIndicator color="#FF7A00" /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
      </View>
    </BottomSheetModal>
  );
}

export default NewParentChatSheet;
