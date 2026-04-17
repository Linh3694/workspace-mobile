// @ts-nocheck
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../hooks/useLanguage';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import dailyHealthService from '../../services/dailyHealthService';
import { StudentAvatar } from '../../utils/studentAvatar';
import api from '../../utils/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface StudentSearchResult {
  name: string;
  student_name: string;
  student_code?: string;
  class_id?: string;
  class_name?: string;
  user_image?: string;
}

const CreateHealthVisitScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useLanguage();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Search students
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      // Gọi API search students
      const response = await api.get('/method/erp.api.erp_sis.student.search_students', {
        params: { search_term: query.trim(), limit: 20 },
      });

      // API trả về current_class_id, current_class_title, user_image (từ SIS Photo)
      const raw = response.data?.message?.data || response.data?.data || [];
      const data = (Array.isArray(raw) ? raw : []).map((s: any) => ({
        name: s.name,
        student_name: s.student_name,
        student_code: s.student_code,
        class_id: s.current_class_id || s.class_id,
        class_name: s.current_class_title || s.class_title || s.class_name,
        // Ảnh từ SIS Photo (user_image) hoặc fallback photo, student_photo
        user_image: s.user_image || s.photo || s.student_photo || s.avatar_url,
      }));
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching students:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Select student
  const handleSelectStudent = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedStudent(null);
    setReason('');
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedStudent) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn học sinh');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do');
      return;
    }
    // class_id bắt buộc - học sinh phải có lớp trong năm học hiện tại
    const classId = selectedStudent.class_id;
    if (!classId || !classId.trim()) {
      Alert.alert(
        'Thiếu thông tin',
        'Học sinh này chưa được phân lớp trong năm học hiện tại. Không thể tạo lượt khám.',
      );
      return;
    }

    Alert.alert('Xác nhận', `Tạo lượt khám cho ${selectedStudent.student_name}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            setSubmitting(true);
            const result = await dailyHealthService.reportStudentToClinic({
              student_id: selectedStudent.name,
              class_id: classId,
              reason: reason.trim(),
              initial_status: 'at_clinic',
            });

            if (result.success) {
              Alert.alert('Thành công', 'Đã tạo lượt khám', [
                {
                  text: 'OK',
                  onPress: () => {
                    if (result.data?.name) {
                      navigation.replace(ROUTES.SCREENS.HEALTH_EXAM, { visitId: result.data.name });
                    } else {
                      navigation.goBack();
                    }
                  },
                },
              ]);
            } else {
              Alert.alert('Lỗi', result.message || 'Không thể tạo lượt khám');
            }
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể tạo lượt khám');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
          <Ionicons name="arrow-back" size={24} color="#0369A1" />
        </TouchableOpacity>
        <View className="ml-2 flex-1">
          <Text className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Mulish' }}>
            Tạo lượt khám mới
          </Text>
        </View>
      </View>

      <View className="flex-1 p-4">
        {/* Selected student */}
        {selectedStudent ? (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <View className="flex-row items-center">
              <StudentAvatar
                name={selectedStudent.student_name}
                avatarUrl={selectedStudent.user_image}
                size={56}
              />
              <View className="ml-3 flex-1">
                <Text
                  className="text-lg font-semibold text-gray-900"
                  style={{ fontFamily: 'Mulish' }}>
                  {selectedStudent.student_name}
                </Text>
                <Text className="text-sm text-gray-500" style={{ fontFamily: 'Mulish' }}>
                  {selectedStudent.student_code}
                </Text>
                <Text className="text-sm text-gray-500" style={{ fontFamily: 'Mulish' }}>
                  {selectedStudent.class_name || selectedStudent.class_id}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClearSelection} className="p-2">
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Search input */}
            <View className="mb-4">
              <Text
                className="mb-2 text-sm font-medium text-gray-700"
                style={{ fontFamily: 'Mulish' }}>
                Tìm học sinh <Text style={{ color: '#BE123C' }}>*</Text>
              </Text>
              <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2">
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Nhập tên hoặc mã học sinh..."
                  placeholderTextColor="#9CA3AF"
                  className="ml-2 flex-1 text-gray-900"
                  style={{ fontFamily: 'Mulish' }}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color="#0369A1" />}
              </View>
            </View>

            {/* Search results */}
            {searchResults.length > 0 && (
              <View className="mb-4 flex-1">
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectStudent(item)}
                      className="mb-2 rounded-xl border border-gray-100 bg-white p-3">
                      <View className="flex-row items-center">
                        <StudentAvatar
                          name={item.student_name}
                          avatarUrl={item.user_image}
                          size={40}
                        />
                        <View className="ml-3 flex-1">
                          <Text
                            className="text-base font-medium text-gray-900"
                            style={{ fontFamily: 'Mulish' }}>
                            {item.student_name}
                          </Text>
                          <Text className="text-sm text-gray-500" style={{ fontFamily: 'Mulish' }}>
                            {item.student_code} • {item.class_name}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            {/* Empty state */}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <View className="items-center py-8">
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text className="mt-2 text-gray-500" style={{ fontFamily: 'Mulish' }}>
                  Không tìm thấy học sinh
                </Text>
              </View>
            )}
          </>
        )}

        {/* Reason input (only show when student selected) */}
        {selectedStudent && (
          <View className="mb-4">
            <Text
              className="mb-2 text-sm font-medium text-gray-700"
              style={{ fontFamily: 'Mulish' }}>
              Lý do <Text style={{ color: '#BE123C' }}>*</Text>
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Nhập lý do khám (VD: Đau bụng, Sốt, Chóng mặt...)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="min-h-[100] rounded-xl border border-gray-200 bg-white p-3 text-gray-900"
              style={{ textAlignVertical: 'top', fontFamily: 'Mulish' }}
            />
          </View>
        )}

        {/* Submit button */}
        {selectedStudent && (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-row items-center justify-center rounded-xl py-4"
            style={{
              backgroundColor: submitting || !reason.trim() ? '#E5E7EB' : '#F0F9FF',
              borderWidth: submitting || !reason.trim() ? 0 : 1,
              borderColor: submitting || !reason.trim() ? 'transparent' : '#BAE6FD',
            }}>
            {submitting ? (
              <ActivityIndicator size="small" color="#0369A1" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#0369A1" />
                <Text
                  className="ml-2 font-semibold"
                  style={{ fontFamily: 'Mulish', color: '#0369A1' }}>
                  Tạo lượt khám
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default CreateHealthVisitScreen;
