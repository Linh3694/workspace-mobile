import React, { useState, useEffect } from 'react';
// @ts-ignore
import { View, Text, Switch, Alert, Image, ScrollView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
// Biometric removed per requirement
import { useLanguage } from '../../hooks/useLanguage';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';
import Wismelogo from '../../assets/wisme.svg';
import { getAvatar } from '../../utils/avatar';
import { BASE_URL } from '../../config/constants.js';
// FaceID icon removed per requirement
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import axios from 'axios';
import StandardHeader from '../../components/Common/StandardHeader';
import SelectModal from '../../components/SelectModal';
import attendanceService from '../../services/attendanceService';
import {
  sendTestLocalNotification,
  sendTestAttendanceNotification,
  sendTestTicketNotification,
  getNotificationDebugInfo,
} from '../../utils/testNotifications';

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { logout, user, refreshUserData } = useAuth();
  // Biometric hooks removed
  const { getCurrentLanguageName, showLanguageSelector, t } = useLanguage();
  // const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // const [showPasswordModal, setShowPasswordModal] = useState(false);
  // const [showConfirmModal, setShowConfirmModal] = useState(false);
  // const [password, setPassword] = useState('');
  // const [showPassword, setShowPassword] = useState(false);
  // const [isLoading, setIsLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [campusOptions, setCampusOptions] = useState<
    { name: string; title_vn?: string; title_en?: string }[]
  >([]);
  const [campusSelectorVisible, setCampusSelectorVisible] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null); // stores campus_id like campus-1
  // Debug user avatar fields when user changes
  useEffect(() => {
    if (user) {
      console.log('[Profile] user avatar fields:', {
        avatar: (user as any).avatar,
        avatarUrl: (user as any).avatarUrl,
        avatar_url: (user as any).avatar_url,
        user_image: (user as any).user_image,
        fullname: user.fullname,
      });
    }
  }, [user]);

  // Helper: derive campuses from roles like web FE
  const buildCampusesFromRoles = React.useCallback(() => {
    try {
      const roles: string[] = Array.isArray((user as any)?.roles) ? (user as any).roles : [];
      const campusRoles = roles.filter((r) => typeof r === 'string' && r.startsWith('Campus '));
      return campusRoles.map((role: string, idx: number) => {
        const title = role.replace('Campus ', '').trim();
        return { name: `campus-${idx + 1}`, title_vn: title, title_en: title };
      });
    } catch {
      return [] as { name: string; title_vn?: string; title_en?: string }[];
    }
  }, [user?.roles]);

  // Load campuses for selector
  useEffect(() => {
    (async () => {
      try {
        const cachedId = await AsyncStorage.getItem('currentCampusId');
        if (cachedId) setSelectedCampus(cachedId);
      } catch {}
      try {
        let rows = await attendanceService.fetchCampuses();
        if (!rows || rows.length === 0) {
          rows = buildCampusesFromRoles();
        }
        setCampusOptions(rows || []);
        // Default selection: try saved title mapping or first
        if (!selectedCampus && rows && rows.length > 0) {
          const savedTitle = await AsyncStorage.getItem('selectedCampus');
          if (savedTitle) {
            const hit = rows.find(
              (c) => c.title_vn === savedTitle || c.title_en === savedTitle || c.name === savedTitle
            );
            if (hit) {
              await AsyncStorage.setItem('currentCampusId', hit.name);
              setSelectedCampus(hit.name);
              return;
            }
          }
          await AsyncStorage.setItem('currentCampusId', rows[0].name);
          await AsyncStorage.setItem(
            'selectedCampus',
            rows[0].title_vn || rows[0].title_en || rows[0].name
          );
          setSelectedCampus(rows[0].name);
        }
      } catch {}
    })();
  }, [buildCampusesFromRoles]);

  // Kiểm tra xem sinh trắc học có được bật không
  // Biometric toggle removed

  // Kiểm tra trạng thái thông báo khi component mount
  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  // Removed biometric enable flow

  // Removed biometric save password flow

  // Removed biometric toggle

  // Removed biometric disable flow

  const handleImageError = () => {
    if (!avatarError) {
      // Only mark error once per session
    }
    setAvatarError(true);
  };

  const getFallbackAvatar = () => {
    if (!user)
      return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff&size=200';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff&size=200&font-size=0.5`;
  };

  // Kiểm tra trạng thái thông báo đẩy
  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const savedStatus = await AsyncStorage.getItem('notificationsEnabled');
      setNotificationsEnabled(status === 'granted' && savedStatus === 'true');
    } catch (error) {
      console.error('Lỗi khi kiểm tra trạng thái thông báo:', error);
    }
  };

  // Cài đặt thông báo đẩy
  const setupPushNotifications = async () => {
    // Kiểm tra xem thiết bị có phải là thiết bị thật không
    // Cho phép emulator trong DEV mode để test
    if (!Device.isDevice && !__DEV__) {
      Alert.alert(t('profile.notifications'), t('notifications.simulator_not_supported'));
      return false;
    }
    
    if (!Device.isDevice && __DEV__) {
      console.log('⚠️ Running on emulator in DEV mode - attempting push notification setup...');
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
      Alert.alert(t('profile.notifications'), t('notifications.permission_required'));
      return false;
    }

    // Thiết lập kênh thông báo cho Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    try {
      // Lấy projectId từ Constants
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error('❌ Không tìm thấy projectId trong app.json');
        Alert.alert(t('common.error'), 'Không tìm thấy cấu hình push notification');
        return false;
      }

      console.log('📱 Getting Expo Push Token with projectId:', projectId);

      // Lấy token thiết bị
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('📱 Push token obtained:', token.data);

      // Lưu token vào AsyncStorage để sử dụng sau này
      await AsyncStorage.setItem('pushToken', token.data);

      // Gửi token lên server và check kết quả
      const registerSuccess = await registerDeviceToken(token.data);

      if (!registerSuccess) {
        console.error('❌ Đăng ký token với server thất bại');
        return false;
      }

      console.log('✅ Push notification setup completed successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Lỗi khi thiết lập thông báo đẩy:', error);
      console.error('Error details:', error.message || error);

      // Kiểm tra lỗi Firebase không được khởi tạo (Android)
      const errorMessage = error.message || '';
      if (
        errorMessage.includes('FirebaseApp is not initialized') ||
        errorMessage.includes('firebase') ||
        errorMessage.includes('Firebase') ||
        errorMessage.includes('FCM') ||
        errorMessage.includes('fcm-credentials')
      ) {
        console.log('⚠️ Firebase/FCM chưa được cấu hình đúng');
        Alert.alert(
          t('common.info') || 'Thông báo',
          'Tính năng thông báo đẩy đang được cập nhật. Vui lòng thử lại sau khi có bản cập nhật mới.'
        );
        return false;
      }

      Alert.alert(t('common.error'), 'Lỗi khi thiết lập thông báo đẩy. Vui lòng thử lại sau.');
      return false;
    }
  };

  // Đăng ký token thiết bị với server
  const registerDeviceToken = async (token: string): Promise<boolean> => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        console.log('❌ Người dùng chưa đăng nhập - không thể đăng ký token');
        return false;
      }

      console.log('🔔 Registering push token with notification service via nginx proxy');

      // Import Device info (inline to avoid adding imports at top)
      const Device = require('expo-device');
      const Constants = require('expo-constants').default;
      const { Platform } = require('react-native');

      // Xác định app type (expo-go vs standalone) - QUAN TRỌNG cho iOS TestFlight
      const isStandalone = Constants.appOwnership !== 'expo';
      const appType = isStandalone ? 'standalone' : 'expo-go';

      // Build device info
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
        deviceToken: token,
        platform: platform,
        deviceName: deviceName,
        os: Platform.OS,
        osVersion: osVersion,
        appVersion: appVersion,
        language: 'vi',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        jwt_token: authToken, // Include JWT token in payload for authentication
        // Thêm thông tin để phân biệt app type
        appType: appType, // 'standalone' cho TestFlight/App Store, 'expo-go' cho Expo Go
        deviceId: deviceId, // Unique ID để backend phân biệt các devices
        bundleId: Constants.expoConfig?.ios?.bundleIdentifier || 'com.wellspring.workspace',
      };

      const apiUrl = `${BASE_URL}/api/method/erp.api.erp_sis.mobile_push_notification.register_device_token`;
      console.log('📡 FULL API URL being called:', apiUrl);
      console.log(`📤 Request payload (${appType}):`, JSON.stringify(deviceInfo, null, 2));
      console.log('🔑 Auth token (first 50 chars):', authToken.substring(0, 50) + '...');

      const response = await axios.post(apiUrl, deviceInfo, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      console.log(`✅ Push token registered successfully for ${appType}`);
      console.log('📥 Server response:', JSON.stringify(response.data, null, 2));

      // Kiểm tra response có success không
      if (response.data?.success === false) {
        console.error('❌ Server returned error:', response.data?.message);
        Alert.alert(t('common.error'), response.data?.message || 'Đăng ký token thất bại');
        return false;
      }

      await AsyncStorage.setItem('pushTokenAppType', appType);
      await AsyncStorage.setItem('pushTokenRegistered', 'true');
      return true;
    } catch (error: any) {
      console.error('❌ Lỗi đăng ký token thiết bị:', error);
      // Log chi tiết để debug
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }

      // Show user-friendly error
      Alert.alert(t('common.error'), t('notifications.connection_error'));
      return false;
    }
  };

  // Hủy đăng ký token thiết bị
  const unregisterDeviceToken = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      const pushToken = await AsyncStorage.getItem('pushToken');

      if (!authToken || !pushToken) {
        return;
      }

      console.log('🔔 Unregistering push token with notification service via nginx proxy');

      await axios.post(
        `${BASE_URL}/api/method/erp.api.erp_sis.mobile_push_notification.unregister_device_token`,
        { deviceToken: pushToken },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      console.log('✅ Push token unregistered successfully from notification service');

      // Luôn xóa token khỏi AsyncStorage, dù API có fail hay không
      await AsyncStorage.removeItem('pushToken');
      console.log('✅ Push token removed from local storage');
    } catch (error) {
      console.error('❌ Lỗi hủy đăng ký token thiết bị:', error);
      // Log chi tiết để debug
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }
    }
  };

  // Xử lý bật/tắt thông báo
  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        const success = await setupPushNotifications();
        if (success) {
          setNotificationsEnabled(true);
          await AsyncStorage.setItem('notificationsEnabled', 'true');
          Alert.alert(t('common.success'), t('notifications.notifications_enabled'));
        } else {
          setNotificationsEnabled(false);
        }
      } else {
        await unregisterDeviceToken();
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notificationsEnabled', 'false');
        Alert.alert(t('profile.notifications'), t('notifications.notifications_disabled'));
      }
    } catch (error) {
      console.error('Lỗi khi thay đổi cài đặt thông báo:', error);
      Alert.alert(t('common.error'), t('notifications.enable_notifications_error'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom', 'left', 'right']}>
      <StandardHeader logo={<Wismelogo width={130} height={50} />} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Profile Section */}
        <View className="mx-4 mt-6 items-center rounded-2xl p-6">
          {/* Avatar - chỉ hiển thị, không cho phép thay đổi */}
          <View className="relative mb-4">
            <Image
              source={{
                uri: avatarError ? getFallbackAvatar() : getAvatar(user),
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
              }}
              className="h-24 w-24 rounded-full"
              onError={(e) => {
                console.warn('[Profile][Image] onError:', e?.nativeEvent?.error);
                handleImageError();
              }}
            />
          </View>

          {/* User Info */}
          <Text className="my-2 text-3xl text-[#002855]" style={{ fontFamily: 'Mulish-Bold' }}>
            {user?.fullname}
          </Text>
          <Text className="my-2 text-[#757575]" style={{ fontFamily: 'Mulish-Medium' }}>
            {user?.jobTitle}
          </Text>

          {/* Employee ID Badge */}
          <View className="rounded-full bg-[#F9FBEB] px-4 py-2">
            <Text className="text-lg text-black" style={{ fontFamily: 'Mulish-SemiBold' }}>
              {user?.employeeCode}
            </Text>
          </View>
        </View>

        {/* Contact Info Section */}
        <View className="mx-4 mt-4 rounded-2xl bg-[#f8f8f8] p-4">
          <View className="my-2">
            <Text className="text-lg text-black" style={{ fontFamily: 'Mulish-SemiBold' }}>
              {t('profile.contact_info')}
            </Text>
          </View>
          <View className=" gap-2">
            {/* Phone */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="call-outline" size={20} color="#757575" />
              <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                {user?.phone}
              </Text>
            </View>

            {/* Email */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="mail-outline" size={20} color="#757575" />
              <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                {user?.email}
              </Text>
            </View>

            {/* Department */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="business-outline" size={20} color="#757575" />
              <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                {user?.department}
              </Text>
            </View>
          </View>
        </View>
        {/* Settings Section */}
        <View className="mt-8 rounded-2xl border-t border-[#E5E5E5]">
          <View className="gap-8 p-5">
            <Text className="text-base text-black" style={{ fontFamily: 'Mulish-SemiBold' }}>
              {t('profile.settings')}
            </Text>
            {/* Notifications */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <Ionicons name="notifications-outline" size={20} color="#757575" />
                <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                  {t('profile.notifications')}
                </Text>
              </View>
              <Switch
                trackColor={{ false: '#D1D5DB', true: '#F97316' }}
                thumbColor={'#FFFFFF'}
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
              />
            </View>

            {/* Language */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={showLanguageSelector}>
              <View className="flex-1 flex-row items-center">
                <Ionicons name="language-outline" size={20} color="#757575" />
                <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                  {t('profile.language')}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                  {getCurrentLanguageName()}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#757575" />
              </View>
            </TouchableOpacity>

            {/* Campus selector */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => setCampusSelectorVisible(true)}>
              <View className="flex-1 flex-row items-center">
                <Ionicons name="school-outline" size={20} color="#757575" />
                <Text className="ml-5 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                  {t('profile.campus') || 'Trường học'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 text-black" style={{ fontFamily: 'Mulish-Medium' }}>
                  {(() => {
                    const cur = campusOptions.find((c) => c.name === selectedCampus);
                    return cur?.title_vn || cur?.title_en || selectedCampus || '—';
                  })()}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#757575" />
              </View>
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity onPress={handleLogout} className="flex-row items-center">
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="ml-5 text-red-500" style={{ fontFamily: 'Mulish-Medium' }}>
                {t('profile.logout')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Biometric confirm modal removed */}

      {/* Biometric password modal removed */}

      {/* Campus Select Modal */}
      <SelectModal
        visible={campusSelectorVisible}
        title={t('profile.select_campus') || 'Chọn Trường/Campus'}
        options={campusOptions}
        keyExtractor={(c) => c.name}
        renderLabel={(c) => c.title_vn || c.title_en || c.name}
        onCancel={() => setCampusSelectorVisible(false)}
        onSelect={async (item) => {
          try {
            const id = (item as any).name;
            const title = (item as any).title_vn || (item as any).title_en || id;
            await AsyncStorage.setItem('currentCampusId', id);
            await AsyncStorage.setItem('selectedCampus', String(title));
            setSelectedCampus(id);
          } catch {}
          setCampusSelectorVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;
