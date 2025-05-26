import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Switch, Alert, Modal, TextInput, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import FaceIdIcon from '../../assets/face-id.svg';
import VisibilityIcon from '../../assets/visibility.svg';
import ConfirmModal from '../../components/ConfirmModal';

const ProfileScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const { logout, user, clearBiometricCredentials } = useAuth();
    const { isBiometricAvailable, hasSavedCredentials, removeCredentials, saveCredentialsFromProfile } = useBiometricAuth();
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Kiểm tra xem sinh trắc học có được bật không
    useEffect(() => {
        setBiometricEnabled(hasSavedCredentials);
    }, [hasSavedCredentials]);

    const handleLogout = async () => {
        await logout();
    };

    const handleEnableBiometric = () => {
        // Hiển thị modal để nhập mật khẩu
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
            // Lưu thông tin đăng nhập sinh trắc học
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
            // Hiển thị modal xác nhận tắt FaceID/TouchID
            setShowConfirmModal(true);
        } else {
            // Bật xác thực sinh trắc học - yêu cầu nhập mật khẩu
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

    console.log('isBiometricAvailable:', isBiometricAvailable);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-4">
                <Text className="text-2xl font-bold text-gray-800">Thông Tin Cá Nhân</Text>
                {user && (
                    <View className="mt-4">
                        <Text className="text-lg font-medium text-gray-700">Họ tên: {user.fullname}</Text>
                        <Text className="text-lg font-medium text-gray-700 mt-1">Email: {user.email}</Text>
                    </View>
                )}
            </View>

            {/* Phần cài đặt */}
            <View className="mt-8 px-4">
                <Text className="text-xl font-bold text-gray-800 mb-4">Cài đặt</Text>

                {/* Tùy chọn FaceID/TouchID */}
                {isBiometricAvailable && (
                    <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
                        <View className="flex-row items-center">
                            <FaceIdIcon width={24} height={24} style={{ marginRight: 12 }} />
                            <Text className="text-base font-medium text-gray-700">Đăng nhập bằng FaceID/TouchID</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#D9D9D9", true: "#009483" }}
                            thumbColor={"#FFFFFF"}
                            value={biometricEnabled}
                            onValueChange={toggleBiometricAuth}
                        />
                    </View>
                )}
            </View>

            <View className="flex-1 justify-end pb-10 px-4">
                <TouchableOpacity onPress={handleLogout} className="bg-red-500 rounded-full py-3">
                    <Text className="text-center text-white font-bold text-lg">Đăng xuất</Text>
                </TouchableOpacity>
            </View>

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
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)'
                    }}
                    onPress={() => setShowPasswordModal(false)}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            width: '85%',
                            backgroundColor: 'white',
                            borderRadius: 16,
                            padding: 24,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                    >
                        <Text className="text-xl font-bold text-gray-800 mb-4">Bật Face ID</Text>
                        <Text className="text-base text-gray-600 mb-4">
                            Nhập mật khẩu hiện tại của bạn để bật tính năng đăng nhập bằng FaceID/TouchID
                        </Text>

                        <View className="relative items-center mb-5">
                            <TextInput
                                className="w-full h-12 border font-medium rounded-xl px-3 mb-4 bg-white pr-12 border-[#ddd]"
                                placeholder="Nhập mật khẩu"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                            />
                            <Pressable
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: '20%',
                                    zIndex: 10,
                                }}
                                onPress={() => setShowPassword((prev) => !prev)}
                                hitSlop={8}
                            >
                                <VisibilityIcon width={24} height={24} />
                            </Pressable>
                        </View>

                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity
                                onPress={() => setShowPasswordModal(false)}
                                className="px-5 py-2 rounded-lg"
                            >
                                <Text className="text-gray-700 font-medium">Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmitPassword}
                                disabled={isLoading}
                                className="bg-secondary px-5 py-2 rounded-lg"
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