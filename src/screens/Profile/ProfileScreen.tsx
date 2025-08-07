import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';
import Wismelogo from '../../assets/wisme.svg';
import { getAvatar } from '../../utils/avatar';
import { MICROSERVICES_BASE_URL } from '../../config/constants.js';
import FaceID from '../../assets/faceid-gray.svg';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import StandardHeader from '../../components/Common/StandardHeader';
import { userService } from '../../services/userService';

const ProfileScreen = () => {
  const { logout, user, refreshUserData } = useAuth();
  const { hasSavedCredentials, removeCredentials, saveCredentialsFromProfile } = useBiometricAuth();
  const { getCurrentLanguageName, showLanguageSelector, t } = useLanguage();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Kiểm tra xem sinh trắc học có được bật không
  useEffect(() => {
    setBiometricEnabled(hasSavedCredentials);
  }, [hasSavedCredentials]);

  // Kiểm tra trạng thái thông báo khi component mount
  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleEnableBiometric = () => {
    setPassword('');
    setShowPasswordModal(true);
  };

  const handleSubmitPassword = async () => {
    if (!password.trim()) {
      Alert.alert(t('common.error'), t('auth.enter_password'));
      return;
    }

    setIsLoading(true);
    try {
      const success = await saveCredentialsFromProfile(password);
      if (success) {
        setBiometricEnabled(true);
        setShowPasswordModal(false);
      }
    } catch (error) {
      console.error('Lỗi khi bật xác thực sinh trắc học:', error);
      Alert.alert(t('common.error'), 'Không thể bật xác thực sinh trắc học. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBiometricAuth = async (value: boolean) => {
    if (value === false) {
      setShowConfirmModal(true);
    } else {
      handleEnableBiometric();
    }
  };

  const handleConfirmDisable = async () => {
    const success = await removeCredentials();
    if (success) {
      setBiometricEnabled(false);
    }
    setShowConfirmModal(false);
  };

  const handleImageError = () => {
    if (!avatarError) {
      // Only log once per session
      console.log(
        '🖼️ [ProfileScreen] Avatar load error, switching to fallback for user:',
        user?.fullname
      );
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
        setAvatarError(false);
        Alert.alert('Thành công', result.message || 'Đã cập nhật ảnh đại diện');
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể tải lên ảnh');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
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
              setAvatarError(false);
              Alert.alert('Thành công', result.message || 'Đã xóa ảnh đại diện');
            } else {
              Alert.alert('Lỗi', result.message || 'Không thể xóa ảnh');
            }
          } catch (error) {
            console.error('Error removing avatar:', error);
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
        `${MICROSERVICES_BASE_URL}/api/notification/register-device`,
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
        `${MICROSERVICES_BASE_URL}/api/notification/unregister-device`,
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
                  uri: avatarError ? getFallbackAvatar() : getAvatar(user),
                }}
                className="h-24 w-24 rounded-full"
                onError={handleImageError}
                onLoad={() => setAvatarError(false)}
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

            {/* FaceID */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <FaceID width={20} height={20} />
                <Text className="ml-5 font-medium text-black">{t('profile.faceid')}</Text>
              </View>
              <Switch
                trackColor={{ false: '#D1D5DB', true: '#F97316' }}
                thumbColor={'#FFFFFF'}
                value={biometricEnabled}
                onValueChange={toggleBiometricAuth}
              />
            </View>

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

            {/* Logout */}
            <TouchableOpacity onPress={handleLogout} className="flex-row items-center">
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="ml-5 text-red-500">{t('profile.logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal xác nhận tắt FaceID/TouchID */}
      <ConfirmModal
        visible={showConfirmModal}
        title={t('auth.disable_biometric')}
        message={t('auth.disable_biometric_message')}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmDisable}
      />

      {/* Modal nhập mật khẩu để bật xác thực sinh trắc học */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPasswordModal}
        onRequestClose={() => setShowPasswordModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => setShowPasswordModal(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[85%] rounded-2xl bg-white p-6 shadow-lg">
            <Text className="mb-4 font-bold text-xl text-gray-800">
              {t('auth.enable_biometric')}
            </Text>
            <Text className="mb-4 text-base text-gray-600">{t('auth.enter_current_password')}</Text>

            <View className="relative mb-6">
              <TextInput
                className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pr-12"
                placeholder={t('auth.enter_password')}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                className="absolute right-3 top-3"
                onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color="#666"
                />
              </Pressable>
            </View>

            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} className="px-6 py-3">
                <Text className="font-medium text-gray-600">{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitPassword}
                disabled={isLoading}
                className="rounded-lg bg-secondary px-6 py-3">
                <Text className="font-medium text-white">
                  {isLoading ? t('common.processing') : t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
