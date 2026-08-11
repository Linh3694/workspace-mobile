import './src/utils/axiosDefaults';
import React, { useCallback, useEffect, useRef } from 'react';
// @ts-ignore
import { View, StyleSheet, Text } from 'react-native';
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
import { Audio } from 'expo-av';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, ToastInitializer, toast } from './src/components/Toast';
import * as SplashScreen from 'expo-splash-screen';
import SvgSplash from './src/assets/splash.svg';
// @ts-ignore
import { Image } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as Font from 'expo-font';

import './global.css';
import './src/config/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import VersionChecker from './src/components/VersionChecker';
import { ChatMessageNotificationProvider } from './src/providers/ChatMessageNotificationProvider';
import { NotificationInboxSocketProvider } from './src/providers/NotificationInboxSocketProvider';

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

/**
 * Dấu vết cú bấm thông báo đã xử lý ở lần mở app trước — phải BỀN qua các lần
 * khởi động, vì `getLastNotificationResponseAsync()` vẫn trả về đúng cú bấm cũ
 * ở mọi lần mở lạnh tiếp theo (Android giữ Intent khởi chạy của task).
 */
const HANDLED_COLD_START_KEY = 'handled_coldstart_notification_v1';

/** Khoá nhận dạng một response: id + payload, đủ ổn định qua các lần phát lại. */
function coldStartResponseKey(response: Notifications.NotificationResponse): string {
  const request = response.notification?.request;
  const identifier = request?.identifier ?? '';
  let payload = '';
  try {
    payload = JSON.stringify(request?.content?.data ?? {});
  } catch {
    // Payload có vòng lặp tham chiếu — hiếm, rơi về chỉ dùng identifier.
    payload = '';
  }
  return `${identifier}|${payload}`.slice(0, 1024);
}

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
  /**
   * Cấu hình phiên âm thanh MỘT LẦN lúc khởi động — nếu không, video phát KHÔNG
   * CÓ TIẾNG khi máy đang gạt công tắc im lặng (03/08/2026).
   *
   * Mặc định của iOS là `playsInSilentModeIOS: false`, tức mọi âm thanh do app
   * phát đều bị công tắc im lặng tắt. Với chuông báo thì đúng, nhưng với video
   * người dùng CHỦ ĐỘNG bấm play thì sai — Messenger, Zalo, Instagram đều bật
   * cờ này. Triệu chứng khó đoán vì nó im lặng ở CẢ chat lẫn Bảng tin, và người
   * dùng thường không nghĩ tới cái gạt bên hông máy.
   *
   * `soundService` cũng gọi setAudioModeAsync nhưng chỉ khi phát âm báo ticket,
   * nên video không bao giờ hưởng cấu hình đó.
   */
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch((e) => console.warn('[App] không đặt được audio mode:', e));
  }, []);

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
    // Định dạng chữ trong chat: RN chọn font theo TÊN HỌ, `fontWeight`/`fontStyle` bị bỏ qua khi
    // đã chỉ định fontFamily ⇒ in đậm/nghiêng phải có file riêng. Xem ChatFormattedText.
    'Mulish-MediumItalic': require('./src/assets/fonts/Mulish-MediumItalic.ttf'),
    'Mulish-BoldItalic': require('./src/assets/fonts/Mulish-BoldItalic.ttf'),
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

    // Đăng ký push token: ủy quyền toàn bộ cho pushNotificationService (đường duy nhất).
    // Service tự xin quyền, lấy Expo token, đăng ký notification-service + Frappe;
    // nếu lúc này chưa có authToken, AuthContext sẽ gọi initialize() lại sau khi login
    // và service tự đăng ký nốt phần backend.
    (async () => {
      try {
        const { default: pushNotificationService } = await import(
          './src/services/pushNotificationService'
        );
        await pushNotificationService.initialize();
      } catch (error) {
        console.error('❌ Lỗi khi thiết lập thông báo đẩy:', error);
      }
    })();

    // Check for initial notification that opened the app
    (async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (!lastResponse) return;

        // Android giữ lại Intent khởi chạy của task (`launchMode="singleTask"`) và
        // expo-notifications dựng lại "cú bấm" từ extras của Intent đó ở mỗi
        // `onCreate`. `clearLastNotificationResponseAsync` chỉ xoá biến trong RAM
        // của module native nên không sống qua lần mở app sau ⇒ mở app bằng icon
        // cũng bị deep-link như vừa bấm thông báo. Phải tự nhớ cú đã xử lý.
        const key = coldStartResponseKey(lastResponse);
        const handledKey = await AsyncStorage.getItem(HANDLED_COLD_START_KEY);
        if (handledKey === key) {
          await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
          return;
        }
        await AsyncStorage.setItem(HANDLED_COLD_START_KEY, key);

        handleNotificationResponse(lastResponse);
        // Trong CÙNG phiên này thì không phát lại nữa
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
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
              <NotificationInboxSocketProvider>
              <ChatMessageNotificationProvider>
                <VersionChecker>
                  <NavigationContainer linking={linking} ref={navigationRef}>
                    <AppNavigator />
                    <PendingPushNotificationConsumer />
                  </NavigationContainer>
                </VersionChecker>
              </ChatMessageNotificationProvider>
              </NotificationInboxSocketProvider>
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
