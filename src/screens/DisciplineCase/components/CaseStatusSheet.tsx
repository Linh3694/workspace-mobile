/**
 * Sheet "Cập nhật xử lý" của sự vụ kỷ luật — đổi trạng thái + ghi nhận kết quả.
 * Tương đương DisciplineCaseStatusModal của web; chọn trạng thái bằng chip ngay trong
 * sheet, KHÔNG mở modal lồng nhau (trên iOS sẽ treo app).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { TouchableOpacity, BottomSheetModal, SheetHeader } from '../../../components/Common';
import disciplineCaseService, {
  DISCIPLINE_CASE_STATUSES,
  type DisciplineCaseStatus,
} from '../../../services/disciplineCaseService';

export interface CaseStatusSheetProps {
  visible: boolean;
  onClose: () => void;
  caseName: string;
  currentStatus: DisciplineCaseStatus;
  currentNote: string;
  onSaved: () => void;
}

export const CaseStatusSheet: React.FC<CaseStatusSheetProps> = ({
  visible,
  onClose,
  caseName,
  currentStatus,
  currentNote,
  onSaved,
}) => {
  const [status, setStatus] = useState<DisciplineCaseStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** Báo lỗi ngay trong sheet — Alert của iOS hiện đè lên Modal thì người dùng không thấy */
  const [error, setError] = useState('');

  // Mở lại sheet thì lấy đúng trạng thái đang lưu, không giữ lựa chọn dở của lần trước
  useEffect(() => {
    if (!visible) return;
    setStatus(currentStatus);
    setNote('');
    setError('');
  }, [visible, currentStatus]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await disciplineCaseService.update({
        name: caseName,
        status,
        ...(note.trim() ? { resolution_note: note.trim() } : {}),
      });
      if (!res.success) {
        setError(res.message || 'Lưu thất bại');
        return;
      }
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80} keyboardAvoiding>
      <SheetHeader title="Cập nhật xử lý" onClose={onClose} />
      <View className="px-4 pb-2">
        <Text className="mb-2 text-sm font-semibold text-gray-600">Trạng thái</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {DISCIPLINE_CASE_STATUSES.map((s) => {
            const active = status === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s)}
                className={`rounded-full border px-4 py-2 ${
                  active ? 'border-[#002855] bg-[#E8EDF3]' : 'border-gray-200 bg-white'
                }`}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: active ? '#002855' : '#6B7280' }}>
                  {s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="mb-2 mt-5 text-sm font-semibold text-gray-600">Ghi nhận xử lý</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nhập nội dung đã xử lý..."
          multiline
          textAlignVertical="top"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-800"
          style={{ minHeight: 96 }}
        />
        {currentNote ? (
          <Text className="mt-2 text-xs text-gray-500">Đang lưu: {currentNote}</Text>
        ) : null}

        {error ? (
          <View className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="mt-5 items-center rounded-xl bg-[#002855] py-3"
          style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Lưu</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

export default CaseStatusSheet;
