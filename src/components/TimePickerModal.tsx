/**
 * Modal chọn giờ:phút - dùng DateTimePicker native (mode="time")
 * Giá trị: string "HH:mm"
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TouchableOpacity } from './Common';
import { Ionicons } from '@expo/vector-icons';

interface TimePickerModalProps {
  visible: boolean;
  value: string; // "HH:mm" hoặc "HH:mm:ss"
  onSelect: (timeStr: string) => void;
  onClose: () => void;
}

/** Parse "HH:mm" hoặc "HH:mm:ss" thành Date (dùng ngày hôm nay làm base) */
const parseTimeToDate = (timeStr: string | undefined): Date => {
  const now = new Date();
  if (!timeStr || !timeStr.trim()) return now;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return now;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = m[3] ? parseInt(m[3], 10) : 0;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, sec);
};

/** Format Date thành "HH:mm" */
const formatDateToTime = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  value,
  onSelect,
  onClose,
}) => {
  const [pickerDate, setPickerDate] = useState(() => parseTimeToDate(value));

  useEffect(() => {
    if (visible) {
      setPickerDate(parseTimeToDate(value));
    }
  }, [visible, value]);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      onClose();
      if (event.type === 'set' && selectedDate) {
        onSelect(formatDateToTime(selectedDate));
      }
      return;
    }
    if (selectedDate) setPickerDate(selectedDate);
  };

  const handleConfirm = () => {
    onSelect(formatDateToTime(pickerDate));
    onClose();
  };

  // Android: DateTimePicker hiển thị dạng dialog, không cần wrap Modal
  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={pickerDate}
        mode="time"
        display="default"
        onChange={handleChange}
        is24Hour
      />
    );
  }

  // iOS: Hiển thị trong Modal với nút Xác nhận
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

        <View
          style={{
            marginHorizontal: 20,
            width: '90%',
            maxWidth: 340,
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
            padding: 20,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', fontFamily: 'Mulish' }}>
              Chọn thời gian
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display="spinner"
              onChange={handleChange}
              is24Hour
              locale="vi-VN"
              textColor="#1F2937"
            />
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            style={{
              backgroundColor: '#002855',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              marginTop: 8,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Mulish' }}>
              Xác nhận
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default TimePickerModal;
