/**
 * Bottom sheet GVCN/phó tạo bình chọn cho nhóm lớp.
 *
 * Cấu hình ngang bản web (CreatePollModal.tsx của frappe-sis-frontend): câu hỏi · 2..10 phương án ·
 * chọn một/nhiều · ẩn danh · thời hạn (mốc nhanh HOẶC ngày giờ tùy ý) · nhắc trước 10 phút.
 * Giao diện giữ ngôn ngữ của app mobile (checkbox, chip, nút full-width) — không bê UI web sang.
 *
 * Header/footer cố định, chỉ phần giữa cuộn để nút tạo luôn với tới được.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import DatePickerModal from '../../../components/DatePickerModal';
import TimePickerModal from '../../../components/TimePickerModal';
import { useLanguage } from '../../../hooks/useLanguage';
import type { CreateChatPollPayload } from '../../../types/chat';
import { MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const ACCENT = MY_MESSAGE_BUBBLE_BG;
const ACCENT_SOFT = 'rgba(13,148,136,0.08)';
/** Nhắc trước hạn bao nhiêu phút khi bật tùy chọn. */
const REMIND_BEFORE_MINUTES = 10;

type DeadlineMode = 'none' | '1d' | '3d' | '7d' | 'custom';

const DEADLINE_PRESET_HOURS: Record<Exclude<DeadlineMode, 'none' | 'custom'>, number> = {
  '1d': 24,
  '3d': 72,
  '7d': 168,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Giá trị khởi tạo cho TimePickerModal ("HH:mm"). */
function formatTimeValue(d: Date | null): string {
  if (!d) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Hàng checkbox + mô tả — giữ đúng kiểu checkbox của app, không đổi sang switch. */
function CheckboxRow({
  label,
  description,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onToggle}
      style={{ opacity: disabled ? 0.45 : 1 }}
      className="mt-5 flex-row items-start gap-2.5"
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? ACCENT : '#9CA3AF'}
      />
      <View className="flex-1">
        <Text className="font-mulish-bold text-sm text-gray-900">{label}</Text>
        <Text className="mt-0.5 font-mulish-medium text-[11px] leading-4 text-gray-500">
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export function CreatePollSheet({
  visible,
  submitting,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  submitting?: boolean;
  onSubmit: (payload: CreateChatPollPayload) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>('none');
  const [customAt, setCustomAt] = useState<Date | null>(null);
  const [remind, setRemind] = useState(false);
  /** Chọn ngày trước rồi tới giờ — hai modal nối tiếp nhau. */
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  /** iOS: chọn ngày xong rồi, đang đợi modal lịch đóng hẳn mới mở được modal giờ. */
  const waitingForTimeRef = useRef(false);

  // Mở lại luôn là form trắng — tránh sót dữ liệu của lần tạo trước.
  useEffect(() => {
    if (!visible) return;
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setAnonymous(false);
    setDeadlineMode('none');
    setCustomAt(null);
    setRemind(false);
    setDatePickerOpen(false);
    setTimePickerOpen(false);
    setDraftDate(null);
    waitingForTimeRef.current = false;
  }, [visible]);

  const cleanedOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of options) {
      const text = raw.trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }, [options]);

  /** Mốc "custom" chỉ tính là có hạn khi đã chọn xong ngày giờ. */
  const hasDeadline = deadlineMode !== 'none' && (deadlineMode !== 'custom' || customAt != null);
  const customInPast =
    deadlineMode === 'custom' && customAt != null && customAt.getTime() <= Date.now();

  const canSubmit =
    Boolean(question.trim()) &&
    cleanedOptions.length >= MIN_OPTIONS &&
    !customInPast &&
    !submitting;

  const setOption = (index: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));

  const addOption = () => setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, '']));

  const removeOption = (index: number) =>
    setOptions((prev) => (prev.length <= MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index)));

  const resolveClosesAt = (): string | null => {
    if (deadlineMode === 'none') return null;
    if (deadlineMode === 'custom') return customAt ? customAt.toISOString() : null;
    return new Date(Date.now() + DEADLINE_PRESET_HOURS[deadlineMode] * 60 * 60 * 1000).toISOString();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      question: question.trim(),
      options: cleanedOptions,
      allowMultiple,
      anonymous,
      closesAt: resolveClosesAt(),
      // Bỏ hạn thì bỏ luôn nhắc — backend cũng từ chối nhắc khi không có hạn.
      remindBeforeMinutes: hasDeadline && remind ? REMIND_BEFORE_MINUTES : null,
    });
  };

  /**
   * Ngày xong → mở tiếp chọn giờ; ghép lại thành mốc đầy đủ.
   * iOS: bật modal giờ ngay ở đây là present trong lúc modal lịch còn đang dismiss — iOS bỏ qua lệnh
   * present, để lại lớp phủ vô hình nuốt hết touch (app như treo). Phải đợi onDismiss của lịch.
   * Android xếp chồng Dialog thoải mái nên mở thẳng.
   */
  const handlePickDate = (date: Date) => {
    setDraftDate(date);
    setDatePickerOpen(false);
    if (Platform.OS === 'ios') {
      waitingForTimeRef.current = true;
    } else {
      setTimePickerOpen(true);
    }
  };

  const handleDatePickerDismissed = () => {
    if (!waitingForTimeRef.current) return;
    waitingForTimeRef.current = false;
    setTimePickerOpen(true);
  };

  const handlePickTime = (timeStr: string) => {
    const base = draftDate ?? new Date();
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
    const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h || 0, m || 0, 0, 0);
    setCustomAt(at);
    setDeadlineMode('custom');
    setTimePickerOpen(false);
    setDraftDate(null);
  };

  const deadlineChips: { mode: DeadlineMode; label: string }[] = [
    { mode: 'none', label: t('exchange.poll_deadline_none') },
    { mode: '1d', label: t('exchange.poll_deadline_1d') },
    { mode: '3d', label: t('exchange.poll_deadline_3d') },
    { mode: '7d', label: t('exchange.poll_deadline_7d') },
  ];

  const customActive = deadlineMode === 'custom';

  return (
    <>
      {/* Không dùng fillHeight: sheet co theo nội dung, chỉ chạm trần 60% mới cuộn. */}
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        maxHeightPercent={60}
        keyboardAvoiding
      >
        {/*
          flexShrink phải có ở ĐÂY nữa: RN mặc định flexShrink=0 (khác web), thiếu nó thì khối này
          giữ nguyên chiều cao tự nhiên, tràn khỏi trần 60% và nuốt mất footer.
        */}
        <View style={{ flexShrink: 1 }}>
          {/* Header cố định */}
          <SheetHeader
            icon="stats-chart-outline"
            iconColor={ACCENT}
            title={t('exchange.poll_create_title')}
            closeLabel={t('common.close')}
            onClose={onClose}
          />

          {/* Thân cuộn */}
          {/* flexShrink thay vì flex-1: vừa nội dung thì cao bằng nội dung, quá trần thì co lại và cuộn. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            className="px-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-1.5 font-mulish-bold text-sm text-gray-700">
              {t('exchange.poll_question_label')}
            </Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              maxLength={500}
              placeholder={t('exchange.poll_question_placeholder')}
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mulish-medium text-base text-gray-900"
            />

            <Text className="mb-1.5 mt-5 font-mulish-bold text-sm text-gray-700">
              {t('exchange.poll_options_label')}
            </Text>
            <View className="gap-2">
              {options.map((option, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <TextInput
                    value={option}
                    onChangeText={(v) => setOption(index, v)}
                    maxLength={200}
                    placeholder={t('exchange.poll_option_placeholder', { index: index + 1 })}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mulish-medium text-base text-gray-900"
                  />
                  <Pressable
                    disabled={options.length <= MIN_OPTIONS}
                    onPress={() => removeOption(index)}
                    hitSlop={6}
                    style={{ opacity: options.length <= MIN_OPTIONS ? 0.3 : 1 }}
                  >
                    <Ionicons name="close-circle-outline" size={22} color="#6B7280" />
                  </Pressable>
                </View>
              ))}
            </View>
            {options.length < MAX_OPTIONS ? (
              <Pressable onPress={addOption} className="mt-2.5 flex-row items-center gap-1.5">
                <Ionicons name="add-circle-outline" size={16} color={ACCENT} />
                <Text style={{ color: ACCENT }} className="font-mulish-bold text-sm">
                  {t('exchange.poll_add_option')}
                </Text>
              </Pressable>
            ) : null}

            <Text className="mb-1.5 mt-5 font-mulish-bold text-sm text-gray-700">
              {t('exchange.poll_choice_mode_label')}
            </Text>
            <View className="flex-row gap-2">
              {[false, true].map((multi) => {
                const active = allowMultiple === multi;
                return (
                  <Pressable
                    key={String(multi)}
                    onPress={() => setAllowMultiple(multi)}
                    style={{
                      borderColor: active ? ACCENT : '#E5E7EB',
                      backgroundColor: active ? ACCENT_SOFT : '#FFFFFF',
                    }}
                    className="flex-1 items-center rounded-xl border py-2.5"
                  >
                    <Text
                      style={{ color: active ? ACCENT : '#374151' }}
                      className="font-mulish-bold text-sm"
                    >
                      {multi
                        ? t('exchange.poll_choice_multiple')
                        : t('exchange.poll_choice_single')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <CheckboxRow
              label={t('exchange.poll_anonymous_label')}
              description={t('exchange.poll_anonymous_help')}
              value={anonymous}
              onToggle={() => setAnonymous((v) => !v)}
            />

            <Text className="mb-1.5 mt-5 font-mulish-bold text-sm text-gray-700">
              {t('exchange.poll_deadline_label')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {deadlineChips.map((chip) => {
                const active = deadlineMode === chip.mode;
                return (
                  <Pressable
                    key={chip.mode}
                    onPress={() => {
                      setDeadlineMode(chip.mode);
                      setCustomAt(null);
                    }}
                    style={{
                      borderColor: active ? ACCENT : '#E5E7EB',
                      backgroundColor: active ? ACCENT_SOFT : '#FFFFFF',
                    }}
                    className="rounded-full border px-3.5 py-2"
                  >
                    <Text
                      style={{ color: active ? ACCENT : '#374151' }}
                      className="font-mulish-bold text-[13px]"
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Mốc tùy ý — phần cấu hình web có mà mobile đang thiếu */}
            <Pressable
              onPress={() => {
                setDraftDate(customAt ?? new Date());
                setDatePickerOpen(true);
              }}
              style={{
                borderColor: customActive ? ACCENT : '#E5E7EB',
                backgroundColor: customActive ? ACCENT_SOFT : '#FFFFFF',
              }}
              className="mt-2 flex-row items-center gap-2 rounded-xl border px-3 py-2.5"
            >
              <Ionicons name="calendar-outline" size={17} color={customActive ? ACCENT : '#6B7280'} />
              <Text
                style={{ color: customActive ? ACCENT : '#374151' }}
                className="flex-1 font-mulish-bold text-sm"
              >
                {customActive && customAt
                  ? formatDateTime(customAt)
                  : t('exchange.poll_deadline_custom')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            {customInPast ? (
              <Text className="mt-1.5 font-mulish-medium text-[11px] text-red-500">
                {t('exchange.poll_deadline_past')}
              </Text>
            ) : null}

            <CheckboxRow
              label={t('exchange.poll_remind_label')}
              description={t('exchange.poll_remind_help')}
              value={remind && hasDeadline}
              disabled={!hasDeadline}
              onToggle={() => setRemind((v) => !v)}
            />

            <View className="h-5" />
          </ScrollView>

          {/* Nút tạo ghim đáy — không nằm trong ScrollView nên luôn thấy; gạch mảnh phía trên
              để lúc nội dung cuộn qua dưới nó vẫn tách bạch. */}
          <View
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' }}
            className="px-4 pb-1 pt-3"
          >
            <Pressable
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={{ backgroundColor: canSubmit ? ACCENT : '#D1D5DB' }}
              className="flex-row items-center justify-center gap-2 rounded-xl py-3"
            >
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text className="font-mulish-bold text-base text-white">
                {t('exchange.poll_create_submit')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/*
          Phải nằm TRONG bottom sheet. Trên iOS mỗi Modal là một UIViewController, present từ VC gần
          nhất: để ngoài thì hai picker cùng present từ VC gốc — mà VC gốc đang bận present chính
          bottom sheet → iOS từ chối, picker không hiện và lớp phủ chết nuốt hết touch. Nằm trong thì
          chúng present từ VC của sheet nên xếp chồng đúng. (Android Modal là Dialog nên kiểu nào
          cũng chạy — vì vậy bug chỉ thấy ở iOS.)
        */}
        <DatePickerModal
          visible={datePickerOpen}
          value={draftDate ?? new Date()}
          minimumDate={new Date()}
          onSelect={handlePickDate}
          onClose={() => setDatePickerOpen(false)}
          onDismiss={handleDatePickerDismissed}
        />
        <TimePickerModal
          visible={timePickerOpen}
          value={formatTimeValue(draftDate ?? customAt)}
          onSelect={handlePickTime}
          onClose={() => setTimePickerOpen(false)}
        />
      </BottomSheetModal>
    </>
  );
}

export default CreatePollSheet;
