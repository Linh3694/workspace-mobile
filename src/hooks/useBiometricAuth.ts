import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CREDENTIALS_KEY = 'WELLSPRING_SECURE_CREDENTIALS';
const LAST_EMAIL_KEY = 'WELLSPRING_LAST_EMAIL';

interface Credentials {
  email: string;
  password: string;
}

export const useBiometricAuth = () => {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState<boolean>(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [lastEmail, setLastEmail] = useState<string>('');

  useEffect(() => {
    checkBiometricAvailability();
    checkSavedCredentials();
    loadLastEmail();
  }, []);

  const loadLastEmail = async () => {
    try {
      const email = await AsyncStorage.getItem(LAST_EMAIL_KEY);
      if (email) {
        setLastEmail(email);
      }
    } catch (error) {
      console.error('Lỗi khi lấy email đã lưu:', error);
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      // Chỉ cho phép FaceID
      const isFaceIdAvailable = types.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      );

      // Kiểm tra xem FaceID đã được enrolled chưa
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      const canAuthenticate = compatible && isFaceIdAvailable && isEnrolled;
      console.log('FaceID available:', isFaceIdAvailable);
      console.log('FaceID enrolled:', isEnrolled);

      setIsBiometricAvailable(canAuthenticate);
    } catch (error) {
      console.error('Không thể kiểm tra khả năng sinh trắc học:', error);
      setIsBiometricAvailable(false);
    }
  };

  const checkSavedCredentials = async () => {
    try {
      const credentials = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      setHasSavedCredentials(!!credentials);
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đăng nhập đã lưu:', error);
      setHasSavedCredentials(false);
    }
  };

  const saveCredentials = async (email: string, password: string) => {
    try {
      const credentials = JSON.stringify({ email, password });
      await SecureStore.setItemAsync(CREDENTIALS_KEY, credentials);
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
      setLastEmail(email);
      setHasSavedCredentials(true);

      // Hiển thị thông báo thành công
      Alert.alert(
        'Đã lưu thông tin đăng nhập',
        'Lần sau bạn có thể đăng nhập bằng FaceID/TouchID',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Lỗi khi lưu thông tin đăng nhập:', error);
      Alert.alert('Lỗi', 'Không thể lưu thông tin đăng nhập. Vui lòng thử lại sau.', [
        { text: 'OK' },
      ]);
    }
  };

  // Lưu thông tin đăng nhập từ ProfileScreen (cần nhập lại mật khẩu)
  const saveCredentialsFromProfile = async (password: string) => {
    try {
      // Lấy email người dùng từ AsyncStorage
      const user = await AsyncStorage.getItem('user');
      const userData = user ? JSON.parse(user) : null;
      const email = userData?.email || (await AsyncStorage.getItem(LAST_EMAIL_KEY));

      if (!email) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin email đăng nhập. Vui lòng đăng nhập lại.', [
          { text: 'OK' },
        ]);
        return false;
      }

      // Lưu email hiện tại vào AsyncStorage
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
      setLastEmail(email);

      const credentials = JSON.stringify({ email, password });
      console.log(
        '💾 [BiometricAuth] Saving credentials to SecureStore (size:',
        credentials.length,
        'bytes)'
      );

      // Check if credentials are too large for SecureStore
      if (credentials.length > 2048) {
        console.warn(
          '⚠️ [BiometricAuth] Credentials might be too large for SecureStore:',
          credentials.length,
          'bytes'
        );
      }

      await SecureStore.setItemAsync(CREDENTIALS_KEY, credentials);
      setHasSavedCredentials(true);

      Alert.alert(
        'Đã bật xác thực sinh trắc học',
        'Bây giờ bạn có thể đăng nhập bằng FaceID/TouchID',
        [{ text: 'OK' }]
      );
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu thông tin đăng nhập:', error);
      Alert.alert('Lỗi', 'Không thể lưu thông tin đăng nhập. Vui lòng thử lại sau.', [
        { text: 'OK' },
      ]);
      return false;
    }
  };

  const authenticate = async (): Promise<Credentials | null> => {
    console.log('Bắt đầu quá trình xác thực');
    console.log('isBiometricAvailable:', isBiometricAvailable);
    console.log('hasSavedCredentials:', hasSavedCredentials);

    if (!isBiometricAvailable || !hasSavedCredentials) {
      console.log('Không thể xác thực: thiết bị không hỗ trợ hoặc chưa lưu credentials');
      return null;
    }

    setIsAuthenticating(true);
    try {
      // Kiểm tra hardware trước
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      console.log('Has hardware:', hasHardware);

      // Kiểm tra xem có biometric nào được enrolled không
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('Is enrolled:', isEnrolled);

      // Kiểm tra các loại xác thực được hỗ trợ
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      console.log('Supported types:', supportedTypes);

      if (!hasHardware || !isEnrolled) {
        console.log('Thiết bị không hỗ trợ hoặc chưa cấu hình biometric');
        return null;
      }

      console.log('Hiển thị prompt xác thực');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Xác thực để đăng nhập',
        disableDeviceFallback: true,
        cancelLabel: 'Hủy',
      });

      console.log('Kết quả xác thực:', result);

      if (result.success) {
        console.log('Xác thực thành công, lấy credentials');
        const credentialsString = await SecureStore.getItemAsync(CREDENTIALS_KEY);
        console.log('Đã lấy được credentials từ SecureStore:', !!credentialsString);

        if (credentialsString) {
          const parsed = JSON.parse(credentialsString) as Credentials;
          return { email: parsed.email, password: parsed.password };
        }
      } else if (result.error) {
        console.log('Lỗi xác thực:', result.error);
        // Xử lý các loại lỗi cụ thể
        switch (result.error) {
          case 'not_enrolled':
            console.log('Thiết bị chưa cấu hình biometric');
            break;
          case 'not_available':
            console.log('Tính năng không khả dụng');
            break;
          case 'user_cancel':
            console.log('Người dùng hủy xác thực');
            break;
          default:
            console.log('Lỗi không xác định:', result.error);
        }
      }
      return null;
    } catch (error) {
      console.error('Lỗi trong quá trình xác thực:', error);
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const removeCredentials = async () => {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      setHasSavedCredentials(false);

      Alert.alert('Đã xóa thông tin đăng nhập', 'Thông tin đăng nhập đã được xóa khỏi thiết bị', [
        { text: 'OK' },
      ]);
      return true;
    } catch (error) {
      console.error('Lỗi khi xóa thông tin đăng nhập:', error);
      Alert.alert('Lỗi', 'Không thể xóa thông tin đăng nhập. Vui lòng thử lại sau.', [
        { text: 'OK' },
      ]);
      return false;
    }
  };

  return {
    isBiometricAvailable,
    hasSavedCredentials,
    isAuthenticating,
    lastEmail,
    authenticate,
    saveCredentials,
    saveCredentialsFromProfile,
    removeCredentials,
  };
};
