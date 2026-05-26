/**
 * Bottom sheet GV chọn phụ huynh (Người liên hệ chính) để bắt đầu chat 1-1.
 *
 * - Hiển thị danh sách rows `(guardian, student)` lọc `student.key_person = 1`.
 * - Một PH có nhiều con cùng lớp → mỗi con là 1 row riêng (search dễ hơn).
 *   Tap row nào của cùng PH cũng mở cùng 1 conversation 1-1 (`teacher_guardian:tid:gid`).
 * - Search theo tên HS + tên PH (loại dấu tiếng Việt).
 * - Vỏ sheet: `BottomSheetModal` chung (animation + keyboard).
 */
// @ts-nocheck
import React, { useMemo, useState } from 'react';
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

import { resolveChatAttachmentUrl } from '../../../services/chatService';
import type { ClassChatScopeGuardian, ClassChatScopeStudent } from '../../../types/chat';

const ROW_AVATAR = 48;

export type GuardianStudentRow = {
  key: string;
  guardianId: string;
  guardianName: string;
  guardianAvatarUrl?: string;
  studentId: string;
  studentName: string;
  /** Chuỗi đã loại dấu tiếng Việt — chỉ dùng cho search nhanh. */
  searchHay: string;
};

type Props = {
  visible: boolean;
  loading?: boolean;
  guardians: ClassChatScopeGuardian[];
  students: ClassChatScopeStudent[];
  openingGuardianId?: string | null;
  onSelect: (row: GuardianStudentRow) => void;
  onClose: () => void;
};

const stripDiacritics = (str: string): string =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

export function NewConversationSheet({
  visible,
  loading = false,
  guardians,
  students,
  openingGuardianId,
  onSelect,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');

  const rows = useMemo<GuardianStudentRow[]>(() => {
    const studentNameById = new Map<string, string>();
    students.forEach((s) => {
      if (s.student_id) {
        studentNameById.set(s.student_id, s.student_name || s.student_id);
      }
    });

    const out: GuardianStudentRow[] = [];
    guardians.forEach((g) => {
      const gid = String(g.guardian_id || g.name || '').trim();
      if (!gid) return;
      const gname = g.guardian_name || g.name || gid;
      const gavatar = g.guardian_image || '';
      (g.students || []).forEach((s) => {
        // Chỉ lấy Người liên hệ chính.
        if (!s?.key_person) return;
        const sid = String(s.student_id || '').trim();
        if (!sid) return;
        const sname = studentNameById.get(sid) || s.student_name || sid;
        out.push({
          key: `${gid}::${sid}`,
          guardianId: gid,
          guardianName: gname,
          guardianAvatarUrl: gavatar,
          studentId: sid,
          studentName: sname,
          searchHay: `${stripDiacritics(gname)} ${stripDiacritics(sname)}`,
        });
      });
    });

    out.sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
    return out;
  }, [guardians, students]);

  const filteredRows = useMemo(() => {
    const q = stripDiacritics(search);
    if (!q) return rows;
    return rows.filter((r) => r.searchHay.includes(q));
  }, [rows, search]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeightPercent={78}
      fillHeight
      keyboardAvoiding>
      <View style={{ flex: 1, minHeight: 0 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 8,
          }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text
              style={{
                fontFamily: 'Mulish-Bold',
                fontSize: 16,
                color: '#0A2240',
              }}>
              Tạo cuộc trò chuyện mới
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            borderRadius: 999,
            paddingHorizontal: 12,
            height: 40,
          }}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên học sinh hoặc phụ huynh"
            placeholderTextColor="#9CA3AF"
            style={{
              marginLeft: 8,
              flex: 1,
              fontSize: 14,
              color: '#111827',
              paddingVertical: 0,
            }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color="#FF7A00" />
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={{ paddingHorizontal: 24, paddingVertical: 36, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={44} color="#D1D5DB" />
            <Text
              style={{
                marginTop: 10,
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
              }}>
              {rows.length === 0 ? 'Chưa có người liên hệ chính nào.' : 'Không có kết quả phù hợp.'}
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={filteredRows}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 }} />
            )}
            renderItem={({ item }) => {
              const avatar = resolveChatAttachmentUrl(item.guardianAvatarUrl || '');
              const busy = openingGuardianId === item.guardianId;
              return (
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    opacity: busy ? 0.6 : 1,
                  }}>
                  <View style={{ marginRight: 12 }}>
                    {avatar ? (
                      <Image
                        source={{ uri: avatar }}
                        style={{
                          width: ROW_AVATAR,
                          height: ROW_AVATAR,
                          borderRadius: ROW_AVATAR / 2,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: ROW_AVATAR,
                          height: ROW_AVATAR,
                          borderRadius: ROW_AVATAR / 2,
                          backgroundColor: '#E5E7EB',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Ionicons name="person" size={22} color="#9CA3AF" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: 'Mulish-Bold',
                        fontSize: 14,
                        color: '#0A2240',
                      }}>
                      {item.guardianName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ marginTop: 2, fontSize: 12, color: '#6B7280' }}>
                      Phụ huynh của {item.studentName}
                    </Text>
                  </View>
                  {busy ? (
                    <ActivityIndicator size="small" color="#FF7A00" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </BottomSheetModal>
  );
}
