import React, { useState, useEffect } from 'react';
// @ts-ignore
import { View, Text, SafeAreaView, TouchableOpacity, Switch, Alert, Image, ScrollView, Platform, ActivityIndicator } from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import StandardHeader from '../../components/Common/StandardHeader';
import SelectModal from '../../components/SelectModal';
import attendanceService from '../../services/attendanceService';
import { userService } from '../../services/userService';

const ProfileScreen = () => {
  const { logout, user, refreshUserData, bumpAvatarCacheBust } = useAuth();
  // Biometric hooks removed
  const { getCurrentLanguageName, showLanguageSelector, t } = useLanguage();
  // const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [campusOptions, setCampusOptions] = useState<Array<{ name: string; title_vn?: string; title_en?: string }>>([]);
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
      return [] as Array<{ name: string; title_vn?: string; title_en?: string }>;
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
            const hit = rows.find((c) => c.title_vn === savedTitle || c.title_en === savedTitle || c.name === savedTitle);
            if (hit) {
              await AsyncStorage.setItem('currentCampusId', hit.name);
              setSelectedCampus(hit.name);
              return;
            }
          }
          await AsyncStorage.setItem('currentCampusId', rows[0].name);
          await AsyncStorage.setItem('selectedCampus', rows[0].title_vn || rows[0].title_en || rows[0].name);
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

  // Avatar upload functions
  const handleChangeAvatar = async () => {
    Alert.alert('Thay đổi ảnh đại diện', 'Chọn nguồn ảnh', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chọn từ thư viện', onPress: () => pickImageFromLibrary() },
      { text: 'Chụp ảnh mới', onPress: () => takePhoto() },
      { text: 'Xóa ảnh', onPress: () => handleRemoveAvatar(), style: 'destructive' },
    ]);
  };

  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi chọn ảnh');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi chụp ảnh');
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    setUploadingAvatar(true);
    try {
      const result = await userService.uploadAvatar(imageUri);

      if (result.success) {
        // Refresh user data to get updated avatar
        if (refreshUserData) {
          await refreshUserData();
        }
        // Bump cache-bust so URL khác đi khi mở lại app
        if (bumpAvatarCacheBust) {
          await bumpAvatarCacheBust();
        }
        // Cập nhật hiển thị avatar ngay lập tức bằng URL nhận từ server
        if (result.avatar_url) {
          try {
            const temp = getAvatar({
              fullname: user?.fullname || 'Unknown',
              avatar_url: result.avatar_url,
            } as any);
            const withTs = `${temp}${temp.includes('?') ? '&' : '?'}ts=${Date.now()}`;
            setLocalAvatarUrl(withTs);
          } catch {}
        }
        setAvatarError(false);
        Alert.alert('Thành công', result.message || 'Đã cập nhật ảnh đại diện');
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể tải lên ảnh');
      }
    } catch (_error) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải lên ảnh');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    Alert.alert('Xác nhận xóa ảnh', 'Bạn có chắc chắn muốn xóa ảnh đại diện?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setUploadingAvatar(true);
          try {
            const result = await userService.deleteAvatar();

            if (result.success) {
              // Refresh user data to get updated avatar
              if (refreshUserData) {
                await refreshUserData();
              }
              // Bump cache-bust để chắc chắn tránh cache ảnh cũ
              if (bumpAvatarCacheBust) {
                await bumpAvatarCacheBust();
              }
              setAvatarError(false);
              setLocalAvatarUrl(null);
              Alert.alert('Thành công', result.message || 'Đã xóa ảnh đại diện');
            } else {
              Alert.alert('Lỗi', result.message || 'Không thể xóa ảnh');
            }
          } catch (_error) {
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi xóa ảnh');
          } finally {
            setUploadingAvatar(false);
          }
        },
      },
    ]);
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
    if (!Device.isDevice) {
      Alert.alert(t('profile.notifications'), t('notifications.simulator_not_supported'));
      return false;
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
        console.error('Không tìm thấy projectId trong app.json');
        return false;
      }

      // Lấy token thiết bị
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('Push token:', token.data);

      // Lưu token vào AsyncStorage để sử dụng sau này
      await AsyncStorage.setItem('pushToken', token.data);

      // Gửi token lên server
      await registerDeviceToken(token.data);
      return true;
    } catch (error) {
      console.error('Lỗi khi thiết lập thông báo đẩy:', error);
      return false;
    }
  };

  // Đăng ký token thiết bị với server
  const registerDeviceToken = async (token: string) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        console.log('Người dùng chưa đăng nhập');
        return;
      }

      console.log('🔔 Registering push token with notification service via nginx proxy');

      await axios.post(
        `${BASE_URL}/api/notification/register-device`,
        { deviceToken: token },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      console.log('✅ Push token registered successfully with notification service');
    } catch (error) {
      console.error('❌ Lỗi đăng ký token thiết bị:', error);
      // Log chi tiết để debug
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }

      // Show user-friendly error
      Alert.alert(t('common.error'), t('notifications.connection_error'));
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
        `${BASE_URL}/api/notification/unregister-device`,
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
    <SafeAreaView className="flex-1 bg-white">
      <StandardHeader logo={<Wismelogo width={130} height={50} />} />

      <ScrollView className="flex-1">
        {/* Profile Section */}
        <View className="mx-4 mt-6 items-center rounded-2xl p-6">
          {/* Avatar với online status */}
          <View className="relative mb-4">
            <TouchableOpacity onPress={handleChangeAvatar} disabled={uploadingAvatar}>
              <Image
                source={{
                  uri: (() => {
                    const uri = avatarError
                      ? getFallbackAvatar()
                      : localAvatarUrl || getAvatar(user);
                    console.log('[Profile][Image] rendering URI:', uri);
                    return uri;
                  })(),
                  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
                }}
                key={`${localAvatarUrl || getAvatar(user)}`}
                className="h-24 w-24 rounded-full"
                onError={(e) => {
                  console.warn('[Profile][Image] onError:', e?.nativeEvent?.error);
                  handleImageError();
                }}
              />

              {/* Edit overlay */}
              <View className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-primary p-1">
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={14} color="white" />
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* User Info */}
          <Text className="my-2 font-bold text-3xl text-primary">{user?.fullname}</Text>
          <Text className="my-2 font-medium text-[#757575]">{user?.jobTitle}</Text>

          {/* Employee ID Badge */}
          <View className="rounded-full bg-[#F9FBEB] px-4 py-2">
            <Text className="font-semibold text-lg text-black">{user?.employeeCode}</Text>
          </View>
        </View>

        {/* Contact Info Section */}
        <View className="mx-4 mt-4 rounded-2xl bg-[#f8f8f8] p-4">
          <View className="my-2">
            <Text className="font-semibold text-lg text-black">{t('profile.contact_info')}</Text>
          </View>
          <View className=" gap-2">
            {/* Phone */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="call-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{user?.phone}</Text>
            </View>

            {/* Email */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="mail-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{user?.email}</Text>
            </View>

            {/* Department */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="business-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{user?.department}</Text>
            </View>
          </View>
        </View>
        {/* Settings Section */}
        <View className="mt-8 rounded-2xl border-t border-[#E5E5E5]">
          <View className="gap-8 p-5">
            <Text className="font-semibold text-base text-black">{t('profile.settings')}</Text>
            {/* Notifications */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <Ionicons name="notifications-outline" size={20} color="#757575" />
                <Text className="ml-5 font-medium text-black">{t('profile.notifications')}</Text>
              </View>
              <Switch
                trackColor={{ false: '#D1D5DB', true: '#F97316' }}
                thumbColor={'#FFFFFF'}
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
              />
            </View>

            {/* FaceID removed */}

            {/* Language */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={showLanguageSelector}>
              <View className="flex-1 flex-row items-center">
                <Ionicons name="language-outline" size={20} color="#757575" />
                <Text className="ml-5 font-medium text-black">{t('profile.language')}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 font-medium text-black">{getCurrentLanguageName()}</Text>
                <Ionicons name="chevron-down" size={16} color="#757575" />
              </View>
            </TouchableOpacity>

            {/* Campus selector */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => setCampusSelectorVisible(true)}>
              <View className="flex-1 flex-row items-center">
                <Ionicons name="school-outline" size={20} color="#757575" />
                <Text className="ml-5 font-medium text-black">{t('profile.campus') || 'Trường học'}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 font-medium text-black">
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
              <Text className="ml-5 text-red-500">{t('profile.logout')}</Text>
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
