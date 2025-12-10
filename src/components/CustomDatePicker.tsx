import React, { useState } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface CustomDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

// ============= iOS: Use Native Spinner Picker =============
const IOSDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  minimumDate,
  maximumDate,
}) => {
  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View className="w-full items-center">
      <DateTimePicker
        value={value}
        mode="date"
        display="spinner"
        onChange={handleChange}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        locale="vi-VN"
        textColor="#000000"
        style={{ height: 180, width: '100%' }}
      />
    </View>
  );
};

// ============= Android: Native Calendar Dialog =============
const AndroidDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  minimumDate,
  maximumDate,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = days[date.getDay()];
    return `${dayName}, ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  return (
    <View className="w-full">
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5"
        activeOpacity={0.7}>
        <View className="flex-row items-center">
          <View className="mr-3 rounded-lg bg-black p-2">
            <Ionicons name="calendar-outline" size={18} color="white" />
          </View>
          <Text className="text-base font-medium text-gray-900">{formatDate(value)}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="calendar"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

// ============= Main Component =============
const CustomDatePicker: React.FC<CustomDatePickerProps> = (props) => {
  if (Platform.OS === 'ios') {
    return <IOSDatePicker {...props} />;
  }
  return <AndroidDatePicker {...props} />;
};

export default CustomDatePicker;
