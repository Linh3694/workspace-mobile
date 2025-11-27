import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { View, Text, TouchableOpacity, Animated, Easing, Dimensions, SafeAreaView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useMicrosoftAuthV2 } from '../../hooks/useMicrosoftAuthV2';
import MicrosoftIcon from '../../assets/microsoft.svg';
import { ROUTES } from '../../constants/routes';

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
  const { loginWithMicrosoft } = useAuth();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const BANNER_WIDTH = screenWidth; // Sử dụng screenWidth thay vì fixed 1100
  const BANNER_HEIGHT = Math.min(480, screenHeight * 0.5);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('error');

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬 Starting carousel animation with BANNER_WIDTH:', BANNER_WIDTH);
    translateX.setValue(0);

    const startCarousel = () => {
      Animated.timing(translateX, {
        toValue: -BANNER_WIDTH,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          // Reset to start position instantly for seamless loop
          translateX.setValue(0);
          // Start again
          startCarousel();
        }
      });
    };

    startCarousel();

    return () => {
      console.log('🛑 Stopping carousel animation');
      translateX.stopAnimation();
    };
  }, [BANNER_WIDTH]);

  const showNotification = (message: string, type: 'success' | 'error' = 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
  };

  const { promptAsync, isReady } = useMicrosoftAuthV2(
    async (authResponse) => {
      try {
        // Use the new loginWithMicrosoft method from AuthContext
        await loginWithMicrosoft(authResponse);

        showNotification(`Chào mừng ${authResponse.user?.full_name || ''}!`, 'success');
      } catch (error) {
        console.error('❌ [WelcomeScreen] Error processing Microsoft auth:', error);
        showNotification('Lỗi xử lý đăng nhập. Vui lòng thử lại.', 'error');
      }
    },
    (error, errorCode) => {
      // Show user-friendly error messages
      if (errorCode === 'USER_NOT_REGISTERED') {
        showNotification(error, 'error');
      } else if (errorCode === 'USER_CANCELLED') {
        // Don't show notification for user cancellation
        return;
      } else {
        showNotification(error || 'Đăng nhập Microsoft thất bại', 'error');
      }
    }
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="w-full flex-1">
        {/* Header section with logo - flex-1 to take available space */}
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center">
            <ApplogoFull width={390} height={80} />
            <View className="flex-row items-center justify-center mt-2">
              <Text className="text-lg uppercase font-extrabold text-[#F5AA1E]">Wellspring</Text>
              <Text className="text-lg uppercase font-extrabold text-[#BED232]"> Information System</Text>
            </View>
          </View>
        </View>

        {/* Banner section - flex-2 to take more space */}
        <View className="flex-2 w-full items-center justify-center">
          <View
            style={{
              width: screenWidth,
              height: BANNER_HEIGHT,
              overflow: 'hidden',
              alignItems: 'flex-start',
              justifyContent: 'center',
            }}>
            <Animated.View
              style={{
                flexDirection: 'row',
                width: BANNER_WIDTH * 3,
                height: BANNER_HEIGHT,
                transform: [{ translateX }],
              }}>
              <Image
                source={require('../../assets/welcome.webp')}
                resizeMode="contain"
                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                onError={(error) => console.log('❌ Image load error:', error.nativeEvent.error)}
                onLoad={() => console.log('✅ Image loaded successfully')}
              />
              <Image
                source={require('../../assets/welcome.webp')}
                resizeMode="contain"
                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                onError={(error) => console.log('❌ Image load error:', error.nativeEvent.error)}
                onLoad={() => console.log('✅ Image loaded successfully')}
              />
              <Image
                source={require('../../assets/welcome.webp')}
                resizeMode="contain"
                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                onError={(error) => console.log('❌ Image load error:', error.nativeEvent.error)}
                onLoad={() => console.log('✅ Image loaded successfully')}
              />
            </Animated.View>
          </View>
        </View>

        {/* Bottom section with buttons - flex-1 to take available space */}
        <View className="w-full flex-1 items-center justify-center px-6">
          <TouchableOpacity
            onPress={() => promptAsync()}
            disabled={!isReady}
            activeOpacity={0.7}
            className={`mb-4 w-full max-w-sm flex-row items-center justify-center rounded-full py-4 ${
              isReady ? 'bg-secondary/10' : 'bg-gray-200'
            }`}
          >
            <View style={{ marginRight: 8 }}>
              <MicrosoftIcon width={24} height={24} />
            </View>
            <Text className="font-bold text-secondary">Đăng nhập với Microsoft</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.SCREENS.LOGIN)}>
            <Text className="font-semibold text-base text-text-secondary">
              Đăng nhập bằng tài khoản
            </Text>
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
