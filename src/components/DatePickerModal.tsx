import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { TouchableOpacity } from './Common';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  maximumDate?: Date;
  minimumDate?: Date;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  value,
  onSelect,
  onClose,
  maximumDate,
  minimumDate,
}) => {
  const [viewDate, setViewDate] = useState(() => new Date(value));

  const today = useMemo(() => new Date(), []);

  // Đồng bộ viewDate khi modal mở
  React.useEffect(() => {
    if (visible) {
      setViewDate(new Date(value));
    }
  }, [visible, value]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Thứ Hai = 0, Chủ Nhật = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: (Date | null)[] = [];

    // Ngày trống đầu tháng
    for (let i = 0; i < startDow; i++) {
      days.push(null);
    }

    // Ngày trong tháng
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    // Padding cuối để tròn tuần
    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [viewDate]);

  const goToPrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleSelectDay = useCallback(
    (date: Date) => {
      onSelect(date);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleGoToday = useCallback(() => {
    onSelect(new Date());
    onClose();
  }, [onSelect, onClose]);

  const isDateDisabled = useCallback(
    (date: Date) => {
      if (maximumDate && date > maximumDate) return true;
      if (minimumDate && date < minimumDate) return true;
      return false;
    },
    [maximumDate, minimumDate]
  );

  // Kiểm tra nút next month có bị disable không
  const isNextMonthDisabled = useMemo(() => {
    if (!maximumDate) return false;
    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    return nextMonth > maximumDate;
  }, [viewDate, maximumDate]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <Pressable className="absolute bottom-0 left-0 right-0 top-0" onPress={onClose} />

        <View className="mx-5 w-[90%] overflow-hidden rounded-2xl bg-white shadow-xl">
          {/* Header tháng/năm */}
          <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
            <TouchableOpacity onPress={goToPrevMonth} className="rounded-full p-2">
              <Ionicons name="chevron-back" size={22} color="#374151" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </Text>
            <TouchableOpacity
              onPress={goToNextMonth}
              disabled={isNextMonthDisabled}
              className="rounded-full p-2"
              style={{ opacity: isNextMonthDisabled ? 0.3 : 1 }}>
              <Ionicons name="chevron-forward" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View className="flex-row border-b border-gray-50 px-2 py-2">
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} className="flex-1 items-center">
                <Text className="text-xs font-semibold text-gray-400">{label}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View className="px-2 py-2">
            {Array.from({ length: calendarDays.length / 7 }).map((_, weekIndex) => (
              <View key={weekIndex} className="flex-row">
                {calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                  if (!day) {
                    return <View key={`empty-${dayIndex}`} className="flex-1 items-center py-1.5" />;
                  }

                  const isSelected = isSameDay(day, value);
                  const isToday = isSameDay(day, today);
                  const disabled = isDateDisabled(day);

                  return (
                    <View key={day.toISOString()} className="flex-1 items-center py-1">
                      <TouchableOpacity
                        onPress={() => handleSelectDay(day)}
                        disabled={disabled}
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={[
                          isSelected && { backgroundColor: '#DC2626' },
                          isToday && !isSelected && { borderWidth: 1.5, borderColor: '#DC2626' },
                          disabled && { opacity: 0.3 },
                        ]}>
                        <Text
                          className="text-sm font-medium"
                          style={[
                            { color: '#374151' },
                            isSelected && { color: '#FFFFFF', fontWeight: '700' },
                            isToday && !isSelected && { color: '#DC2626', fontWeight: '700' },
                            disabled && { color: '#D1D5DB' },
                          ]}>
                          {day.getDate()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-between border-t border-gray-100 px-4 py-3">
            <TouchableOpacity onPress={handleGoToday} className="rounded-lg bg-gray-100 px-4 py-2">
              <Text className="text-sm font-semibold text-gray-700">Hôm nay</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} className="rounded-lg bg-red-600 px-5 py-2">
              <Text className="text-sm font-semibold text-white">Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DatePickerModal;
