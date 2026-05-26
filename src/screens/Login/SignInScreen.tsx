// @ts-nocheck
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { View, Text, TextInput, Image, Pressable, ActivityIndicator, Platform } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { typography } from '../../theme/typography';
import { useMicrosoftAuthV2 } from '../../hooks/useMicrosoftAuthV2';
import { useAppleLogin } from '../../hooks/useAppleLogin';
import MicrosoftIcon from '../../assets/microsoft.svg';
import AppleIcon from '../../assets/apple.svg';
// import * as AppleAuthentication from 'expo-apple-authentication';
import VisibilityIcon from '../../assets/visibility.svg';
// import WarningIcon from '../../assets/warning.svg';
// Removed FaceID per new requirement
// import { ROUTES } from '../../constants/routes';
import { API_BASE_URL } from '../../config/constants';
import { fetchAuthNoCookies } from '../../utils/fetchAuthNoCookies';
import { useAuth } from '../../context/AuthContext';
// Removed biometric auth per new requirement
import { useLanguage } from '../../hooks/useLanguage';
import NotificationModal from '../../components/NotificationModal';

type RootStackParamList = {
  Main: { screen: string };
  Login: undefined;
};

// Schema được tạo bên trong component để có thể sử dụng t()

// Define the key name for AsyncStorage
const LAST_EMAIL_KEY = 'WELLSPRING_LAST_EMAIL';

// Helper to detect if input is phone number
const isPhoneNumber = (input: string): boolean => {
  // Remove spaces and special chars except +
  const cleaned = input.replace(/[\s\-\(\)]/g, '');
  // Check if it's a phone number pattern (starts with 0, +84, 84, or is all digits)
  return /^(\+?84|0)?\d{9,10}$/.test(cleaned) || /^\d{10,11}$/.test(cleaned);
};

const SignInScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();

  // Schema chấp nhận cả email và số điện thoại
  const schema = yup.object().shape({
    email: yup
      .string()
      .required(t('auth.email_required'))
      .test('email-or-phone', t('auth.email_invalid'), (value) => {
        if (!value) return false;
        // Accept email or phone number
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isPhone = isPhoneNumber(value);
        return isEmail || isPhone;
      }),
    password: yup.string().required(t('auth.password_required')),
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
  });
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, checkAuth, loginWithMicrosoft } = useAuth();
  // const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('error');

  const { promptAsync, isReady } = useMicrosoftAuthV2(
    async (authResponse) => {
      try {
        // Use the new loginWithMicrosoft method from AuthContext
        await loginWithMicrosoft(authResponse);

        showNotification(`${t('auth.welcome')} ${authResponse.user?.full_name || ''}!`, 'success');
      } catch (error) {
        console.error('❌ [SignInScreen] Error processing Microsoft auth:', error);
        showNotification(t('auth.login_failed'), 'error');
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
        showNotification(error || t('auth.microsoft_login') + ' thất bại', 'error');
      }
    }
  );

  const {
    signInAsync: appleSignIn,
    isAvailable: isAppleAvailable,
    isLoading: isAppleLoading,
  } = useAppleLogin(
    async (credential) => {
      try {
        console.log('🍎 [SignInScreen] Starting Apple login with credential:', {
          user: credential.user,
          email: credential.email,
          fullName: credential.fullName,
          identityTokenLength: credential.identityToken?.length || 0,
        });

        const response = await fetchAuthNoCookies(`${API_BASE_URL}/api/auth/apple/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identityToken: credential.identityToken,
            user: credential.user,
            email: credential.email,
            fullName: credential.fullName,
          }),
        });

        console.log('🍎 [SignInScreen] Apple API response status:', response.status);

        const authData = await response.json();

        console.log('🍎 [SignInScreen] Apple API response data:', {
          success: authData.success,
          hasToken: !!authData.token,
          hasUser: !!authData.user,
          message: authData.message,
          error: authData.error,
        });

        if (response.ok && authData.success) {
          const { token: systemToken, user } = authData;

          await login(systemToken, user);
          await checkAuth();

          showNotification(
            `Chào mừng ${user?.fullname || credential.fullName?.givenName || ''}!`,
            'success'
          );
        } else {
          const errorMessage = authData.message || 'Xác thực Apple thất bại';
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('❌ [SignInScreen] Error processing Apple auth:', error);
        console.error('❌ [SignInScreen] Error details:', {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
        });

        let errorMessage = 'Lỗi xử lý đăng nhập. Vui lòng thử lại.';

        if (error?.message) {
          if (
            error.message.includes('Tài khoản chưa đăng ký') ||
            error.message.includes('chưa được đăng ký')
          ) {
            errorMessage =
              'Tài khoản Apple chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.';
          } else if (
            error.message.includes('Network request failed') ||
            error.message.includes('timeout')
          ) {
            errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
          } else if (error.message.includes('Invalid') || error.message.includes('malformed')) {
            errorMessage = 'Dữ liệu xác thực không hợp lệ. Vui lòng thử lại.';
          } else {
            // Keep the original error message if it's specific
            errorMessage = error.message.length > 5 ? error.message : errorMessage;
          }
        }

        showNotification(errorMessage, 'error');
      }
    },
    (error) => {
      console.error('❌ [SignInScreen] Apple login hook error:', error);

      // Show user-friendly error messages similar to Microsoft login
      if (error.includes('hủy') || error.includes('cancelled') || error.includes('canceled')) {
        console.log('🚫 [SignInScreen] Apple login cancelled by user');
        // Don't show notification for user cancellation
        return;
      } else if (error.includes('chưa đăng ký') || error.includes('not registered')) {
        showNotification(error, 'error');
      } else if (error.includes('không khả dụng') || error.includes('not available')) {
        showNotification('Apple Sign In không khả dụng trên thiết bị này', 'error');
      } else {
        // Provide more specific error message
        const errorMessage =
          error && error.length > 10
            ? error
            : 'Đăng nhập Apple thất bại. Vui lòng kiểm tra kết nối và thử lại.';
        showNotification(errorMessage, 'error');
      }
    }
  );

  // Debug Apple Sign In availability
  useEffect(() => {
    console.log('🔍 [DEBUG] Apple Sign In availability:', isAppleAvailable);
    console.log('🔍 [DEBUG] Platform:', Platform.OS);
  }, [isAppleAvailable]);

  const showNotification = (message: string, type: 'success' | 'error' = 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
  };

  // Biometric login removed

  const onSubmit = async (data: any) => {
    setLoading(true);
    setLoginError('');
    try {
      const inputValue = data.email.trim();
      const isPhone = isPhoneNumber(inputValue);

      let response;
      let resData;

      if (isPhone) {
        // Đăng nhập bằng số điện thoại cho Monitor
        console.log('📱 [SignInScreen] Logging in with phone number...');
        response = await fetchAuthNoCookies(
          `${API_BASE_URL}/api/method/erp.api.bus_application.auth.login_with_password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              phone_number: inputValue,
              password: data.password,
            }),
          }
        );
        resData = await response.json();

        console.log('📱 [SignInScreen] Monitor login response:', JSON.stringify(resData, null, 2));

        // Bus Monitor API trả về format khác
        const apiResponse = resData.message || resData;

        if (!apiResponse.success) {
          const errorMessage = apiResponse.message || 'Đăng nhập thất bại';
          setLoginError(errorMessage);
          showNotification(errorMessage, 'error');
          setLoading(false);
          return;
        }

        // Xử lý response thành công từ Monitor API
        const { token, monitor, user } = apiResponse.data;

        if (!token) {
          throw new Error('Thiếu token từ máy chủ');
        }

        // Lưu thông tin đăng nhập
        await AsyncStorage.setItem(LAST_EMAIL_KEY, inputValue);

        const finalUser = {
          _id: monitor.name,
          email: user.email,
          fullname: monitor.full_name,
          username: monitor.monitor_code,
          role: 'Mobile Monitor',
          roles: ['Mobile Monitor'], // Đảm bảo luôn có Mobile Monitor role
          jobTitle: 'Bus Monitor',
          department: 'Bus Operation',
          avatar: 'https://via.placeholder.com/150',
          needProfileUpdate: false,
          employeeCode: monitor.monitor_code,
          provider: 'bus_monitor',
          phone_number: monitor.phone_number,
          campus_id: monitor.campus_id,
          school_year_id: monitor.school_year_id,
        };

        try {
          await login(token, finalUser);
        } catch (e) {
          if (e?.message === 'NO_MOBILE_ACCESS') {
            showNotification('Bạn không có quyền đăng nhập hệ thống.', 'error');
            setLoading(false);
            return;
          }
          throw e;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        showNotification(`Chào mừng ${monitor.full_name}!`, 'success');

        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Home' } }],
        });

        setLoading(false);
        return;
      }

      // Đăng nhập bằng email (logic cũ)
      response = await fetchAuthNoCookies(`${API_BASE_URL}/api/method/erp.api.erp_common_user.auth.login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          username: data.email, // Có thể là email hoặc username
          password: data.password,
          provider: 'local',
        }),
      });
      resData = await response.json();

      // Debug: Log the actual response structure
      console.log('🔍 [SignInScreen] API Response Structure:', JSON.stringify(resData, null, 2));

      // Frappe API trả về data trong resData.message
      const apiResponse = resData.message || resData;

      if (!response.ok || apiResponse.status !== 'success') {
        const errorMessage = apiResponse.message || resData.message || 'Đăng nhập thất bại';
        setLoginError(errorMessage);
        showNotification('Tài khoản hoặc mật khẩu không chính xác', 'error');
      } else {
        try {
          await AsyncStorage.setItem(LAST_EMAIL_KEY, data.email);

          // Xử lý response từ Frappe API
          const token: string | undefined = apiResponse.token;
          if (!token) {
            throw new Error('Thiếu token từ máy chủ');
          }

          let finalUser: any | null = null;

          if (apiResponse.user) {
            const user = apiResponse.user;
            const userId = user.email; // Frappe sử dụng email làm user ID
            const userFullname = user.full_name || user.username || data.email.split('@')[0];
            const userRole = user.role || user.user_role || 'user';
            const roles = Array.isArray(user.roles)
              ? user.roles
              : Array.isArray(user.user_roles)
                ? user.user_roles
                : [];

            finalUser = {
              _id: userId,
              email: user.email,
              fullname: userFullname,
              username: user.username,
              role: userRole,
              roles,
              jobTitle: user.job_title || 'N/A',
              department: user.department || 'N/A',
              avatar: user.avatar || user.user_image || 'https://via.placeholder.com/150',
              needProfileUpdate: false,
              employeeCode: user.employee_code || 'N/A',
              provider: user.provider || 'local',
            };
          } else {
            // Nếu login không trả user, gọi get_current_user để lấy thông tin đầy đủ
            try {
              const resp = await fetchAuthNoCookies(
                `${API_BASE_URL}/api/method/erp.api.erp_common_user.auth.get_current_user`,
                {
                  method: 'GET',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              if (resp.ok) {
                const dataUser = await resp.json();
                const u = dataUser.user || (dataUser.message && dataUser.message.user);
                if (dataUser.status === 'success' && u) {
                  const userId = u.email;
                  const userFullname = u.full_name || u.username || userId;
                  const userRole = u.role || u.user_role || 'user';
                  const roles = Array.isArray(u.roles)
                    ? u.roles
                    : Array.isArray(u.user_roles)
                      ? u.user_roles
                      : [];
                  finalUser = {
                    _id: userId,
                    email: u.email,
                    fullname: userFullname,
                    username: u.username || userId,
                    role: userRole,
                    roles,
                    jobTitle: u.job_title || 'N/A',
                    department: u.department || 'N/A',
                    avatar: u.avatar || u.user_image || 'https://via.placeholder.com/150',
                    needProfileUpdate: false,
                    employeeCode: u.employee_code || 'N/A',
                    provider: u.provider || 'local',
                  };
                }
              }
            } catch {
              console.warn(
                '[SignInScreen] get_current_user failed, sẽ fallback frappe.auth.get_logged_user'
              );
            }

            // Fallback cuối cùng nếu vẫn chưa có user đầy đủ
            if (!finalUser) {
              try {
                const fallbackResp = await fetchAuthNoCookies(
                  `${API_BASE_URL}/api/method/frappe.auth.get_logged_user`,
                  {
                    method: 'GET',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                if (fallbackResp.ok) {
                  const r = await fallbackResp.json();
                  const u = r.message || r;
                  finalUser = {
                    _id: u.email || data.email,
                    email: u.email || data.email,
                    fullname: u.fullname || u.full_name || u.username || data.email.split('@')[0],
                    username: u.username || u.email || data.email,
                    role: u.role || u.user_role || 'user',
                    roles: Array.isArray(u.roles)
                      ? u.roles
                      : Array.isArray(u.user_roles)
                        ? u.user_roles
                        : [],
                    jobTitle: u.job_title || 'N/A',
                    department: u.department || 'N/A',
                    avatar: u.avatar || u.user_image || 'https://via.placeholder.com/150',
                    needProfileUpdate: false,
                    employeeCode: u.employee_code || 'N/A',
                    provider: 'frappe',
                  };
                }
              } catch {}
            }

            // Nếu vẫn không lấy được, tạo bản tối thiểu từ email nhập vào
            if (!finalUser) {
              finalUser = {
                _id: data.email,
                fullname: data.email.split('@')[0],
                email: data.email,
                role: 'user',
                roles: [],
                department: 'user',
                provider: 'local',
              };
            }
          }

          // Lưu token + user (đã chuẩn hoá) và xác thực lại để init push, cache-bust avatar
          try {
            await login(token, finalUser);
            // Đã bỏ checkAuth() vì login() đã xử lý đầy đủ
            // và tránh race condition với state update
          } catch (e) {
            if (e?.message === 'NO_MOBILE_ACCESS') {
              showNotification('Bạn không có quyền đăng nhập hệ thống.', 'error');
              return;
            }
            throw e;
          }

          // Đợi một chút để đảm bảo state được update đầy đủ
          await new Promise((resolve) => setTimeout(resolve, 100));

          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', params: { screen: 'Home' } }],
          });
        } catch (storageError) {
          console.error('Storage error:', storageError);
          showNotification('Đã xảy ra lỗi khi xử lý thông tin đăng nhập', 'error');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      showNotification('Lỗi kết nối máy chủ', 'error');
      setLoginError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center bg-white">
      <View className="mt-[15%] w-full p-5">
        {/* Logo và tiêu đề */}
        <Image
          source={require('../../assets/wellspring-logo.png')}
          className="mb-6 h-16 w-[30%]"
          resizeMode="cover"
        />
        <Text className="self-start text-xl font-bold text-primary">Đăng nhập</Text>
        {/* Email */}
        <Text className="mt-6 self-start font-medium text-primary">
          Tên đăng nhập <Text className="text-error">*</Text>
        </Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="mt-2 h-12 w-full rounded-xl  border border-[#ddd] bg-white px-3 font-medium"
              placeholder="Email hoặc số điện thoại"
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.email && <Text className="ml-2 self-start text-error">{errors.email.message}</Text>}
        {/* Password */}
        <Text className="mt-4 self-start font-medium  text-primary">
          Mật khẩu <Text className="text-error">*</Text>
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <View className="relative w-full">
              <TextInput
                className={`mt-2 h-12 w-full rounded-xl border bg-white px-3 pr-12 font-medium ${loginError ? 'border-error' : 'border-[#ddd]'}`}
                placeholder="Nhập mật khẩu"
                secureTextEntry={!showPassword}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
              <Pressable
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '60%',
                  transform: [{ translateY: -12 }],
                  zIndex: 10,
                }}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}>
                <VisibilityIcon width={24} height={24} />
              </Pressable>
            </View>
          )}
        />
        {errors.password && (
          <Text className="ml-2 self-start text-error">{errors.password.message}</Text>
        )}

        {/* FaceID removed */}

        {/* Nút đăng nhập */}
        <TouchableOpacity
          className="mt-2 w-full items-center rounded-full bg-secondary py-3"
          onPress={handleSubmit(onSubmit)}
          disabled={loading}>
          <Text className="text-base font-bold text-white">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Text>
        </TouchableOpacity>

        {/* Phân cách */}
        <View className="my-6 flex-row items-center">
          <View className="h-px flex-1 bg-[#E0E0E0]" />
          <Text className="mx-2 text-sm  font-medium text-text-secondary">
            Đăng nhập với phương thức khác
          </Text>
          <View className="h-px flex-1 bg-[#E0E0E0]" />
        </View>
        {/* Nút đăng nhập Microsoft */}
        <TouchableOpacity
          onPress={() => promptAsync()}
          disabled={!isReady}
          activeOpacity={0.7}
          className={`mb-2 w-full flex-row items-center justify-center rounded-full py-3 ${
            isReady ? 'bg-secondary/10' : 'bg-gray-200'
          }`}>
          <View style={{ marginRight: 8 }}>
            <MicrosoftIcon width={20} height={20} />
          </View>
          <Text className="text-base font-bold text-secondary">Đăng nhập với Microsoft</Text>
        </TouchableOpacity>

        {/* Nút đăng nhập Apple - chỉ hiển thị trên iOS */}
        {isAppleAvailable && (
          <TouchableOpacity
            className="mb-2 w-full flex-row items-center justify-center rounded-full bg-secondary/10 py-3"
            onPress={appleSignIn}
            disabled={isAppleLoading}
            style={{ opacity: isAppleLoading ? 0.6 : 1 }}>
            <View style={{ marginRight: 8 }}>
              <AppleIcon width={20} height={20} />
            </View>
            <Text className="text-base font-bold text-secondary">
              {isAppleLoading ? 'Đang xử lý...' : 'Đăng nhập với Apple'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View className="absolute bottom-12 mt-4 w-full items-center">
        <Text className="mt-8  text-center text-xs font-medium text-text-secondary">
          © Copyright 2025 Wellspring International Bilingual Schools.{'\n'}All Rights Reserved.
        </Text>
      </View>
      <NotificationModal
        visible={showNotificationModal}
        type={notificationType}
        message={notificationMessage}
        onClose={() => setShowNotificationModal(false)}
      />
    </View>
  );
};

export default SignInScreen;
