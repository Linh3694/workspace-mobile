import React, { useEffect, useRef, useState, useCallback } from 'react';
// @ts-ignore
import { Animated, Dimensions, View, StyleSheet, Platform, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config/constants';
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
import { AuthProvider } from './src/context/AuthContext';

// Cấu hình linking cho deep links
const linking = {
  prefixes: [Linking.createURL('/'), 'staffportal://'],
  config: {
    screens: {
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

  // Temporarily disable fonts loading to test
  const fontsLoaded = true; // replace with useFonts(...) when you re-enable

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [initialRoute, setInitialRoute] = useState({ name: 'Home', params: {} });

  // Sweep animation setup
  const { width } = Dimensions.get('window');
  const sweep = useRef(new Animated.Value(-width)).current;

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
            Toast.show({
              type: 'error',
              text1: 'Lỗi đăng nhập Microsoft',
              text2: error,
            });
            return;
          }

          if (token) {
            console.log('✅ [App] Deep link token received, saving...');
            await AsyncStorage.setItem('authToken', token);
            Toast.show({ type: 'success', text1: 'Đăng nhập Microsoft thành công!' });
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

  // Xử lý điều hướng khi người dùng tương tác với thông báo
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

    try {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);
      await Notifications.setBadgeCountAsync(0);
      console.log('✅ Notification cleared from lock screen');
    } catch (error) {
      console.warn('⚠️ Could not clear notification:', error);
    }

    if (data?.type === 'new_ticket' || data?.type === 'ticket_update') {
      if (navigationRef.current && data.ticketId) {
        navigationRef.current.navigate('TicketDetail', { ticketId: data.ticketId });
      } else if (data.ticketId) {
        setInitialRoute({ name: 'TicketDetail', params: { ticketId: data.ticketId } });
      }
    } else if (data?.type === 'attendance' || data?.type === 'staff_attendance') {
      if (navigationRef.current) {
        navigationRef.current.navigate('Main', {
          screen: 'Notification',
          params: data.notificationId ? { notificationId: data.notificationId } : undefined,
        });
      } else {
        setInitialRoute({
          name: 'Main',
          params: {
            screen: 'Notification',
            params: data.notificationId ? { notificationId: data.notificationId } : undefined,
          },
        });
      }
    }
  };

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

        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log('📱 App.tsx Push token:', token.data);
        await AsyncStorage.setItem('pushToken', token.data);

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
              Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

            const deviceInfo = {
              deviceToken: tokenStr,
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

  console.log('🔍 [App] fontsLoaded (forced):', fontsLoaded);

  if (!fontsLoaded) {
    return (
      <View style={styles.splashContainer} onLayout={onLayoutRootView}>
        <SvgSplash width={200} height={200} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer linking={linking} ref={navigationRef}>
            <AppNavigator />
          </NavigationContainer>
          <Toast config={CustomToastConfig} />
        </AuthProvider>
        <StatusBar style="auto" />
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
});
