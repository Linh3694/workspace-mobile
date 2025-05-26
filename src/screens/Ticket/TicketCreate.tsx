import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
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
        <View className="flex-row justify-center items-center my-6">
            {/* Bước 1 */}
            <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full flex items-center justify-center">
                    {step === 1 ? (
                        <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
                    ) : step > 1 ? (
                        <FontAwesome name="check-circle" size={24} color="#FF5733" />
                    ) : (
                        <FontAwesome name="circle-o" size={24} color="#FF5733" />
                    )}
                </View>
                <View className={`w-10 h-0.5 ${step > 1 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
            </View>

            {/* Bước 2 */}
            <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full flex items-center justify-center">
                    {step === 2 ? (
                        <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
                    ) : step > 2 ? (
                        <FontAwesome name="check-circle" size={24} color="#FF5733" />
                    ) : (
                        <FontAwesome name="circle-o" size={24} color="#FF5733" />
                    )}
                </View>
                <View className={`w-10 h-0.5 ${step > 2 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
            </View>

            {/* Bước 3 */}
            <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full flex items-center justify-center">
                    {step === 3 ? (
                        <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
                    ) : step > 3 ? (
                        <FontAwesome name="check-circle" size={24} color="#FF5733" />
                    ) : (
                        <FontAwesome name="circle-o" size={24} color="#FF5733" />
                    )}
                </View>
                <View className={`w-10 h-0.5 ${step > 3 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
            </View>

            {/* Bước 4 */}
            <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full flex items-center justify-center">
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
                imageCount: ticketData.images.length
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
                    'Authorization': `Bearer ${token}`,
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
                    }
                    else {
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
                    if (error.response.data && error.response.data.message &&
                        error.response.data.message.includes('Cast to ObjectId failed')) {
                        errorMessage = 'Lỗi xác thực người dùng. Vui lòng đăng nhập lại.';
                    } else {
                        errorMessage = 'Lỗi máy chủ nội bộ. Vui lòng kiểm tra log server để biết thêm chi tiết.';
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
                description:
                    '"Hỗ trợ sự kiện" áp dụng cho các yêu cầu hỗ trợ kỹ thuật...',
            },
            {
                type: 'hrorder',
                label: 'Order Nhân sự',
                image: require('../../assets/hrorder.png'),
                description:
                    '"Order nhân sự" áp dụng cho các yêu cầu bổ sung nhân sự...',
            },
        ];

        return (
            <View className="flex-1 items-center justify-center">
                <Text className="w-[80%] text-xl font-bold text-center mb-2 text-gray-800">
                    Xin chào WISer{' '}
                    <Text className="text-[#FF5733]">{userName}</Text>,
                    bạn cần chúng tớ{' '}
                    <Text className="text-[#002147] font-bold">hỗ trợ</Text> gì ạ? ^^
                </Text>

                <Text className="text-[#FF5733] text-center font-semibold underline my-8">
                    Hướng dẫn tạo ticket trên 360° WISers
                </Text>

                <View className="w-full px-4 mt-20 mb-10">
                    {/* Hàng đầu tiên - 2 options */}
                    <View className="flex-row justify-between">
                        <TouchableOpacity
                            className={`w-[45%] items-center justify-end ${ticketData.type === 'device'
                                ? ''
                                : ''
                                }`}
                            onPress={() => {
                                setTicketData((prev) => ({ ...prev, type: 'device' }));
                                setSelectedOption(options[0].description);
                            }}
                        >
                            <View
                                className={`relative w-full min-h-[100px] rounded-xl items-center justify-end py-4 overflow-visible ${ticketData.type === 'device' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}
                            >
                                <Image
                                    source={options[0].image}
                                    className="absolute top-[-65px] z-10 w-[115px] h-[120px]"
                                />
                                <Text className="text-base  text-center">{options[0].label}</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`w-[45%] items-center justify-end ${ticketData.type === 'event'
                                ? ''
                                : ''
                                }`}
                            onPress={() => {
                                setTicketData((prev) => ({ ...prev, type: 'event' }));
                                setSelectedOption(options[1].description);
                            }}
                        >
                            <View
                                className={`relative w-full min-h-[100px] rounded-xl items-center justify-end py-4 overflow-visible ${ticketData.type === 'event' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}
                            >
                                <Image
                                    source={options[1].image}
                                    className="absolute top-[-60px] z-10 w-[136px] h-[114px]"
                                />
                                <Text className="text-base text-center">{options[1].label}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Hàng thứ hai - 1 option */}
                    <View className="items-start mt-[20%]">
                        <TouchableOpacity
                            className={`w-[45%] items-center justify-end ${ticketData.type === 'hrorder'
                                ? ''
                                : ''
                                }`}
                            onPress={() => {
                                setTicketData((prev) => ({ ...prev, type: 'hrorder' }));
                                setSelectedOption(options[2].description);
                            }}
                        >
                            <View
                                className={`relative w-full min-h-[100px] rounded-xl items-center justify-end py-4 overflow-visible ${ticketData.type === 'hrorder' ? 'bg-[#E6EEF6]' : 'bg-gray-100'}`}
                            >
                                <Image
                                    source={options[2].image}
                                    className="absolute top-[-60px] z-10 w-[105px] h-[120px]"
                                />
                                <Text className="text-base text-center">{options[2].label}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {selectedOption && (
                    <View className="p-5 border border-dashed border-[#7FA0B5] rounded-lg mx-5">
                        <Text className="text-justify text-[#757575]">
                            {selectedOption}
                        </Text>
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
                        <Text className="text-base font-semibold mb-1.5 text-[#002147]">
                            Tên sự kiện <Text className="text-red-500">*</Text>
                        </Text>
                        <TextInput
                            className="border border-gray-200 rounded-xl p-3 mt-2 mb-1"
                            placeholder="Nhập nội dung"
                            value={ticketData.title}
                            onChangeText={(text) => setTicketData((prev) => ({ ...prev, title: text }))}
                        />
                        <Text className="text-xs text-[#757575] mt-1">Ngắn gọn, tối đa 100 kí tự</Text>
                    </View>

                    <View className="flex-row justify-between mb-5">
                        <View className="w-[48%]">
                            <Text className="text-base font-semibold mb-1.5 text-[#002147]">Ngày bắt đầu</Text>
                            <TextInput
                                className="border border-gray-200 rounded-xl p-3 mt-2"
                                placeholder="DD/MM/YYYY"
                                value={ticketData.startDate}
                                onChangeText={(text) => setTicketData((prev) => ({ ...prev, startDate: text }))}
                            />
                        </View>
                        <View className="w-[48%]">
                            <Text className="text-base font-semibold mb-1.5 text-[#002147]">Ngày kết thúc</Text>
                            <TextInput
                                className="border border-gray-200 rounded-xl p-3 mt-2"
                                placeholder="DD/MM/YYYY"
                                value={ticketData.endDate}
                                onChangeText={(text) => setTicketData((prev) => ({ ...prev, endDate: text }))}
                            />
                        </View>
                    </View>

                    <View className="mb-5">
                        <Text className="text-base font-semibold mb-1.5 text-[#002147]">
                            Mô tả <Text className="text-red-500">*</Text>
                        </Text>
                        <View className="relative">
                            <TextInput
                                className="border border-gray-200 rounded-xl p-3 mt-2 min-h-[120px]"
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
                    <Text className="text-base font-semibold mb-1.5 text-[#002147]">
                        Nội dung <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                        className="border border-gray-200 rounded-xl p-3 mt-2 mb-1"
                        placeholder="Nhập nội dung"
                        value={ticketData.title}
                        onChangeText={(text) => setTicketData((prev) => ({ ...prev, title: text }))}
                    />
                    <Text className="text-xs text-[#757575] mt-1">Ngắn gọn, tối đa 100 kí tự</Text>
                </View>

                <View className="mb-5">
                    <Text className="text-base font-semibold mb-1.5 text-[#002147]">
                        Mô tả <Text className="text-red-500">*</Text>
                    </Text>
                    <View className="relative">
                        <TextInput
                            className="border border-gray-200 rounded-xl p-3 mt-2 mb-1 min-h-[120px]"
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
                        setTicketData(prev => ({
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
                            .map(asset => ({ uri: asset.uri }));

                        setTicketData(prev => ({
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
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 items-center justify-center mb-4"
                    onPress={() => actionSheetRef.current?.setModalVisible(true)}
                >
                    <Ionicons name="cloud-upload-outline" size={40} color="#999" />
                    <Text className="mt-3 text-base text-gray-600">Chọn ảnh từ thiết bị</Text>
                </TouchableOpacity>

                <View className="flex-row justify-between mb-5">
                    <Text className="text-xs italic text-gray-500">Định dạng hỗ trợ: png, jpg, jpeg</Text>
                    <Text className="text-xs italic text-gray-500">Dung lượng tối đa: 10MB</Text>
                </View>

                {ticketData.images.length > 0 && (
                    <View className="mt-5">
                        <Text className="text-base font-bold mb-2.5 text-[#002147]">Ảnh đã tải lên</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-5">
                            {ticketData.images.map((image, index) => (
                                <View key={index} className="w-[100px] h-[100px] mr-2.5 relative">
                                    <Image source={{ uri: image.uri }} className="w-full h-full rounded-lg" />
                                    <TouchableOpacity
                                        className="absolute top-1 right-1 bg-black bg-opacity-60 w-[22px] h-[22px] rounded-full items-center justify-center"
                                        onPress={() => {
                                            setTicketData(prev => ({
                                                ...prev,
                                                images: prev.images.filter((_, i) => i !== index)
                                            }));
                                        }}
                                    >
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
                    <Text className="text-base font-bold mb-1.5 text-[#002147]">Ghi chú</Text>
                    <TextInput
                        className="bg-gray-100 rounded-xl p-3 min-h-[150px]"
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
            <View className="h-full flex items-center justify-center p-5 mt-10">
                <Image
                    source={require('../../assets/final.png')}
                    className="w-[158px] h-[220px] mb-5"
                />
                <Text className="text-2xl font-bold mb-3 text-gray-800">
                    Cám ơn WISer {userName}!
                </Text>
                <Text className="text-base text-center text-gray-600 mb-6">
                    Yêu cầu của bạn đã được ghi nhận, chúng tôi sẽ xử lý trong thời gian sớm nhất.
                </Text>
                {ticketCreatedId && (
                    <View className="bg-[#E6EEF6] rounded-xl p-4 w-[60%] items-center mb-6">
                        <Text className="text-base text-[#002147] mb-1">Mã Ticket của bạn:</Text>
                        <Text className="text-xl font-bold text-[#FF5733]">{ticketCreatedId}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView
            className="flex-1 bg-white"
            style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        >
            {/* Loading overlay */}
            {loading && (
                <View className="absolute inset-0 bg-white bg-opacity-80 items-center justify-center z-50">
                    <ActivityIndicator size="large" color="#FF5733" />
                    <Text className="mt-2.5 text-base text-gray-700">Đang xử lý...</Text>
                </View>
            )}

            {/* Main content */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="h-full flex-1"
            >
                <ScrollView
                    className="h-full flex-1 mt-4"
                    contentContainerStyle={{ paddingBottom: 40, padding: 16 }}
                >
                    {/* Hiển thị title cho step 2-4 */}
                    {step > 1 && step < 5 && (
                        <>
                            {step === 2 && (
                                <Text className="text-xl font-bold text-center mb-3 text-[#002147]">
                                    Bạn hãy nhập nội dung và mô tả chi tiết
                                </Text>
                            )}
                            {step === 3 && (
                                <Text className="text-xl font-bold text-center mb-3 text-[#002147]">
                                    Bạn hãy cung cấp hình ảnh nếu có
                                </Text>
                            )}
                            {step === 4 && (
                                <Text className="text-xl font-bold text-center mb-3 text-[#002147]">
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
                <View className="absolute left-4 right-4 bottom-[2%] items-center gap-3">
                    {step < 5 && (
                        <>
                            <TouchableOpacity
                                className={`w-full bg-[#FF5733] px-6 py-2.5 rounded-full ${(step === 1 && !ticketData.type) ||
                                    (step === 2 && (!ticketData.title || !ticketData.description))
                                    ? 'opacity-50'
                                    : 'opacity-100'
                                    }`}
                                onPress={handleContinue}
                            >
                                <Text className="text-white font-bold text-center text-lg">
                                    {step === 4 ? 'Hoàn tất' : 'Tiếp tục'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="w-full bg-gray-200 px-5 py-2.5 rounded-full"
                                onPress={handleGoBack}
                            >
                                <Text className="text-[#757575] font-semibold text-center text-lg">Quay lại</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    {step === 5 && (
                        <TouchableOpacity
                            className="w-full bg-[#FF5733] px-6 py-2.5 rounded-full"
                            onPress={() => navigation.goBack()}
                        >
                            <Text className="text-white font-bold text-center text-lg">
                                Quay về trang chính
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                {/* ActionSheet for image selection */}
                <ActionSheet ref={actionSheetRef} containerStyle={{ padding: 16 }}>
                    <TouchableOpacity
                        className="flex-row items-center px-8 py-4 border-b border-gray-100"
                        onPress={() => { pickFromCamera(); actionSheetRef.current?.setModalVisible(false); }}
                    >
                        <Ionicons name="camera-outline" size={28} color="#FF5733" />
                        <Text className="ml-4 text-base text-[#333]">Chụp ảnh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-row items-center px-8 py-4 border-b border-gray-100"
                        onPress={() => { pickFromLibrary(); actionSheetRef.current?.setModalVisible(false); }}
                    >
                        <Ionicons name="images-outline" size={28} color="#FF5733" />
                        <Text className="ml-4 text-base text-[#333]">Chọn từ thư viện</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="m-6 bg-gray-100 py-4 rounded-full"
                        onPress={() => actionSheetRef.current?.setModalVisible(false)}
                    >
                        <Text className="text-center font-semibold text-[#666]">Hủy</Text>
                    </TouchableOpacity>
                </ActionSheet>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default TicketCreate;
