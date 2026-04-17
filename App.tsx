import React, { useCallback, useEffect, useRef } from 'react';
// @ts-ignore
import { View, StyleSheet, Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import {
  navigateFromPushNotificationData,
  consumePendingPushNotificationIfAny,
  type PushNotificationPayload,
} from './src/utils/pushNotificationNavigation';
import { useAuth } from './src/context/AuthContext';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config/constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, ToastInitializer, toast } from './src/components/Toast';
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
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import VersionChecker from './src/components/VersionChecker';

// Cấu hình linking cho deep links
const linking = {
  prefixes: [Linking.createURL('/'), 'staffportal://'],
  config: {
    screens: {
      // Deep link auth/success chỉ dành cho màn hình Login
      // Sau khi đăng nhập thành công, AuthContext sẽ tự chuyển sang Main
      Login: 'auth/success',
      Main: {
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

const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Sau khi đăng nhập + navigator mount, xử lý payload push lưu tạm (cold start / race) */
function PendingPushNotificationConsumer() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const timer = setTimeout(() => {
      consumePendingPushNotificationIfAny(navigationRef);
    }, 600);
    return () => clearTimeout(timer);
  }, [loading, isAuthenticated]);

  return null;
}

export default function App() {
  // Ẩn native splash ngay lập tức để hiển thị custom splash
  useEffect(() => {
    (async () => {
      // Ẩn native splash ngay khi app mount
      await SplashScreen.hideAsync();
    })();
  }, []);

  // Load custom fonts
  const [fontsLoaded] = useFonts({
    'Mulish-Regular': require('./src/assets/fonts/Mulish-Regular.ttf'),
    'Mulish-Italic': require('./src/assets/fonts/Mulish-Italic.ttf'),
    'Mulish-Medium': require('./src/assets/fonts/Mulish-Medium.ttf'),
    'Mulish-Bold': require('./src/assets/fonts/Mulish-Bold.ttf'),
    'Mulish-SemiBold': require('./src/assets/fonts/Mulish-SemiBold.ttf'),
    'Mulish-ExtraBold': require('./src/assets/fonts/Mulish-ExtraBold.ttf'),
    'Mulish-Black': require('./src/assets/fonts/Mulish-Black.ttf'),
    'SpaceMono-Regular': require('./src/assets/fonts/SpaceMono-Regular.ttf'),
  });

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Deep link handler (kept as before)
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
            toast.error('Lỗi đăng nhập Microsoft: ' + error);
            return;
          }

          if (token) {
            console.log('✅ [App] Deep link token received, saving...');
            await AsyncStorage.setItem('authToken', token);
            toast.success('Đăng nhập Microsoft thành công!');
          }
        } catch (err) {
          console.error('❌ [App] Error parsing deep link:', err);
        }
      }
    };

    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('🔍 [App] Initial URL:', initialUrl);
        handleDeepLink(initialUrl);
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔍 [App] URL event:', event.url);
      handleDeepLink(event.url);
    });

    getInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  // Xử lý điều hướng khi người dùng tương tác với thông báo (đồng bộ logic trong pushNotificationNavigation)
  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as PushNotificationPayload;
      console.log('🔔 Phản hồi thông báo:', data);

      try {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier);
        await Notifications.setBadgeCountAsync(0);
        console.log('✅ Notification cleared from lock screen');
      } catch (error) {
        console.warn('⚠️ Could not clear notification:', error);
      }

      await navigateFromPushNotificationData(data, navigationRef);
    },
    []
  );

  // Register notification listeners and setup push token registration
  useEffect(() => {
    // Listener when a notification is received while app is foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Thông báo nhận được:', notification);
    });

    // Listener when the user interacts with a notification (tap, action)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Setup push notifications registration
    const setupPushNotifications = async () => {
      if (!Device.isDevice) {
        console.log('Thiết bị giả lập không hỗ trợ thông báo đẩy!');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Bạn cần cấp quyền thông báo để nhận thông báo!');
        return;
      }

      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.error('Không tìm thấy projectId trong app.json');
          return;
        }

        // Xác định app type (expo-go vs standalone) - QUAN TRỌNG cho iOS TestFlight
        const isStandalone = Constants.appOwnership !== 'expo';
        const appType = isStandalone ? 'standalone' : 'expo-go';

        console.log(`📱 App.tsx - App type: ${appType}, ProjectId: ${projectId}`);

        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log(`📱 App.tsx Push token (${appType}):`, token.data);
        await AsyncStorage.setItem('pushToken', token.data);
        await AsyncStorage.setItem('pushTokenAppType', appType);

        const registerDeviceToken = async (tokenStr: string) => {
          try {
            const authToken = await AsyncStorage.getItem('authToken');
            if (!authToken) {
              console.log('⏰ User chưa đăng nhập, sẽ thử lại sau...');
              setTimeout(() => registerDeviceToken(tokenStr), 5000);
              return;
            }

            const platform =
              Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
            const deviceName =
              Device.deviceName || `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'}`;
            const osVersion = Device.osVersion || 'Unknown';
            const appVersion =
              Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0';

            // Tạo unique device identifier để phân biệt Expo Go và standalone app
            const deviceId = `${Device.modelId || Device.modelName || 'unknown'}-${Platform.OS}-${appType}`;

            const deviceInfo = {
              deviceToken: tokenStr,
              platform: platform,
              deviceName: deviceName,
              os: Platform.OS,
              osVersion: osVersion,
              appVersion: appVersion,
              language: 'vi',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              // Thêm thông tin để phân biệt app type
              appType: appType, // 'standalone' cho TestFlight/App Store, 'expo-go' cho Expo Go
              deviceId: deviceId, // Unique ID để backend phân biệt các devices
              bundleId: Constants.expoConfig?.ios?.bundleIdentifier || 'com.wellspring.workspace',
            };

            console.log(
              '📤 App.tsx Registering device with info:',
              JSON.stringify(deviceInfo, null, 2)
            );

            const response = await axios.post(
              `${API_BASE_URL}/api/method/erp.api.erp_sis.mobile_push_notification.register_device_token`,
              deviceInfo,
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );

            console.log(
              `✅ App.tsx Push token registered successfully for ${appType}:`,
              response.data
            );
          } catch (error) {
            console.error('❌ App.tsx Lỗi đăng ký token thiết bị:', error);
          }
        };

        // Register with a short delay to give app time to set auth token
        setTimeout(() => registerDeviceToken(token.data), 2000);
      } catch (error) {
        console.error('❌ Lỗi khi thiết lập thông báo đẩy:', error);
      }
    };

    setupPushNotifications();

    // Check for initial notification that opened the app
    (async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handleNotificationResponse(lastResponse);
        }
      } catch (e) {
        console.warn('Could not get last notification response', e);
      }
    })();

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [handleNotificationResponse]);

  console.log('🔍 [App] fontsLoaded (forced):', fontsLoaded);

  // Lấy version từ package.json
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  // Hiển thị màn hình trống trong khi fonts đang load (native splash đã ẩn)
  if (!fontsLoaded) {
    return (
      <View style={styles.splashContainer}>
        <SvgSplash width={200} height={200} />
        <Text style={styles.versionText}>v{appVersion}</Text>
      </View>
    );
  }

  return (
    // @ts-ignore - GestureHandlerRootView types issue
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ToastInitializer />
            <AuthProvider>
              <VersionChecker>
                <NavigationContainer linking={linking} ref={navigationRef}>
                  <AppNavigator />
                  <PendingPushNotificationConsumer />
                </NavigationContainer>
              </VersionChecker>
            </AuthProvider>
            <StatusBar style="auto" />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  versionText: {
    marginTop: 20,
    fontSize: 14,
    color: '#FFC107',
    fontWeight: '600',
  },
});
