import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTicket,
  getTicketCategories,
  type TicketCategory,
} from '../../services/ticketService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { MAX_IMAGES_UPLOAD } from '../../config/ticketConstants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

// Định nghĩa kiểu dữ liệu cho hình ảnh
interface ImageItem {
  uri: string;
  type?: string;
  name?: string;
}

// Component hiển thị các bước
const ProgressIndicator = ({ step }: { step: number }) => {
  return (
    <View className="my-6 flex-row items-center justify-center">
      {/* Bước 1: Chọn hạng mục */}
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 1 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 1 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
        <View className={`h-0.5 w-12 ${step > 1 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>

      {/* Bước 2: Nhập thông tin */}
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 2 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 2 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
        <View className={`h-0.5 w-12 ${step > 2 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>

      {/* Bước 3: Xác nhận & Tạo */}
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 3 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 3 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
      </View>
    </View>
  );
};

const TicketCreate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [ticketCreatedId, setTicketCreatedId] = useState('');
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);

  const actionSheetRef = useRef<ActionSheetRef>(null);

  const [ticketData, setTicketData] = useState({
    title: '',
    category: '',
    description: '',
    images: [] as ImageItem[],
    notes: '',
    priority: 'Medium',
  });

  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const storedUserName = await AsyncStorage.getItem('userFullname');
        const storedUserId = await AsyncStorage.getItem('userId');
        setUserName(normalizeVietnameseName(storedUserName || 'WISer'));
        setUserId(storedUserId || '');
      } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
      }
    };

    const loadCategories = async () => {
      try {
        const categories = await getTicketCategories();
        setTicketCategories(categories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    getUserInfo();
    loadCategories();
  }, []);

  const handleGoBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  const handleContinue = () => {
    if (step === 1 && !ticketData.category) {
      Alert.alert('Thông báo', 'Vui lòng chọn hạng mục');
      return;
    }

    if (step === 2 && (!ticketData.title || !ticketData.description)) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (step === 3) {
      // Validate before submit
      if (!ticketData.title.trim() || ticketData.title.trim().length < 5) {
        Alert.alert('Thông báo', 'Tiêu đề phải có ít nhất 5 ký tự');
        return;
      }
      if (!ticketData.description.trim() || ticketData.description.trim().length < 10) {
        Alert.alert('Thông báo', 'Mô tả chi tiết phải có ít nhất 10 ký tự');
        return;
      }
      if (!ticketData.category) {
        Alert.alert('Thông báo', 'Vui lòng chọn hạng mục');
        return;
      }
      submitTicket();
    } else {
      setStep(step + 1);
    }
  };

  const submitTicket = async () => {
    try {
      setLoading(true);

      // Lấy userId từ thông tin đã lưu
      const creatorId = userId; // sử dụng userId từ state đã được set từ AsyncStorage

      if (!creatorId) {
        Alert.alert('Thông báo', 'Không thể xác định thông tin người dùng');
        setLoading(false);
        return;
      }

      // Prepare file data for React Native
      const files = ticketData.images.map((image) => {
        // Lấy tên file từ URI
        const uriParts = image.uri.split('/');
        const fileName = uriParts[uriParts.length - 1];

        // Phân tích phần mở rộng để xác định loại file
        const fileNameParts = fileName.split('.');
        const fileExtension = fileNameParts[fileNameParts.length - 1];
        const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

        return {
          uri: image.uri,
          name: fileName,
          type: mimeType,
        };
      });

      console.log('Creating ticket with data:', {
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        category: ticketData.category,
        notes: ticketData.notes || '',
        files: files.length,
      });

      // Create ticket using ticketService
      const createdTicket = await createTicket({
        title: ticketData.title,
        description: ticketData.description,
        category: ticketData.category,
        notes: ticketData.notes || '',
        priority: ticketData.priority,
        files: files.length > 0 ? files : undefined,
      });

      console.log('Ticket created successfully:', createdTicket);

      if (createdTicket && createdTicket.ticketCode) {
        setTicketCreatedId(createdTicket.ticketCode);
        setStep(5);
      } else {
        console.error('Ticket được tạo nhưng không có mã ticket');
        Alert.alert('Thông báo', 'Ticket đã được tạo nhưng không có mã ticket');
      }
    } catch (error: any) {
      console.error('Lỗi khi tạo ticket:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Không thể tạo ticket, vui lòng thử lại sau';

      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepOne = () => {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="mb-2 w-[80%] text-center font-bold text-xl text-gray-800">
          Xin chào WISer <Text className="text-[#FF5733]">{userName}</Text>, bạn cần chúng tớ{' '}
          <Text className="font-bold text-[#002147]">hỗ trợ</Text> gì ạ? ^^
        </Text>

        <View className="my-10 w-full px-4">
          <Text className="mb-4 text-center font-semibold text-base text-[#002147]">
            Chọn hạng mục hỗ trợ <Text className="text-red-500">*</Text>
          </Text>

          <View className="space-y-3">
            {ticketCategories.map((category) => (
              <TouchableOpacity
                key={category.value}
                className={`mb-2 rounded-xl border-2 p-4 ${
                  ticketData.category === category.value
                    ? 'border-[#FF5733] bg-[#FFF5F3]'
                    : 'border-gray-200 bg-white'
                }`}
                onPress={() => {
                  setTicketData((prev) => ({ ...prev, category: category.value }));
                }}>
                <Text
                  className={`font-medium text-base ${
                    ticketData.category === category.value ? 'text-[#FF5733]' : 'text-gray-800'
                  }`}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderStepTwo = () => {
    return (
      <View className="w-full">
        <View className="mb-5">
          <Text className="mb-1.5 font-semibold text-base text-[#002147]">
            Tiêu đề <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="mb-1 mt-2 rounded-xl border border-gray-200 p-3"
            placeholder="Nhập tiêu đề ticket..."
            value={ticketData.title}
            onChangeText={(text) => setTicketData((prev) => ({ ...prev, title: text }))}
            maxLength={100}
          />
          <Text className="mt-1 text-xs text-[#757575]">
            Ngắn gọn, tối thiểu 5 ký tự, tối đa 100 ký tự ({ticketData.title?.length || 0}/100)
          </Text>
        </View>

        <View className="mb-5">
          <Text className="mb-1.5 font-semibold text-base text-[#002147]">
            Mô tả chi tiết <Text className="text-red-500">*</Text>
          </Text>
          <View className="relative">
            <TextInput
              className="mb-1 mt-2 min-h-[120px] rounded-xl border border-gray-200 p-3"
              placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
              multiline={true}
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
              value={ticketData.description}
              onChangeText={(text) => setTicketData((prev) => ({ ...prev, description: text }))}
            />
            <Text className="absolute bottom-4 right-3 text-xs text-gray-400">
              {ticketData.description?.length || 0}/1000
            </Text>
          </View>
          <Text className="mt-1 text-xs text-[#757575]">Tối thiểu 10 ký tự</Text>
        </View>
      </View>
    );
  };

  const pickFromCamera = async () => {
    try {
      setLoading(true);

      // Đóng action sheet trước khi mở camera
      actionSheetRef.current?.setModalVisible(false);

      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Không có quyền truy cập camera');
        setLoading(false);
        return;
      }

      // Kiểm tra số lượng ảnh hiện tại
      const currentCount = ticketData.images.length;
      if (currentCount >= MAX_IMAGES_UPLOAD) {
        Alert.alert('Thông báo', `Bạn chỉ được tải lên tối đa ${MAX_IMAGES_UPLOAD} ảnh`);
        setLoading(false);
        return;
      }

      setTimeout(async () => {
        try {
          // Launch camera
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const newImage = { uri: result.assets[0].uri };
            setTicketData((prev) => ({
              ...prev,
              images: [...prev.images, newImage],
            }));
          }
        } catch (error) {
          console.error('Lỗi khi chụp ảnh:', error);
          Alert.alert('Thông báo', 'Có lỗi xảy ra khi chụp ảnh, vui lòng thử lại');
        } finally {
          setLoading(false);
        }
      }, 500);
    } catch (error) {
      console.error('Lỗi khi chụp ảnh:', error);
      Alert.alert('Thông báo', 'Có lỗi xảy ra khi chụp ảnh, vui lòng thử lại');
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      setLoading(true);

      // Đóng action sheet trước khi mở thư viện ảnh
      actionSheetRef.current?.setModalVisible(false);

      // Request media library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Không có quyền truy cập thư viện ảnh');
        setLoading(false);
        return;
      }

      setTimeout(async () => {
        try {
          // Launch image library picker
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.5, // Giảm chất lượng để tránh lỗi bộ nhớ
            selectionLimit: MAX_IMAGES_UPLOAD,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            // Giới hạn số lượng ảnh có thể thêm
            const currentCount = ticketData.images.length;
            const remainingSlots = MAX_IMAGES_UPLOAD - currentCount;

            if (remainingSlots <= 0) {
              Alert.alert('Thông báo', `Bạn chỉ được tải lên tối đa ${MAX_IMAGES_UPLOAD} ảnh`);
              setLoading(false);
              return;
            }

            const newImages = result.assets
              .slice(0, remainingSlots)
              .map((asset) => ({ uri: asset.uri }));

            setTicketData((prev) => ({
              ...prev,
              images: [...prev.images, ...newImages],
            }));
          }
        } catch (innerError) {
          console.error('Lỗi khi chọn ảnh:', innerError);
          Alert.alert('Thông báo', 'Có lỗi xảy ra khi chọn ảnh, vui lòng thử lại');
        } finally {
          setLoading(false);
        }
      }, 500);
    } catch (error) {
      console.error('Lỗi khi chọn ảnh:', error);
      Alert.alert('Thông báo', 'Có lỗi xảy ra khi chọn ảnh, vui lòng thử lại');
      setLoading(false);
    }
  };

  const renderStepThree = () => {
    return (
      <View className="w-full">
        {/* Notes section */}
        <View className="mb-5">
          <Text className="mb-1.5 font-semibold text-base text-[#002147]">Ghi chú</Text>
          <TextInput
            className="min-h-[120px] rounded-xl border border-gray-200 bg-gray-50 p-3"
            placeholder="Ghi chú thêm (không bắt buộc)..."
            multiline={true}
            numberOfLines={5}
            textAlignVertical="top"
            value={ticketData.notes}
            onChangeText={(text) => setTicketData((prev) => ({ ...prev, notes: text }))}
          />
        </View>

        {/* File upload section */}
        <View className="mb-5">
          <Text className="mb-3 font-semibold text-base text-[#002147]">File đính kèm</Text>
          <TouchableOpacity
            className="mb-4 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6"
            onPress={() => actionSheetRef.current?.setModalVisible(true)}>
            <Ionicons name="cloud-upload-outline" size={40} color="#999" />
            <Text className="mt-3 text-base text-gray-600">Chọn ảnh từ thiết bị</Text>
          </TouchableOpacity>

          <View className="mb-5 flex-row justify-between">
            <Text className="text-xs italic text-gray-500">Định dạng hỗ trợ: png, jpg, jpeg</Text>
            <Text className="text-xs italic text-gray-500">Dung lượng tối đa: 10MB</Text>
          </View>

          {ticketData.images.length > 0 && (
            <View className="mt-5">
              <Text className="mb-2.5 font-bold text-base text-[#002147]">Ảnh đã tải lên</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-5 flex-row">
                {ticketData.images.map((image, index) => (
                  <View key={index} className="relative mr-2.5 h-[100px] w-[100px]">
                    <Image source={{ uri: image.uri }} className="h-full w-full rounded-lg" />
                    <TouchableOpacity
                      className="absolute right-1 top-1 h-[22px] w-[22px] items-center justify-center rounded-full bg-black bg-opacity-60"
                      onPress={() => {
                        setTicketData((prev) => ({
                          ...prev,
                          images: prev.images.filter((_, i) => i !== index),
                        }));
                      }}>
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderStepFive = () => {
    return (
      <View className="mt-10 flex h-full items-center justify-center p-5">
        <Image source={require('../../assets/final.png')} className="mb-5 h-[220px] w-[158px]" />
        <Text className="mb-3 font-bold text-2xl text-gray-800">Cám ơn WISer {userName}!</Text>
        <Text className="mb-6 text-center text-base text-gray-600">
          Yêu cầu của bạn đã được ghi nhận, chúng tôi sẽ xử lý trong thời gian sớm nhất.
        </Text>
        {ticketCreatedId && (
          <View className="mb-6 w-[60%] items-center rounded-xl bg-[#E6EEF6] p-4">
            <Text className="mb-1 text-base text-[#002147]">Mã Ticket của bạn:</Text>
            <Text className="font-bold text-xl text-[#FF5733]">{ticketCreatedId}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* Loading overlay */}
      {loading && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-white bg-opacity-80">
          <ActivityIndicator size="large" color="#FF5733" />
          <Text className="mt-2.5 text-base text-gray-700">Đang xử lý...</Text>
        </View>
      )}

      {/* Main content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="h-full flex-1">
        <ScrollView
          className="mt-4 h-full flex-1"
          contentContainerStyle={{ paddingBottom: 40, padding: 16 }}>
          {/* Hiển thị title cho step 2-3 */}
          {step > 1 && step < 4 && (
            <>
              {step === 2 && (
                <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
                  Nhập thông tin chi tiết
                </Text>
              )}
              {step === 3 && (
                <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
                  Xác nhận và tạo ticket
                </Text>
              )}

              {/* Indicator luôn hiển thị ở dưới title */}
              <ProgressIndicator step={step} />
            </>
          )}

          {/* Step Content */}
          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}
          {step === 5 && renderStepFive()}
        </ScrollView>
        {/* Navigation buttons */}
        <View className="absolute bottom-[2%] left-4 right-4 items-center gap-3">
          {step < 4 && (
            <>
              <TouchableOpacity
                className={`w-full rounded-full bg-[#FF5733] px-6 py-2.5 ${
                  (step === 1 && !ticketData.category) ||
                  (step === 2 && (!ticketData.title || !ticketData.description))
                    ? 'opacity-50'
                    : 'opacity-100'
                }`}
                onPress={handleContinue}>
                <Text className="text-center font-bold text-lg text-white">
                  {step === 3 ? 'Tạo ticket' : 'Tiếp tục'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-full rounded-full bg-gray-200 px-5 py-2.5"
                onPress={handleGoBack}>
                <Text className="text-center font-semibold text-lg text-[#757575]">Quay lại</Text>
              </TouchableOpacity>
            </>
          )}
          {step === 5 && (
            <TouchableOpacity
              className="w-full rounded-full bg-[#FF5733] px-6 py-2.5"
              onPress={() => navigation.goBack()}>
              <Text className="text-center font-bold text-lg text-white">Quay về trang chính</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* ActionSheet for image selection */}
        <ActionSheet ref={actionSheetRef} containerStyle={{ padding: 16 }}>
          <TouchableOpacity
            className="flex-row items-center border-b border-gray-100 px-8 py-4"
            onPress={() => {
              pickFromCamera();
              actionSheetRef.current?.setModalVisible(false);
            }}>
            <Ionicons name="camera-outline" size={28} color="#FF5733" />
            <Text className="ml-4 text-base text-[#333]">Chụp ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center border-b border-gray-100 px-8 py-4"
            onPress={() => {
              pickFromLibrary();
              actionSheetRef.current?.setModalVisible(false);
            }}>
            <Ionicons name="images-outline" size={28} color="#FF5733" />
            <Text className="ml-4 text-base text-[#333]">Chọn từ thư viện</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="m-6 rounded-full bg-gray-100 py-4"
            onPress={() => actionSheetRef.current?.setModalVisible(false)}>
            <Text className="text-center font-semibold text-[#666]">Hủy</Text>
          </TouchableOpacity>
        </ActionSheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TicketCreate;
