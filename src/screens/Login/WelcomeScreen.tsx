import React, { useLayoutEffect, useRef, useState } from 'react';
// @ts-ignore
import { View, Text,TouchableOpacity, Animated, Easing, Dimensions, Image, Alert, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMicrosoftLogin } from '../../hooks/useMicrosoftLogin';
import MicrosoftIcon from '../../assets/microsoft.svg';
import { ROUTES } from '../../constants/routes';
import { API_BASE_URL } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import ApplogoFull from '../../assets/app-logo-full.svg';
import NotificationModal from '../../components/NotificationModal';

type RootStackParamList = {
    Welcome: undefined;
    Login: undefined;
    SignIn: undefined;
    Main: { screen: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WelcomeScreen = () => {
    
    const navigation = useNavigation<NavigationProp>();
    const { checkAuth } = useAuth();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const BANNER_WIDTH = 1100;
    const BANNER_HEIGHT = Math.min(480, screenHeight * 0.5);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState<'success' | 'error'>('error');

    const translateX = useRef(new Animated.Value(0)).current;

    useLayoutEffect(() => {
        let isMounted = true;
        const animate = () => {
            if (!isMounted) return;
            translateX.setValue(0);
            Animated.timing(translateX, {
                toValue: -BANNER_WIDTH,
                duration: 18000,
                easing: Easing.linear,
                useNativeDriver: true,
            }).start(() => {
                if (isMounted) animate();
            });
        };
        animate();
        return () => { isMounted = false; };
    }, [translateX]);

    const showNotification = (message: string, type: 'success' | 'error' = 'error') => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotificationModal(true);
    };

    const { promptAsync  } = useMicrosoftLogin(
        async (token) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/microsoft/login`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const authData = await response.json();
                
                if (response.ok && authData.success) {
                    const { token: systemToken, user } = authData;
                    
                    await AsyncStorage.setItem('authToken', systemToken);
                    await AsyncStorage.setItem('user', JSON.stringify(user));
                    await AsyncStorage.setItem('userId', user._id);
                    await AsyncStorage.setItem('userFullname', user.fullname);
                    await AsyncStorage.setItem('userRole', user.role);
                    await AsyncStorage.setItem('userEmployeeCode', user.employeeCode);
                    await AsyncStorage.setItem('userAvatarUrl', user.avatarUrl || '');
                    
                    await checkAuth();
                    
                    showNotification('Đăng nhập Microsoft thành công!', 'success');
                } else {
                    const errorMessage = authData.message || 'Xác thực Microsoft thất bại';
                    throw new Error(errorMessage);
                }
                
            } catch (error) {
                const errorMessage = error.message.includes('Tài khoản chưa đăng ký') 
                    ? 'Tài khoản chưa đăng ký' 
                    : 'Không thể đăng nhập với Microsoft';
                showNotification(errorMessage, 'error');
            }
        },
        (error) => {
            showNotification('Đăng nhập Microsoft thất bại', 'error');
        }
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 w-full">
                {/* Header section with logo - flex-1 to take available space */}
                <View className="flex-1 items-center justify-center px-6">
                    <View className="items-center">
                        <ApplogoFull width={390} height={80} />
                        <Text className="text-lg text-[#00687F] text-center mt-2" style={{ fontFamily: 'Mulish-Bold' }}>
                            Tối ưu vận hành, nâng tầm chất lượng
                        </Text>
                    </View>
                </View>

                {/* Banner section - flex-2 to take more space */}
                <View className="flex-2 w-full items-center justify-center">
                    <View
                        style={{
                            width: screenWidth,
                            height: BANNER_HEIGHT,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Animated.View
                            style={{
                                flexDirection: 'row',
                                width: BANNER_WIDTH * 3,
                                height: BANNER_HEIGHT,
                                transform: [{ translateX }],
                            }}
                        >
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                        </Animated.View>
                    </View>
                </View>

                {/* Bottom section with buttons - flex-1 to take available space */}
                <View className="flex-1 w-full items-center justify-center px-6">
                    <TouchableOpacity
                        onPress={() => promptAsync()}
                        className="w-full max-w-sm flex-row items-center justify-center rounded-full bg-secondary/10 py-4 mb-4"
                    >
                        <View style={{ marginRight: 8 }}>
                            <MicrosoftIcon width={24} height={24} />
                        </View>
                        <Text className="text-secondary font-bold">Đăng nhập với Microsoft</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.SCREENS.LOGIN)}>
                        <Text className="text-text-secondary text-base font-semibold">Đăng nhập bằng tài khoản</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <NotificationModal
                visible={showNotificationModal}
                type={notificationType}
                message={notificationMessage}
                onClose={() => setShowNotificationModal(false)}
            />
        </SafeAreaView>
    );
};

export default WelcomeScreen; 