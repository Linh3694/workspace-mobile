import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../hooks/useLanguage';
import timetableService, { TeacherClass } from '../../services/timetableService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import DatePickerModal from '../../components/DatePickerModal';
import PorridgeTab from './components/PorridgeTab';
import HealthExamTab from './components/HealthExamTab';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'porridge' | 'health_exam';

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TeacherHealthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homeroomClasses, setHomeroomClasses] = useState<TeacherClass[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('porridge');

  // Class selection
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Track initial load
  const initialLoadDone = useRef(false);

  // Load classes on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload when focused
  useFocusEffect(
    useCallback(() => {
      if (initialLoadDone.current && selectedClassId) {
        // Trigger refresh in child tabs
      }
    }, [selectedClassId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await timetableService.getTeacherClasses();

      if (data) {
        // Chỉ lấy lớp chủ nhiệm
        const classes = data.homeroom_classes || [];
        setHomeroomClasses(classes);

        if (classes.length > 0 && !selectedClassId) {
          setSelectedClassId(classes[0].name);
        }
      }
    } catch (error) {
      console.error('Error loading teacher classes:', error);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get selected class info
  const selectedClass = homeroomClasses.find((c) => c.name === selectedClassId);

  // Date display
  const dateStr = formatDate(selectedDate);
  const isToday = dateStr === formatDate(new Date());

  // Render loading
  if (loading && !initialLoadDone.current) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: insets.top,
          }}>
          <ActivityIndicator size="large" color="#002855" />
          <Text style={{ marginTop: 16, color: '#666' }}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  // Render empty state
  if (homeroomClasses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <Text className="mr-10 flex-1 text-center text-xl font-bold text-[#002855]">
            {t('teacher_health.title') || 'Sức khoẻ'}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="medical-services" size={64} color="#ccc" />
          <Text className="mt-4 text-center text-lg font-medium text-gray-500">
            Bạn không có lớp chủ nhiệm nào
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <Text className="mr-10 flex-1 text-center text-xl font-bold text-[#002855]">
          {t('teacher_health.title') || 'Sức khoẻ'}
        </Text>
      </View>

      {/* Class Selector - Badge */}
      <View className="mb-3 items-center">
        <TouchableOpacity
          onPress={() => setShowClassPicker(true)}
          activeOpacity={0.7}
          className="flex-row items-center rounded-full bg-[#E5EAF0] px-4 py-2">
          <Text className="text-base font-semibold text-[#002855]" numberOfLines={1}>
            {selectedClass?.title || 'Chọn lớp'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#002855" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View className="mb-3 px-4">
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={20} color="#002855" />
            <Text className={`ml-2 text-base font-semibold ${isToday ? 'text-[#F05023]' : 'text-[#002855]'}`}>
              {isToday ? 'Hôm nay' : `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View className="mb-2 flex-row border-b border-gray-200 px-4">
        <TouchableOpacity
          onPress={() => setActiveTab('porridge')}
          className={`flex-1 items-center border-b-2 py-3 ${
            activeTab === 'porridge' ? 'border-[#002855]' : 'border-transparent'
          }`}>
          <Text
            className={`text-base font-semibold ${
              activeTab === 'porridge' ? 'text-[#002855]' : 'text-gray-500'
            }`}>
            {t('teacher_health.porridge_tab') || 'Báo cháo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('health_exam')}
          className={`flex-1 items-center border-b-2 py-3 ${
            activeTab === 'health_exam' ? 'border-[#002855]' : 'border-transparent'
          }`}>
          <Text
            className={`text-base font-semibold ${
              activeTab === 'health_exam' ? 'text-[#002855]' : 'text-gray-500'
            }`}>
            {t('teacher_health.health_exam_tab') || 'Sức khoẻ'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {selectedClassId && (
        <View style={{ flex: 1 }}>
          {activeTab === 'porridge' ? (
            <PorridgeTab
              classId={selectedClassId}
              date={dateStr}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : (
            <HealthExamTab
              classId={selectedClassId}
              date={dateStr}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          )}
        </View>
      )}

      {/* Class Picker Modal */}
      <BottomSheetModal
        visible={showClassPicker}
        onClose={() => setShowClassPicker(false)}>
        <View className="border-b border-gray-100 px-5 py-4">
          <Text className="text-lg font-bold text-[#002855]">Chọn lớp</Text>
        </View>
        <ScrollView className="max-h-80">
          {homeroomClasses.map((cls) => {
            const isSelected = cls.name === selectedClassId;
            return (
              <TouchableOpacity
                key={cls.name}
                onPress={() => {
                  setSelectedClassId(cls.name);
                  setShowClassPicker(false);
                }}
                activeOpacity={0.7}
                className={`flex-row items-center border-b border-gray-50 px-5 py-4 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}>
                <View className="flex-1">
                  <Text
                    className={`text-base ${
                      isSelected ? 'font-bold text-[#002855]' : 'text-gray-800'
                    }`}>
                    {cls.title}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={24} color="#002855" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        onSelect={(date) => setSelectedDate(date)}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
};

export default TeacherHealthScreen;
