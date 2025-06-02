import React, { useState, useEffect } from 'react';
// @ts-ignore
import { View, Text, TextInput, TouchableOpacity, Image, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { typography } from '../../theme/typography';
import { useMicrosoftLogin } from '../../hooks/useMicrosoftLogin';
import MicrosoftIcon from '../../assets/microsoft.svg';
import VisibilityIcon from '../../assets/visibility.svg';
import WarningIcon from '../../assets/warning.svg';
import FaceIdIcon from '../../assets/face-id.svg';
import { ROUTES } from '../../constants/routes';
import { API_BASE_URL } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import NotificationModal from '../../components/NotificationModal';

type RootStackParamList = {
    Main: { screen: string };
    Login: undefined;
};

const schema = yup.object().shape({
    email: yup.string().required('Email là bắt buộc').email('Email không hợp lệ'),
    password: yup.string().required('Mật khẩu là bắt buộc'),
});

// Define the key name for AsyncStorage
const LAST_EMAIL_KEY = 'WELLSPRING_LAST_EMAIL';

const SignInScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { control, handleSubmit, formState: { errors }, setValue, getValues } = useForm({
        resolver: yupResolver(schema),
    });
    const [loading, setLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, checkAuth } = useAuth();
    const {
        isBiometricAvailable,
        hasSavedCredentials,
        isAuthenticating,
        authenticate
    } = useBiometricAuth();
    const [showBiometricModal, setShowBiometricModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState<'success' | 'error'>('error');

    const {  promptAsync } = useMicrosoftLogin(
        async (token) => {
            console.log('✅ Microsoft login successful in SignInScreen:', token);
            try {
                // Call backend to check/create user based on Microsoft email
                const response = await fetch(`${API_BASE_URL}/api/auth/microsoft/login`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const authData = await response.json();
                console.log('🔍 Microsoft auth response:', authData);
                
                if (response.ok && authData.success) {
                    // Use the system token and user data from our database
                    const { token: systemToken, user } = authData;
                    
                    console.log('🎯 Microsoft user authenticated:', {
                        name: user.fullname,
                        email: user.email,
                        isNewUser: user.isNewUser,
                        role: user.role
                    });
                    
                    // Use AuthContext login method with system token and DB user data
                    await login(systemToken, user);
                    
                    // Trigger AuthContext to refresh and ensure navigation happens
                    await checkAuth();
                    
                    console.log('🚀 AuthContext refreshed, user should be navigated to main app');
                    
                    const message = user.isNewUser 
                        ? 'Chào mừng! Tài khoản Microsoft đã được tạo thành công!'
                        : 'Đăng nhập Microsoft thành công!';
                    
                    showNotification(message, 'success');
                } else {
                    throw new Error(authData.message || 'Microsoft authentication failed');
                }
                
            } catch (error) {
                console.error('❌ Error in Microsoft login flow:', error);
                showNotification('Không thể đăng nhập với Microsoft', 'error');
            }
        },
        (error) => {
            console.log('❌ Microsoft login error in SignInScreen:', error);
            showNotification(`Lỗi đăng nhập Microsoft: ${error}`, 'error');
        }
    );

    const showNotification = (message: string, type: 'success' | 'error' = 'error') => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotificationModal(true);
    };

    const handleBiometricLogin = async () => {
        console.log('Bắt đầu xử lý FaceID login');
        console.log('hasSavedCredentials:', hasSavedCredentials);
        console.log('isBiometricAvailable:', isBiometricAvailable);

        if (!hasSavedCredentials) {
            console.log('Chưa lưu credentials, hiển thị thông báo');
            showNotification('Bạn cần bật đăng nhập bằng FaceID/TouchID trong hồ sơ cá nhân trước.');
            return;
        }

        try {
            console.log('Bắt đầu xác thực sinh trắc học');
            const credentials = await authenticate();
            console.log('Kết quả xác thực:', credentials ? 'Thành công' : 'Thất bại');

            if (credentials) {
                console.log('Đã lấy được credentials, tiến hành đăng nhập');
                setValue('email', credentials.email);
                setValue('password', credentials.password);
                onSubmit({ email: credentials.email, password: credentials.password });
            } else {
                console.log('Không lấy được credentials');
                showNotification('Xác thực sinh trắc học thất bại. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Lỗi khi đăng nhập bằng sinh trắc học:', error);
            showNotification('Không thể xác thực sinh trắc học. Vui lòng thử lại.');
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        setLoginError('');
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email, password: data.password })
            });
            const resData = await response.json();

            if (!response.ok) {
                setLoginError(resData.message || 'Đăng nhập thất bại');
                showNotification('Tài khoản hoặc mật khẩu không chính xác', 'error');
                console.error('Lỗi đăng nhập:', resData.message);
            } else {
                try {
                    // Lưu email đăng nhập cho xác thực sinh trắc học
                    await AsyncStorage.setItem(LAST_EMAIL_KEY, data.email);

                    // Xử lý thông tin người dùng
                    let userId = '';
                    let userFullname = '';
                    let userRole = 'user';

                    if (resData.user) {
                        // Xử lý thông tin người dùng
                        const user = resData.user;
                        // Xử lý ID
                        userId = user._id || user.id || `user_${Date.now()}`;
                        // Xử lý tên hiển thị
                        userFullname = user.fullname || user.name || user.username || data.email.split('@')[0];
                        // Xử lý vai trò
                        userRole = user.role || 'user';
                        console.log('Thông tin vai trò người dùng sau khi đăng nhập:', userRole);
                        
                        const completeUser = {
                            ...user,
                            _id: userId,
                            fullname: userFullname,
                            role: userRole,
                            jobTitle: user.jobTitle || 'N/A',
                            department: user.department || 'N/A',
                            avatar: user.avatar || 'https://via.placeholder.com/150',
                            needProfileUpdate: user.needProfileUpdate || false,
                            employeeCode: user.employeeCode || 'N/A',
                        };

                        // Sử dụng context để đăng nhập
                        await login(resData.token, completeUser);

                    } else {
                        // Tạo thông tin người dùng mặc định nếu không có
                        userId = `user_${Date.now()}`;
                        userFullname = data.email.split('@')[0];

                        const defaultUser = {
                            _id: userId,
                            fullname: userFullname,
                            email: data.email,
                            role: 'user',
                            department: 'user'
                        };

                        await AsyncStorage.setItem('user', JSON.stringify(defaultUser));
                        console.warn('Không có thông tin user từ API, đã tạo thông tin mặc định');
                    }

                    // Chuyển đến màn hình chính
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main', params: { screen: 'Home' } }],
                    });
                } catch (storageError) {
                    console.error('Lỗi khi lưu thông tin đăng nhập:', storageError);
                    showNotification('Đã xảy ra lỗi khi xử lý thông tin đăng nhập', 'error');
                }
            }
        } catch (error) {
            console.error('Lỗi kết nối:', error);
            showNotification('Lỗi kết nối máy chủ', 'error');
            setLoginError('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white items-center">
            <View className="w-full mt-[15%] p-5">
                {/* Logo và tiêu đề */}
                <Image
                    source={require('../../assets/wellspring-logo.png')}
                    className="w-[30%] h-16 mb-6"
                    resizeMode="cover"
                />
                <Text className="font-bold text-xl text-primary self-start">Đăng nhập</Text>
                {/* Email */}
                <Text className="self-start mt-6 text-primary font-medium">Tên đăng nhập <Text className="text-error">*</Text></Text>
                <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                            className="w-full h-12 border border-[#ddd]  font-medium rounded-xl px-3 mt-2 bg-white"
                            placeholder="example@wellspring.edu.vn"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                        />
                    )}
                />
                {errors.email && <Text className="text-error self-start ml-2">{errors.email.message}</Text>}
                {/* Password */}
                <Text className="self-start mt-4 text-primary  font-medium">Mật khẩu <Text className="text-error">*</Text></Text>
                <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <View className="relative w-full">
                            <TextInput
                                className={`w-full h-12 border font-medium rounded-xl px-3 mt-2 bg-white pr-12 ${loginError ? 'border-error' : 'border-[#ddd]'}`}
                                placeholder="Nhập mật khẩu"
                                secureTextEntry={!showPassword}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                            />
                            <Pressable
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: '60%',
                                    transform: [{ translateY: -12 }],
                                    zIndex: 10,
                                }}
                                onPress={() => setShowPassword((prev) => !prev)}
                                hitSlop={8}
                            >
                                <VisibilityIcon width={24} height={24} />
                            </Pressable>
                        </View>
                    )}
                />
                {errors.password && <Text className="text-error self-start ml-2">{errors.password.message}</Text>}

                {/* Nút FaceID - luôn hiển thị */}
                <TouchableOpacity
                    className="items-center mt-6 mb-4"
                    onPress={handleBiometricLogin}
                    disabled={loading || isAuthenticating}
                    style={{ opacity: loading || isAuthenticating ? 0.5 : 1 }}
                >
                    {isAuthenticating ? (
                        <ActivityIndicator size="large" color="#009483" />
                    ) : (
                        <View className="items-center">
                                <FaceIdIcon width={62} height={62} color="#F05023" />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Nút đăng nhập */}
                <TouchableOpacity
                    className="w-full bg-secondary rounded-full py-3 items-center mt-2"
                    onPress={handleSubmit(onSubmit)}
                    disabled={loading || isAuthenticating}
                >
                    <Text className="text-white font-bold text-base">
                        {loading || isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </Text>
                </TouchableOpacity>

                {/* Quên mật khẩu */}
                <TouchableOpacity className="w-full items-center mt-4">
                    <Text className="text-text-secondary  font-medium text-base">Quên mật khẩu?</Text>
                </TouchableOpacity>

                {/* Phân cách */}
                <View className="flex-row items-center my-6">
                    <View className="flex-1 h-px bg-[#E0E0E0]" />
                    <Text className="mx-2 text-text-secondary  font-medium text-sm">Đăng nhập với phương thức khác</Text>
                    <View className="flex-1 h-px bg-[#E0E0E0]" />
                </View>

                {/* Nút đăng nhập Microsoft */}
                <TouchableOpacity
                    className="w-full flex-row items-center justify-center rounded-full bg-secondary/10 py-3 mb-2"
                    onPress={() => promptAsync()}
                >
                    <View style={{ marginRight: 8 }}>
                        <MicrosoftIcon width={20} height={20} />
                    </View>
                    <Text className="text-secondary font-bold text-base">Đăng nhập với Microsoft</Text>
                </TouchableOpacity>
            </View>
            <View className="absolute bottom-12 w-full items-center mt-4">
                <Text className="text-text-secondary  font-medium text-xs text-center mt-8">
                    © Copyright 2025 Wellspring International Bilingual Schools.{"\n"}All Rights Reserved.
                </Text>
            </View>
            <NotificationModal
                visible={showNotificationModal}
                type={notificationType}
                message={notificationMessage}
                onClose={() => setShowNotificationModal(false)}
            />
        </View>
    );
};

export default SignInScreen; 