import React, { useEffect, useRef, useState, useCallback } from 'react';
// @ts-ignore
import { Animated, Dimensions, View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { OnlineStatusProvider } from './src/context/OnlineStatusContext';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config/constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import socketService from './src/services/socketService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import CustomToastConfig from './src/components/CustomToastConfig';
import * as SplashScreen from 'expo-splash-screen';
import SvgSplash from './src/assets/splash.svg';
// @ts-ignore
import { Image } from 'react-native';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import axios from 'axios';
import * as Font from 'expo-font';

import './global.css';
import './src/config/i18n';

// Cấu hình linking cho deep links
const linking = {
  prefixes: [Linking.createURL('/'), 'staffportal://'],
  config: {
    screens: {
      // Xử lý deep link cho Microsoft auth
      Welcome: 'auth/success',
      Login: 'auth/success',
      Main: {
        path: 'auth/success',
        screens: {
          Home: 'home',
        },
      },
    },
  },
};

// Thiết lập cách xử lý thông báo khi ứng dụng đang chạy
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  // Prevent splash auto-hide immediately
  useEffect(() => {
    (async () => {
      await SplashScreen.preventAutoHideAsync();
    })();
  }, []);

  const [fontsLoaded] = useFonts({
    'Mulish-Regular': require('./src/assets/fonts/Mulish-Regular.ttf'),
    'Mulish-Italic': require('./src/assets/fonts/Mulish-Italic.ttf'),
    'Mulish-Medium': require('./src/assets/fonts/Mulish-Medium.ttf'),
    'Mulish-MediumItalic': require('./src/assets/fonts/Mulish-MediumItalic.ttf'),
    'Mulish-SemiBold': require('./src/assets/fonts/Mulish-SemiBold.ttf'),
    'Mulish-SemiBoldItalic': require('./src/assets/fonts/Mulish-SemiBoldItalic.ttf'),
    'Mulish-Bold': require('./src/assets/fonts/Mulish-Bold.ttf'),
    'Mulish-BoldItalic': require('./src/assets/fonts/Mulish-BoldItalic.ttf'),
    'Mulish-ExtraBold': require('./src/assets/fonts/Mulish-ExtraBold.ttf'),
    'Mulish-ExtraBoldItalic': require('./src/assets/fonts/Mulish-ExtraBoldItalic.ttf'),
    'Mulish-Light': require('./src/assets/fonts/Mulish-Light.ttf'),
    'Mulish-LightItalic': require('./src/assets/fonts/Mulish-LightItalic.ttf'),
    'Mulish-ExtraLight': require('./src/assets/fonts/Mulish-ExtraLight.ttf'),
    'Mulish-ExtraLightItalic': require('./src/assets/fonts/Mulish-ExtraLightItalic.ttf'),
    'Mulish-Black': require('./src/assets/fonts/Mulish-Black.ttf'),
    'Mulish-BlackItalic': require('./src/assets/fonts/Mulish-BlackItalic.ttf'),
    'SpaceMono-Regular': require('./src/assets/fonts/SpaceMono-Regular.ttf'),
  });

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [initialRoute, setInitialRoute] = useState({ name: 'Home', params: {} });

  // Sweep animation setup
  const { width } = Dimensions.get('window');
  const sweep = useRef(new Animated.Value(-width)).current;

  // Xử lý deep link từ Microsoft authentication
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('🔍 [App] Deep link received:', url);

      if (url.includes('staffportal://auth/success')) {
        try {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const error = urlObj.searchParams.get('error');

          console.log('🔍 [App] Deep link params:', { token: !!token, error });

          if (error) {
            console.log('❌ [App] Deep link error:', error);
            Toast.show({
              type: 'error',
              text1: 'Lỗi đăng nhập Microsoft',
              text2: error,
            });
            return;
          }

          if (token) {
            console.log('✅ [App] Deep link token received, saving...');

            // Lưu token vào AsyncStorage
            await AsyncStorage.setItem('authToken', token);

            // Có thể thêm logic để fetch user info từ token ở đây
            Toast.show({
              type: 'success',
              text1: 'Đăng nhập Microsoft thành công!',
            });

            // Navigate to main app (sẽ được xử lý bởi AuthContext)
            // Context sẽ detect token và chuyển màn hình
          }
        } catch (err) {
          console.error('❌ [App] Error parsing deep link:', err);
        }
      }
    };

    // Xử lý URL khi app được mở từ deep link
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('🔍 [App] Initial URL:', initialUrl);
        handleDeepLink(initialUrl);
      }
    };

    // Lắng nghe deep link khi app đang chạy
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔍 [App] URL event:', event.url);
      handleDeepLink(event.url);
    });

    getInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  // Splash sweep and hide handled on layout
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      Animated.timing(sweep, {
        toValue: width,
        duration: 800,
        useNativeDriver: true,
      }).start(async () => {
        await SplashScreen.hideAsync();
      });
    }
  }, [fontsLoaded, sweep, width]);

  // Xử lý điều hướng khi nhận được thông báo
  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as {
      ticketId?: string;
      chatId?: string;
      type?: string;
      senderId?: string;
      employeeCode?: string;
      notificationId?: string;
    };
    console.log('🔔 Phản hồi thông báo:', data);

    // Clear notification từ lock screen/notification center
    try {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);
      await Notifications.setBadgeCountAsync(0);
      console.log('✅ Notification cleared from lock screen');
    } catch (error) {
      console.warn('⚠️ Could not clear notification:', error);
    }

    if (data?.type === 'new_ticket' || data?.type === 'ticket_update') {
      // Kiểm tra xem ứng dụng đã khởi tạo xong chưa
      if (navigationRef.current && data.ticketId) {
        // Nếu đã khởi tạo xong, điều hướng ngay
        navigationRef.current.navigate('TicketDetail', { ticketId: data.ticketId });
      } else if (data.ticketId) {
        // Nếu chưa khởi tạo xong, đặt route ban đầu
        setInitialRoute({
          name: 'TicketDetail',
          params: { ticketId: data.ticketId },
        });
      }
    } else if (data?.type === 'attendance' || data?.type === 'staff_attendance') {
      // Xử lý khi nhận thông báo chấm công - Navigate đến NotificationsScreen
      console.log('📋 Nhận thông báo chấm công cho nhân viên:', data.employeeCode);

      if (navigationRef.current) {
        // Navigate đến NotificationsScreen để xem chi tiết
        navigationRef.current.navigate('Main', {
          screen: 'Notification',
          params: data.notificationId ? { notificationId: data.notificationId } : undefined,
        });
      } else {
        // Nếu chưa khởi tạo xong, đặt route ban đầu
        setInitialRoute({
          name: 'Main',
          params: {
            screen: 'Notification',
            params: data.notificationId ? { notificationId: data.notificationId } : undefined,
          },
        });
      }
    } else if (data?.type === 'new_chat_message') {
      // Xử lý khi nhận thông báo tin nhắn chat
      if (navigationRef.current && data.chatId && data.senderId) {
        // Tìm thông tin người gửi
        const fetchUserAndNavigate = async () => {
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/api/users/${data.senderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
              const userData = await response.json();
              navigationRef.current?.navigate('ChatDetail', {
                chatId: data.chatId,
                user: userData,
              });
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        };

        fetchUserAndNavigate();
      } else if (data.chatId && data.senderId) {
        // Lưu thông tin để điều hướng sau khi khởi động
        setInitialRoute({
          name: 'ChatInit',
          params: {
            chatId: data.chatId,
            senderId: data.senderId,
          },
        });
      }
    }
  };

  useEffect(() => {
    // Lắng nghe khi nhận được thông báo (ứng dụng đang chạy)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Thông báo nhận được:', notification);
    });

    // Lắng nghe khi người dùng tương tác với thông báo
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Setup push notifications khi app khởi động
  useEffect(() => {
    const setupPushNotifications = async () => {
      // Kiểm tra xem thiết bị có phải là thiết bị thật không
      if (!Device.isDevice) {
        console.log('Thiết bị giả lập không hỗ trợ thông báo đẩy!');
        return;
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
        console.log('Bạn cần cấp quyền thông báo để nhận thông báo!');
        return;
      }

      try {
        // Lấy projectId từ Constants
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
          console.error('Không tìm thấy projectId trong app.json');
          return;
        }

        // Lấy token thiết bị
        const token = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        console.log('📱 App.tsx Push token:', token.data);

        // Lưu token vào AsyncStorage
        await AsyncStorage.setItem('pushToken', token.data);

        // Gửi token lên server
        setTimeout(() => registerDeviceToken(token.data), 2000); // Delay để đảm bảo auth token đã có
      } catch (error) {
        console.error('❌ Lỗi khi thiết lập thông báo đẩy:', error);
      }
    };

    // Đăng ký token thiết bị với server
    const registerDeviceToken = async (token: string) => {
      try {
        const authToken = await AsyncStorage.getItem('authToken');

        if (!authToken) {
          console.log('⏰ User chưa đăng nhập, sẽ thử lại sau...');
          // Thử lại sau 5 giây
          setTimeout(() => registerDeviceToken(token), 5000);
          return;
        }

        // Debug: Decode JWT để thấy user info
        try {
          const base64Url = authToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          console.log('🔍 App.tsx JWT full payload:', decoded);
          console.log('🔍 App.tsx JWT user info:', {
            userId: decoded.userId || decoded.name || decoded.sub,
            employeeId: decoded.employee_id || decoded.employeeId || decoded.employeeCode,
            fullname: decoded.fullname || decoded.full_name || decoded.name,
            email: decoded.email,
          });
        } catch (jwtError) {
          console.warn('❌ Could not decode JWT:', jwtError);
        }

        // Lấy thông tin device
        const platform =
          Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
        const deviceName =
          Device.deviceName || `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'}`;
        const osVersion = Device.osVersion || 'Unknown';
        const appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

        const deviceInfo = {
          deviceToken: token,
          platform: platform,
          deviceName: deviceName,
          os: Platform.OS,
          osVersion: osVersion,
          appVersion: appVersion,
          language: 'vi',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        };

        console.log(
          '📤 App.tsx Registering device with info:',
          JSON.stringify(deviceInfo, null, 2)
        );

        const response = await axios.post(
          `${API_BASE_URL}/api/notification/register-device`,
          deviceInfo,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        console.log('✅ App.tsx Push token registered successfully:', response.data);
      } catch (error) {
        console.error('❌ App.tsx Lỗi đăng ký token thiết bị:', error);
      }
    };

    setupPushNotifications();

    // Kết nối socket khi app khởi động (nếu đã có auth token)
    const initSocket = async () => {
      const authToken = await AsyncStorage.getItem('authToken');
      if (authToken) {
        try {
          const base64Url = authToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          const userId = decoded.userId || decoded.name || decoded.sub;

          console.log('🔌 App.tsx: Connecting socket for user:', userId);
          await socketService.connect(userId);
          socketService.setUserOnline();
        } catch (error) {
          console.error('❌ App.tsx: Error connecting socket:', error);
        }
      }
    };

    initSocket();
  }, []);

  // Kiểm tra xem có thông báo nào mở ứng dụng không
  useEffect(() => {
    const getInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        handleNotificationResponse(response);
      }
    };

    getInitialNotification();
  }, []);

  // (Sweep/hide effect handled by onLayoutRootView)

  if (!fontsLoaded) {
    return (
      <View style={styles.splashContainer}>
        <SvgSplash width={200} height={200} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      {/* @ts-ignore */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <OnlineStatusProvider>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <AppNavigator />
              </NavigationContainer>
              <StatusBar style="auto" />
              <Toast config={CustomToastConfig} topOffset={60} />
            </OnlineStatusProvider>
          </AuthProvider>
        </SafeAreaProvider>
        {/* Sweep overlay */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: sweep }] }]}>
          {/* @ts-ignore */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </GestureHandlerRootView>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
