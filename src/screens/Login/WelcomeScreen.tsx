import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  SafeAreaView,
  Image,
  StyleSheet,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

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

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_ASPECT_RATIO = 1567 / 480;
const BANNER_HEIGHT = Math.min(280, SCREEN_HEIGHT * 0.35);
const ACTUAL_IMAGE_WIDTH = BANNER_HEIGHT * IMAGE_ASPECT_RATIO;

const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { loginWithMicrosoft } = useAuth();
  
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('error');

  // Reanimated shared value
  const translateX = useSharedValue(0);

  useEffect(() => {
    console.log('🎬 Starting carousel with reanimated, width:', ACTUAL_IMAGE_WIDTH);
    
    // Start infinite scroll animation
    translateX.value = withRepeat(
      withTiming(-ACTUAL_IMAGE_WIDTH, {
        duration: 15000, // 25 seconds per cycle
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, []);

  // Animated style for the scrolling container
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
        {/* Header section with logo */}
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center">
            {/* Logo */}
            <ApplogoFull width={340} height={70} />
            
            {/* App name with gradient */}
            {/* <View style={styles.titleContainer}>
              <MaskedView
                maskElement={
                  <Text style={styles.appTitle}>WIS</Text>
                }>
                <LinearGradient
                  colors={['#F5AA1E', '#F05023']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}>
                  <Text style={[styles.appTitle, { opacity: 0 }]}>WIS</Text>
                </LinearGradient>
              </MaskedView>
            </View> */}

            {/* Subtitle */}
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitleWellspring}>WELLSPRING</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitleSystem}>School Information System</Text>
            </View>
          </View>
        </View>

        {/* Banner section - scrolling collage */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerWrapper}>
            <Reanimated.View style={[styles.scrollingContainer, animatedStyle] as any}>
              <Image
                source={require('../../assets/welcome.webp')}
                resizeMode="cover"
                style={styles.bannerImage}
              />
              <Image
                source={require('../../assets/welcome.webp')}
                resizeMode="cover"
                style={styles.bannerImage}
              />
            </Reanimated.View>
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
            <Text className="font-medium text-sm text-[#64748B]">
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

const styles = StyleSheet.create({
  titleContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 6,
    backgroundColor: 'transparent',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  subtitleWellspring: {
    fontSize: 13,
    fontWeight: '700',
    color: '#002855',
    letterSpacing: 2,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
  subtitleSystem: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  bannerContainer: {
    flex: 2,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerWrapper: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    overflow: 'hidden',
  },
  scrollingContainer: {
    flexDirection: 'row',
    width: ACTUAL_IMAGE_WIDTH * 2,
    height: BANNER_HEIGHT,
  },
  bannerImage: {
    width: ACTUAL_IMAGE_WIDTH,
    height: BANNER_HEIGHT,
  },
});

export default WelcomeScreen;
