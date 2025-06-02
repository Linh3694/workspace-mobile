import React, { useEffect, useRef, useState, useCallback } from 'react';
// @ts-ignore
import { Animated, Dimensions, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import { OnlineStatusProvider } from './src/context/OnlineStatusContext';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './src/navigation/AppNavigator';
import 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config/constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import CustomToastConfig from './src/components/CustomToastConfig';
import * as SplashScreen from 'expo-splash-screen';
import SvgSplash from './src/assets/splash.svg';
// @ts-ignore
import { Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';

import './global.css';

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
  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as {
      ticketId?: string;
      chatId?: string;
      type?: string;
      senderId?: string;
    };
    console.log('Phản hồi thông báo:', data);

    if (data?.type === 'new_ticket' || data?.type === 'ticket_update') {
      // Kiểm tra xem ứng dụng đã khởi tạo xong chưa
      if (navigationRef.current && data.ticketId) {
        // Nếu đã khởi tạo xong, điều hướng ngay
        navigationRef.current.navigate('TicketDetail', { ticketId: data.ticketId });
      } else if (data.ticketId) {
        // Nếu chưa khởi tạo xong, đặt route ban đầu
        setInitialRoute({
          name: 'TicketDetail',
          params: { ticketId: data.ticketId }
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
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
              const userData = await response.json();
              navigationRef.current?.navigate('ChatDetail', {
                chatId: data.chatId,
                user: userData
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
            senderId: data.senderId
          }
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
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
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
              <NavigationContainer
                ref={navigationRef}
                linking={linking}
              >
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
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: sweep }] },
          ]}
        >
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
