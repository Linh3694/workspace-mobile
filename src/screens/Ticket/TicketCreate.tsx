import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import {View,Text,TouchableOpacity,ScrollView,TextInput,Image,Platform,KeyboardAvoidingView,ActivityIndicator,SafeAreaView,Alert,Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { API_BASE_URL, TICKET_PRIORITIES, MAX_IMAGES_UPLOAD } from '../../config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      {/* Bước 1 */}
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
        <View className={`h-0.5 w-10 ${step > 1 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>

      {/* Bước 2 */}
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
        <View className={`h-0.5 w-10 ${step > 2 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>

      {/* Bước 3 */}
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
        <View className={`h-0.5 w-10 ${step > 3 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>

      {/* Bước 4 */}
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 4 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 4 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
      </View>
    </View>
  );
};

// Định nghĩa kiểu dữ liệu cho option
interface OptionItem {
  type: string;
  label: string;
  image: any;
  description: string;
}

const TicketCreate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [ticketCreatedId, setTicketCreatedId] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // const [modalVisible, setModalVisible] = useState(false);

  const actionSheetRef = useRef<ActionSheetRef>(null);

  const [ticketData, setTicketData] = useState({
    type: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    images: [] as ImageItem[],
    notes: '',
    priority: 'Medium',
  });

  // State cho DatePicker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const storedUserName = await AsyncStorage.getItem('userFullname');
        const storedUserId = await AsyncStorage.getItem('userId');
        setUserName(storedUserName || 'WISer');
        setUserId(storedUserId || '');
      } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
      }
    };

    getUserInfo();
  }, []);

  const handleGoBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  const handleContinue = () => {
    if (step === 1 && !ticketData.type) {
      Alert.alert('Thông báo', 'Vui lòng chọn loại hỗ trợ');
      return;
    }

    if (step === 2 && (!ticketData.title || !ticketData.description)) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (step === 4) {
      submitTicket();
    } else {
      setStep(step + 1);
    }
  };

  const submitTicket = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Thông báo', 'Bạn cần đăng nhập để tạo ticket');
        setLoading(false);
        return;
      }

      // Tạo form data để gửi lên server
      const formData = new FormData();

      // Lấy userId từ thông tin đã lưu
      const creatorId = userId; // sử dụng userId từ state đã được set từ AsyncStorage

      if (!creatorId) {
        Alert.alert('Thông báo', 'Không thể xác định thông tin người dùng');
        setLoading(false);
        return;
      }

      formData.append('title', ticketData.title);
      formData.append('description', ticketData.description);
      formData.append('notes', ticketData.notes || '');
      formData.append('priority', ticketData.priority);
      formData.append('creator', creatorId);
      formData.append('type', ticketData.type);

      if (ticketData.startDate) formData.append('startDate', ticketData.startDate);
      if (ticketData.endDate) formData.append('endDate', ticketData.endDate);

      console.log('Form data đang gửi:', {
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        type: ticketData.type,
        creator: creatorId,
        imageCount: ticketData.images.length,
      });

      // Thêm ảnh vào form data - nếu có
      if (ticketData.images.length > 0) {
        ticketData.images.forEach((image, index) => {
          // Lấy tên file từ URI
          const uriParts = image.uri.split('/');
          const fileName = uriParts[uriParts.length - 1];

          // Phân tích phần mở rộng để xác định loại file
          const fileNameParts = fileName.split('.');
          const fileExtension = fileNameParts[fileNameParts.length - 1];
          const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

          formData.append('attachments', {
            uri: image.uri,
            name: fileName,
            type: mimeType,
          } as any);
        });
      }

      console.log('Đang gửi ticket lên server...');

      // Gửi dữ liệu lên server
      const response = await axios.post(`${API_BASE_URL}/api/tickets`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Phản hồi từ server:', response.data);

      // Kiểm tra cả trường hợp response.data.ticket.ticketCode và response.data.ticketCode
      if (response.data) {
        if (response.data.success === true) {
          // Kiểm tra nếu ticket info được trả về trong response.data.ticket
          if (response.data.ticket && response.data.ticket.ticketCode) {
            setTicketCreatedId(response.data.ticket.ticketCode);
            setStep(5);
          }
          // Kiểm tra nếu ticket code được trả về trực tiếp trong response.data
          else if (response.data.ticketCode) {
            setTicketCreatedId(response.data.ticketCode);
            setStep(5);
          } else {
            console.error('Ticket được tạo nhưng không có mã ticket');
            Alert.alert('Thông báo', 'Ticket đã được tạo nhưng không có mã ticket');
          }
        } else {
          Alert.alert('Thông báo', 'Đã có lỗi xảy ra khi tạo ticket');
        }
      } else {
        Alert.alert('Thông báo', 'Đã có lỗi xảy ra khi tạo ticket');
      }
    } catch (error: any) {
      console.error('Lỗi khi tạo ticket:', error);

      // Hiển thị thông tin lỗi chi tiết hơn
      let errorMessage = 'Không thể tạo ticket, vui lòng thử lại sau';

      if (error.response) {
        // Server trả về lỗi với mã trạng thái
        console.error('Mã lỗi:', error.response.status);
        console.error('Dữ liệu lỗi:', error.response.data);

        if (error.response.status === 500) {
          // Kiểm tra nếu là lỗi ObjectId
          if (
            error.response.data &&
            error.response.data.message &&
            error.response.data.message.includes('Cast to ObjectId failed')
          ) {
            errorMessage = 'Lỗi xác thực người dùng. Vui lòng đăng nhập lại.';
          } else {
            errorMessage =
              'Lỗi máy chủ nội bộ. Vui lòng kiểm tra log server để biết thêm chi tiết.';
          }
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        // Yêu cầu được gửi nhưng không nhận được phản hồi
        console.error('Không nhận được phản hồi từ server:', error.request);
        errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và URL API.';
      }

      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepOne = () => {
    // Danh sách các option
    const options: OptionItem[] = [
      {
        type: 'device',
        label: 'Hỗ trợ chung',
        image: require('../../assets/overall.png'),
        description:
          'Hỗ trợ chung" áp dụng cho các yêu cầu hỗ trợ kỹ thuật và vận hành hàng ngày, bao gồm sửa chữa, bảo trì và hướng dẫn sử dụng thiết bị.',
      },
      {
        type: 'event',
        label: 'Hỗ trợ sự kiện',
        image: require('../../assets/event.png'),
        description: '"Hỗ trợ sự kiện" áp dụng cho các yêu cầu hỗ trợ kỹ thuật...',
      },
      {
        type: 'hrorder',
        label: 'Order Nhân sự',
        image: require('../../assets/hrorder.png'),
        description: '"Order nhân sự" áp dụng cho các yêu cầu bổ sung nhân sự...',
      },
    ];

    return (
      <View className="flex-1 items-center justify-center">
        <Text className="mb-2 w-[80%] text-center font-bold text-xl text-gray-800">
          Xin chào WISer <Text className="text-[#FF5733]">{userName}</Text>, bạn cần chúng tớ{' '}
          <Text className="font-bold text-[#002147]">hỗ trợ</Text> gì ạ? ^^
        </Text>

        <Text className="my-8 text-center font-semibold text-[#FF5733] underline">
          Hướng dẫn tạo ticket trên 360° WISers
        </Text>

        <View className="mb-10 mt-20 w-full px-4">
          {/* Hàng đầu tiên - 2 options */}
          <View className="flex-row justify-between">
            <TouchableOpacity
              className={`w-[45%] items-center justify-end ${
                ticketData.type === 'device' ? '' : ''
              }`}
              onPress={() => {
                setTicketData((prev) => ({ ...prev, type: 'device' }));
                setSelectedOption(options[0].description);
              }}>
              <View
                className={`relative min-h-[100px] w-full items-center justify-end overflow-visible rounded-xl py-4 ${ticketData.type === 'device' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}>
                <Image
                  source={options[0].image}
                  className="absolute top-[-65px] z-10 h-[120px] w-[115px]"
                />
                <Text className="text-center  text-base">{options[0].label}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className={`w-[45%] items-center justify-end ${
                ticketData.type === 'event' ? '' : ''
              }`}
              onPress={() => {
                setTicketData((prev) => ({ ...prev, type: 'event' }));
                setSelectedOption(options[1].description);
              }}>
              <View
                className={`relative min-h-[100px] w-full items-center justify-end overflow-visible rounded-xl py-4 ${ticketData.type === 'event' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}>
                <Image
                  source={options[1].image}
                  className="absolute top-[-60px] z-10 h-[114px] w-[136px]"
                />
                <Text className="text-center text-base">{options[1].label}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Hàng thứ hai - 1 option */}
          <View className="mt-[20%] items-start">
            <TouchableOpacity
              className={`w-[45%] items-center justify-end ${
                ticketData.type === 'hrorder' ? '' : ''
              }`}
              onPress={() => {
                setTicketData((prev) => ({ ...prev, type: 'hrorder' }));
                setSelectedOption(options[2].description);
              }}>
              <View
                className={`relative min-h-[100px] w-full items-center justify-end overflow-visible rounded-xl py-4 ${ticketData.type === 'hrorder' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}>
                <Image
                  source={options[2].image}
                  className="absolute top-[-60px] z-10 h-[120px] w-[105px]"
                />
                <Text className="text-center text-base">{options[2].label}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {selectedOption && (
          <View className="mx-5 rounded-lg border border-dashed border-[#7FA0B5] p-5">
            <Text className="text-justify text-[#757575]">{selectedOption}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderStepTwo = () => {
    if (ticketData.type === 'event') {
      // Giao diện riêng cho sự kiện
      return (
        <View className="w-full">
          <View className="mb-5">
            <Text className="mb-1.5 font-semibold text-base text-[#002147]">
              Tên sự kiện <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="mb-1 mt-2 rounded-xl border border-gray-200 p-3"
              placeholder="Nhập nội dung"
              value={ticketData.title}
              onChangeText={(text) => setTicketData((prev) => ({ ...prev, title: text }))}
            />
            <Text className="mt-1 text-xs text-[#757575]">Ngắn gọn, tối đa 100 kí tự</Text>
          </View>

          <View className="mb-5 flex-row justify-between">
            <View className="w-[48%]">
              <Text className="mb-1.5 font-semibold text-base text-[#002147]">Ngày bắt đầu</Text>
              <TouchableOpacity
                className="mt-2 rounded-xl border border-gray-200 p-3"
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}>
                <Text className={ticketData.startDate ? 'text-black' : 'text-gray-400'}>
                  {ticketData.startDate || 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="w-[48%]">
              <Text className="mb-1.5 font-semibold text-base text-[#002147]">Ngày kết thúc</Text>
              <TouchableOpacity
                className="mt-2 rounded-xl border border-gray-200 p-3"
                onPress={() => {
                  setDatePickerType('end');
                  setShowDatePicker(true);
                }}>
                <Text className={ticketData.endDate ? 'text-black' : 'text-gray-400'}>
                  {ticketData.endDate || 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-5">
            <Text className="mb-1.5 font-semibold text-base text-[#002147]">
              Mô tả <Text className="text-red-500">*</Text>
            </Text>
            <View className="relative">
              <TextInput
                className="mt-2 min-h-[120px] rounded-xl border border-gray-200 p-3"
                placeholder="Nhập mô tả"
                multiline={true}
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={1000}
                value={ticketData.description}
                onChangeText={(text) => setTicketData((prev) => ({ ...prev, description: text }))}
              />
              <Text className="absolute bottom-2 right-3 text-xs text-gray-400">
                {ticketData.description?.length || 0}/1000
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Giao diện chung
    return (
      <View className="w-full">
        <View className="mb-5">
          <Text className="mb-1.5 font-semibold text-base text-[#002147]">
            Nội dung <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="mb-1 mt-2 rounded-xl border border-gray-200 p-3"
            placeholder="Nhập nội dung"
            value={ticketData.title}
            onChangeText={(text) => setTicketData((prev) => ({ ...prev, title: text }))}
          />
          <Text className="mt-1 text-xs text-[#757575]">Ngắn gọn, tối đa 100 kí tự</Text>
        </View>

        <View className="mb-5">
          <Text className="mb-1.5 font-semibold text-base text-[#002147]">
            Mô tả <Text className="text-red-500">*</Text>
          </Text>
          <View className="relative">
            <TextInput
              className="mb-1 mt-2 min-h-[120px] rounded-xl border border-gray-200 p-3"
              placeholder="Nhập mô tả"
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 flex-row">
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
    );
  };

  const renderStepFour = () => {
    return (
      <View className="w-full">
        <View className="mb-5">
          <Text className="mb-1.5 font-bold text-base text-[#002147]">Ghi chú</Text>
          <TextInput
            className="min-h-[150px] rounded-xl bg-gray-100 p-3"
            placeholder="Nhập ghi chú..."
            multiline={true}
            numberOfLines={6}
            textAlignVertical="top"
            value={ticketData.notes}
            onChangeText={(text) => setTicketData((prev) => ({ ...prev, notes: text }))}
          />
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
          {/* Hiển thị title cho step 2-4 */}
          {step > 1 && step < 5 && (
            <>
              {step === 2 && (
                <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
                  Bạn hãy nhập nội dung và mô tả chi tiết
                </Text>
              )}
              {step === 3 && (
                <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
                  Bạn hãy cung cấp hình ảnh nếu có
                </Text>
              )}
              {step === 4 && (
                <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
                  Note lại cho chúng tớ những điều cần thiết
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
          {step === 4 && renderStepFour()}
          {step === 5 && renderStepFive()}
        </ScrollView>
        {/* Navigation buttons */}
        <View className="absolute bottom-[2%] left-4 right-4 items-center gap-3">
          {step < 5 && (
            <>
              <TouchableOpacity
                className={`w-full rounded-full bg-[#FF5733] px-6 py-2.5 ${
                  (step === 1 && !ticketData.type) ||
                  (step === 2 && (!ticketData.title || !ticketData.description))
                    ? 'opacity-50'
                    : 'opacity-100'
                }`}
                onPress={handleContinue}>
                <Text className="text-center font-bold text-lg text-white">
                  {step === 4 ? 'Hoàn tất' : 'Tiếp tục'}
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

        {/* Modal DatePicker */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}>
          <View className="flex-1 justify-end bg-black bg-opacity-50">
            <View className="rounded-t-3xl bg-white p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="font-bold text-lg text-[#002147]">
                  {datePickerType === 'start' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text className="font-semibold text-[#FF5733]">Đóng</Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={datePickerType === 'start' ? startDate : endDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    const formattedDate = selectedDate.toLocaleDateString('vi-VN');
                    if (datePickerType === 'start') {
                      setStartDate(selectedDate);
                      setTicketData((prev) => ({ ...prev, startDate: formattedDate }));
                    } else {
                      setEndDate(selectedDate);
                      setTicketData((prev) => ({ ...prev, endDate: formattedDate }));
                    }
                  }
                }}
              />

              <TouchableOpacity
                className="mt-4 rounded-xl bg-[#FF5733] p-4"
                onPress={() => setShowDatePicker(false)}>
                <Text className="text-center font-bold text-lg text-white">Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TicketCreate;
