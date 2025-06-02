import React, { useState, useEffect } from 'react';
// @ts-ignore
import { View, Text, SafeAreaView, TouchableOpacity, Switch, Alert, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';
import Wismelogo from '../../assets/wisme.svg';
import { getAvatar } from '../../utils/avatar';
import { API_BASE_URL } from '../../config/constants.js';
import FaceID from '../../assets/faceid-gray.svg'
import Dot from '../../assets/dot.svg'
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import axios from 'axios';


const ProfileScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const { logout, user, clearBiometricCredentials, refreshUserData } = useAuth();
    const { isBiometricAvailable, hasSavedCredentials, removeCredentials, saveCredentialsFromProfile } = useBiometricAuth();
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [avatarError, setAvatarError] = useState(false);

    // Kiểm tra xem sinh trắc học có được bật không
    useEffect(() => {
        setBiometricEnabled(hasSavedCredentials);
    }, [hasSavedCredentials]);

    // Kiểm tra trạng thái thông báo khi component mount
    useEffect(() => {
        checkNotificationStatus();
    }, []);

    // Debug avatar URL
    useEffect(() => {
        if (user) {
            const avatarUrl = getAvatar(user);
            console.log('Avatar URL:', avatarUrl);
            console.log('User data:', user);
            console.log('User has avatarUrl:', !!user.avatarUrl);

            // Test if avatar URL is accessible
            if (user.avatarUrl) {
                const testUrl = `${API_BASE_URL}/uploads/Avatar/${user.avatarUrl}`;
                console.log('Testing avatar URL accessibility:', testUrl);

                // Try to load the image to check if it exists
                Image.prefetch(testUrl).then(() => {
                    console.log('Avatar image successfully prefetched');
                }).catch((error) => {
                    console.log('Avatar image prefetch failed:', error);
                    setAvatarError(true);
                });
            }
        }
    }, [user]);

    const handleLogout = async () => {
        await logout();
    };

    const handleEnableBiometric = () => {
        setPassword('');
        setShowPasswordModal(true);
    };

    const handleSubmitPassword = async () => {
        if (!password.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu');
            return;
        }

        setIsLoading(true);
        try {
            const success = await saveCredentialsFromProfile(password);
            if (success) {
                setBiometricEnabled(true);
                setShowPasswordModal(false);
            }
        } catch (error) {
            console.error('Lỗi khi bật xác thực sinh trắc học:', error);
            Alert.alert('Lỗi', 'Không thể bật xác thực sinh trắc học. Vui lòng thử lại sau.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleBiometricAuth = async (value: boolean) => {
        if (value === false) {
            setShowConfirmModal(true);
        } else {
            handleEnableBiometric();
        }
    };

    const handleConfirmDisable = async () => {
        const success = await removeCredentials();
        if (success) {
            setBiometricEnabled(false);
        }
        setShowConfirmModal(false);
    };

    const handleImageError = () => {
        console.log('Avatar load error, switching to fallback');
        setAvatarError(true);
    };

    const getFallbackAvatar = () => {
        if (!user) return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff&size=200';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff&size=200&font-size=0.5`;
    };

    // Kiểm tra trạng thái thông báo đẩy
    const checkNotificationStatus = async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            const savedStatus = await AsyncStorage.getItem('notificationsEnabled');
            setNotificationsEnabled(status === 'granted' && savedStatus === 'true');
        } catch (error) {
            console.error('Lỗi khi kiểm tra trạng thái thông báo:', error);
        }
    };

    // Cài đặt thông báo đẩy
    const setupPushNotifications = async () => {
        // Kiểm tra xem thiết bị có phải là thiết bị thật không
        if (!Device.isDevice) {
            Alert.alert('Thông báo', 'Thiết bị giả lập không hỗ trợ thông báo đẩy!');
            return false;
        }

        // Kiểm tra quyền thông báo
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Nếu chưa được cấp quyền, yêu cầu quyền
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        // Nếu không được cấp quyền, thông báo cho người dùng
        if (finalStatus !== 'granted') {
            Alert.alert('Thông báo', 'Bạn cần cấp quyền thông báo để nhận thông báo!');
            return false;
        }

        // Thiết lập kênh thông báo cho Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Mặc định',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        try {
            // Lấy projectId từ Constants
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

            if (!projectId) {
                console.error('Không tìm thấy projectId trong app.json');
                return false;
            }

            // Lấy token thiết bị
            const token = await Notifications.getExpoPushTokenAsync({
                projectId,
            });

            console.log('Push token:', token.data);

            // Lưu token vào AsyncStorage để sử dụng sau này
            await AsyncStorage.setItem('pushToken', token.data);

            // Gửi token lên server
            await registerDeviceToken(token.data);
            return true;
        } catch (error) {
            console.error('Lỗi khi thiết lập thông báo đẩy:', error);
            return false;
        }
    };

    // Đăng ký token thiết bị với server
    const registerDeviceToken = async (token: string) => {
        try {
            const authToken = await AsyncStorage.getItem('authToken');

            if (!authToken) {
                console.log('Người dùng chưa đăng nhập');
                return;
            }

            await axios.post(
                `${API_BASE_URL}/api/notifications/register-device`,
                { deviceToken: token },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    }
                }
            );
        } catch (error) {
            console.error('Lỗi đăng ký token thiết bị:', error);
        }
    };

    // Hủy đăng ký token thiết bị
    const unregisterDeviceToken = async () => {
        try {
            const authToken = await AsyncStorage.getItem('authToken');
            const pushToken = await AsyncStorage.getItem('pushToken');

            if (!authToken || !pushToken) {
                return;
            }

            await axios.post(
                `${API_BASE_URL}/api/notifications/unregister-device`,
                { deviceToken: pushToken },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    }
                }
            );

            // Xóa token khỏi AsyncStorage
            await AsyncStorage.removeItem('pushToken');
        } catch (error) {
            console.error('Lỗi hủy đăng ký token thiết bị:', error);
        }
    };

    // Xử lý bật/tắt thông báo
    const toggleNotifications = async (value: boolean) => {
        try {
            if (value) {
                const success = await setupPushNotifications();
                if (success) {
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem('notificationsEnabled', 'true');
                    Alert.alert('Thành công', 'Đã bật thông báo đẩy!');
                } else {
                    setNotificationsEnabled(false);
                }
            } else {
                await unregisterDeviceToken();
                setNotificationsEnabled(false);
                await AsyncStorage.setItem('notificationsEnabled', 'false');
                Alert.alert('Thông báo', 'Đã tắt thông báo đẩy!');
            }
        } catch (error) {
            console.error('Lỗi khi thay đổi cài đặt thông báo:', error);
            Alert.alert('Lỗi', 'Không thể thay đổi cài đặt thông báo. Vui lòng thử lại sau.');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1">
                {/* Header */}
                <View className=" px-6 pt-4 pb-2">
                    <Wismelogo width={100} height={30} />
                </View>

                {/* Profile Section */}
                <View className="mx-4 mt-6 rounded-2xl p-6 items-center">
                    {/* Avatar với online status */}
                    <View className="relative mb-4">
                            <Image
                                source={{
                                    uri: avatarError ? getFallbackAvatar() : getAvatar(user)
                                }}
                                className="w-24 h-24 rounded-full"
                                onError={handleImageError}
                                onLoad={() => setAvatarError(false)}
                            />                    
                    </View>

                    {/* User Info */}
                    <Text className="text-3xl font-bold text-primary my-2">
                        {user?.fullname}
                    </Text>
                    <Text className="text-[#757575] font-medium my-2">
                        {user?.jobTitle}
                    </Text>

                    {/* Employee ID Badge */}
                    <View className="bg-[#F9FBEB] px-4 py-2 rounded-full">
                        <Text className="text-black font-semibold text-lg">
                            {user?.employeeCode}
                        </Text>
                    </View>
                </View>

                {/* Contact Info Section */}
                <View className="bg-[#f8f8f8] mx-4 mt-4 p-4 rounded-2xl">
                    <View className="my-2" >
                        <Text className="text-lg font-semibold text-black">Thông tin liên hệ</Text>
                    </View>
                    <View className=" gap-2">
                        {/* Phone */}
                        <View className="flex-row items-center my-2">
                            <Ionicons name="call-outline" size={20} color="#757575" />
                            <Text className="ml-5 text-black font-medium">
                                {user?.phone}
                            </Text>
                        </View>

                        {/* Email */}
                        <View className="flex-row items-center my-2">
                            <Ionicons name="mail-outline" size={20} color="#757575" />
                            <Text className="ml-5 text-black font-medium">
                                {user?.email}
                            </Text>
                        </View>

                        {/* Department */}
                        <View className="flex-row items-center my-2">
                            <Ionicons name="business-outline" size={20} color="#757575" />
                            <Text className="ml-5 text-black font-medium">
                                {user?.department}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Settings Section */}
                <View className="rounded-2xl border-t border-[#E5E5E5] mt-8">

                    <View className="p-5 gap-8">
                        <Text className="text-base font-semibold text-black">Cài đặt</Text>
                        {/* Notifications */}
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                <Ionicons name="notifications-outline" size={20} color="#757575" />
                                <Text className="ml-5 text-black font-medium">Thông báo</Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#D1D5DB", true: "#F97316" }}
                                thumbColor={"#FFFFFF"}
                                value={notificationsEnabled}
                                onValueChange={toggleNotifications}
                            />
                        </View>

                        {/* Change Password */}
                        <TouchableOpacity className="flex-row items-center">
                            <Dot width={20} height={20} />
                            <Text className="ml-5 flex-1 text-black font-medium">Đổi mật khẩu</Text>
                        </TouchableOpacity>

                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                <FaceID width={20} height={20} />
                                <Text className="ml-5 text-black font-medium">FaceID</Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#D1D5DB", true: "#F97316" }}
                                thumbColor={"#FFFFFF"}
                                value={biometricEnabled}
                                onValueChange={toggleBiometricAuth}
                            />
                        </View>

                        {/* Language */}
                        <TouchableOpacity className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                <Ionicons name="language-outline" size={20} color="#757575" />
                                <Text className="ml-5 text-black font-medium">Ngôn ngữ</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-black font-medium mr-2">Tiếng Việt</Text>
                                <Ionicons name="chevron-down" size={16} color="#757575" />
                            </View>
                        </TouchableOpacity>

                        {/* Logout */}
                        <TouchableOpacity
                            onPress={handleLogout}
                            className="flex-row items-center"
                        >
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            <Text className="ml-5 text-red-500">Đăng xuất</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Modal xác nhận tắt FaceID/TouchID */}
            <ConfirmModal
                visible={showConfirmModal}
                title="Xóa thông tin đăng nhập"
                message="Bạn có chắc muốn tắt đăng nhập bằng FaceID/TouchID? Thông tin đăng nhập sẽ bị xóa."
                onCancel={() => setShowConfirmModal(false)}
                onConfirm={handleConfirmDisable}
            />

            {/* Modal nhập mật khẩu để bật xác thực sinh trắc học */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showPasswordModal}
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <Pressable
                    className="flex-1 justify-center items-center bg-black/50"
                    onPress={() => setShowPasswordModal(false)}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="w-[85%] bg-white rounded-2xl p-6 shadow-lg"
                    >
                        <Text className="text-xl font-bold text-gray-800 mb-4">Bật xác thực sinh trắc học</Text>
                        <Text className="text-base text-gray-600 mb-4">
                            Nhập mật khẩu hiện tại của bạn để bật tính năng đăng nhập bằng Face ID/Touch ID
                        </Text>

                        <View className="relative mb-6">
                            <TextInput
                                className="w-full h-12 border border-gray-300 rounded-xl px-4 pr-12 bg-white"
                                placeholder="Nhập mật khẩu"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                            />
                            <Pressable
                                className="absolute right-3 top-3"
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={24}
                                    color="#666"
                                />
                            </Pressable>
                        </View>

                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity
                                onPress={() => setShowPasswordModal(false)}
                                className="px-6 py-3"
                            >
                                <Text className="text-gray-600 font-medium">Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmitPassword}
                                disabled={isLoading}
                                className="bg-secondary px-6 py-3 rounded-lg"
                            >
                                <Text className="text-white font-medium">
                                    {isLoading ? 'Đang xử lý...' : 'Xác nhận'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default ProfileScreen; 