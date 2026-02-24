import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from '../config/constants';
import { microsoftAuthService, MicrosoftAuthResponse } from '../services/microsoftAuthService';
import pushNotificationService from '../services/pushNotificationService';
import { userService } from '../services/userService';
import { normalizeUserData as normalizeUserName } from '../utils/nameFormatter';

// Khóa cho thông tin đăng nhập sinh trắc học
const CREDENTIALS_KEY = 'WELLSPRING_SECURE_CREDENTIALS';

type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  user: any;
  login: (token: string, userData: any) => Promise<void>;
  loginWithMicrosoft: (authResponse: MicrosoftAuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  clearBiometricCredentials: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  bumpAvatarCacheBust: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Helper function to normalize user data from different API responses
const normalizeUserData = (userData: any, defaultProvider = 'local') => {
  const roles: string[] = Array.isArray(userData.roles)
    ? userData.roles
    : Array.isArray(userData.user_roles)
      ? userData.user_roles
      : [];

  // Normalize tên theo format Việt Nam (Họ + Tên đệm + Tên)
  const normalizedName = normalizeUserName(userData);
  const rawFullname =
    normalizedName.fullname ||
    normalizedName.full_name ||
    userData.fullname ||
    userData.full_name ||
    userData.username ||
    userData.email;

  return {
    _id: userData._id || userData.id || userData.email || userData.name,
    email: userData.email,
    fullname: rawFullname, // Tên đã được normalize theo format Việt Nam
    username: userData.username || userData.email,
    role: userData.role || userData.user_role || 'user',
    roles,
    jobTitle: userData.jobTitle || userData.job_title || '',
    department: userData.department || '',
    avatar:
      userData.avatar ||
      userData.avatar_url ||
      userData.user_image ||
      userData.avatarUrl ||
      'https://via.placeholder.com/150',
    needProfileUpdate: userData.needProfileUpdate || false,
    employeeCode: userData.employeeCode || userData.employee_code || '',
    provider: userData.provider || defaultProvider,
    teacher_info: userData.teacher_info || {
      homeroom_class_ids: [],
      vice_homeroom_class_ids: [],
      teaching_class_ids: [],
    },
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('🔄 [AuthProvider] AuthProvider component rendering');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  console.log('🔄 [AuthProvider] Initial state - user:', user, 'loading:', loading);

  // --- Avatar cache-bust helpers ---
  const getAvatarBustKey = (identifier?: string) => `avatarCacheBust:${identifier || ''}`;

  const attachAvatarCacheBust = useCallback(async (rawUser: any) => {
    try {
      const identifier = rawUser?._id || rawUser?.email || '';
      const stored = await AsyncStorage.getItem(getAvatarBustKey(identifier));
      const bust = stored ? parseInt(stored, 10) : 1;
      return { ...rawUser, avatar_cache_bust: bust };
    } catch {
      return rawUser;
    }
  }, []);

  const bumpAvatarCacheBust = async () => {
    try {
      const identifier = user?._id || user?.email || '';
      const key = getAvatarBustKey(identifier);
      const stored = await AsyncStorage.getItem(key);
      const next = stored ? parseInt(stored, 10) + 1 : 2;
      await AsyncStorage.setItem(key, String(next));
      setUser((prev: any) => (prev ? { ...prev, avatar_cache_bust: next } : prev));
    } catch (e) {
      console.warn('[Auth] bumpAvatarCacheBust failed', e);
    }
  };

  const hasRequiredMobileRole = (roles: string[] = []): boolean => {
    const required = new Set(['Mobile IT', 'Mobile Teacher', 'Mobile BOD', 'Mobile Monitor']);
    return roles.some((r) => required.has(r));
  };

  const persistTeacherInfo = async (ti: any) => {
    try {
      const homeroom = Array.isArray(ti?.homeroom_class_ids) ? ti.homeroom_class_ids : [];
      const vice = Array.isArray(ti?.vice_homeroom_class_ids) ? ti.vice_homeroom_class_ids : [];
      const teaching = Array.isArray(ti?.teaching_class_ids) ? ti.teaching_class_ids : [];
      await AsyncStorage.setItem('teacherHomeroomClassIds', JSON.stringify(homeroom));
      await AsyncStorage.setItem('teacherViceHomeroomClassIds', JSON.stringify(vice));
      await AsyncStorage.setItem('teacherTeachingClassIds', JSON.stringify(teaching));
    } catch (e) {
      console.warn('[Auth] persistTeacherInfo failed', e);
    }
  };

  // Đồng bộ user data mới nhất từ Frappe (bao gồm roles, teacher_info)
  // QUAN TRỌNG: Hàm này được sử dụng cho cả local login và Microsoft login
  const refreshUserData = useCallback(async () => {
    try {
      console.log('=== [refreshUserData] Starting ===');
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('[refreshUserData] No token found, skipping');
        return;
      }

      // Lấy provider từ user hiện tại hoặc từ AsyncStorage
      let currentProvider = user?.provider;
      if (!currentProvider) {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          currentProvider = parsed.provider || 'local';
        }
      }
      console.log('[refreshUserData] Current provider:', currentProvider);

      const resp = await fetch(
        `${getApiBaseUrl()}/api/method/erp.api.erp_common_user.auth.get_current_user`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('[refreshUserData] API response status:', resp.status);

      if (!resp.ok) {
        console.warn('[refreshUserData] API failed with status:', resp.status);
        return;
      }

      const data = await resp.json();
      console.log('[refreshUserData] API response structure:', {
        success: data.success,
        status: data.status,
        hasData: !!data.data,
        hasUser: !!(data.data?.user || data.user),
      });

      const ok = (data && data.success === true) || (data && data.status === 'success');
      const payload = (data && data.data) || data;
      const userData = payload && payload.user;

      if (ok && userData) {
        console.log('[refreshUserData] Raw user data received:', {
          email: userData.email,
          full_name: userData.full_name,
          provider: userData.provider,
          hasTeacherInfo: !!userData.teacher_info,
          teacherInfoPreview: userData.teacher_info,
        });

        // Giữ nguyên provider từ login ban đầu (Microsoft hoặc local)
        const finalProvider = currentProvider || userData.provider || 'local';
        let normalized = normalizeUserData(userData, finalProvider);
        const roles = normalized.roles || [];

        if (!hasRequiredMobileRole(roles)) {
          console.warn('[refreshUserData] User lacks mobile roles');
          await logout();
          return;
        }

        // Thử lấy URL avatar mới nhất từ endpoint chuyên dụng
        try {
          const avatarResp = await userService.getAvatarUrl(userData.email);
          if (avatarResp.success && avatarResp.avatar_url) {
            normalized.avatar = avatarResp.avatar_url;
          }
        } catch (e) {
          console.warn('[refreshUserData] getAvatarUrl failed', e);
        }

        normalized = await attachAvatarCacheBust(normalized);

        console.log('[refreshUserData] Normalized user data:', {
          fullname: normalized.fullname,
          email: normalized.email,
          provider: normalized.provider,
          roles: normalized.roles,
          teacherInfo: {
            homeroom: normalized.teacher_info?.homeroom_class_ids?.length || 0,
            vice: normalized.teacher_info?.vice_homeroom_class_ids?.length || 0,
            teaching: normalized.teacher_info?.teaching_class_ids?.length || 0,
          },
        });

        // Cập nhật state và AsyncStorage
        setUser(normalized);
        await AsyncStorage.setItem('user', JSON.stringify(normalized));
        await AsyncStorage.setItem('userId', normalized._id || normalized.email);
        await AsyncStorage.setItem('userFullname', normalized.fullname || '');
        await AsyncStorage.setItem('userJobTitle', normalized.jobTitle || '');
        await AsyncStorage.setItem('userDepartment', normalized.department || '');
        await AsyncStorage.setItem('userRole', normalized.role || 'user');
        await AsyncStorage.setItem('userRoles', JSON.stringify(normalized.roles || []));
        await AsyncStorage.setItem('userEmployeeCode', normalized.employeeCode || '');
        await AsyncStorage.setItem('userAvatarUrl', normalized.avatar || '');
        await persistTeacherInfo(normalized.teacher_info);

        console.log('=== [refreshUserData] Completed successfully ===');
      } else {
        console.warn('[refreshUserData] API returned no user data or success=false');
      }
    } catch (error) {
      console.error('[refreshUserData] Error:', error);
    }
  }, [user?.provider, attachAvatarCacheBust]);

  // Đăng xuất - wrapped in useCallback để ổn định dependency cho các hook khác
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      // Cleanup push notifications
      try {
        pushNotificationService.cleanup();
        await AsyncStorage.removeItem('pushToken');
        await AsyncStorage.removeItem('pushTokenRegistered');
        console.log('✅ [logout] Push notifications cleaned up');
      } catch (pushError) {
        console.warn('⚠️ [logout] Failed to cleanup push notifications:', pushError);
      }

      // Xóa các thông tin
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userId');
      await AsyncStorage.removeItem('userFullname');
      await AsyncStorage.removeItem('userJobTitle');
      await AsyncStorage.removeItem('userDepartment');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userEmployeeCode');
      await AsyncStorage.removeItem('userAvatarUrl');
      await AsyncStorage.removeItem('userRoles');
      setUser(null);
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔄 [checkAuth] Starting authentication check...');
      setLoading(true);
      console.log('🔄 [checkAuth] About to get token from AsyncStorage...');
      const token = await AsyncStorage.getItem('authToken');
      console.log('🔄 [checkAuth] Got token from AsyncStorage:', !!token);

      if (!token) {
        console.log('🔍 [checkAuth] No token found');
        setLoading(false);
        return false;
      }

      console.log('🔍 [checkAuth] Token found, checking validity...');

      // Kiểm tra token - có thể là JWT hoặc session token
      let decoded: any = null;
      let isJWT = false;

      try {
        decoded = jwtDecode(token);
        isJWT = true;
        const currentTime = Date.now() / 1000;

        console.log('🔍 [checkAuth] JWT Token decoded:', {
          exp: decoded.exp,
          currentTime,
          isExpired: decoded.exp && decoded.exp < currentTime,
          issuer: decoded.iss,
        });

        if (decoded.exp && decoded.exp < currentTime) {
          // Token đã hết hạn
          console.log('⚠️ [checkAuth] JWT Token expired, logging out');
          await logout();
          setLoading(false);
          return false;
        }
      } catch {
        console.log('🔍 [checkAuth] Token is not JWT, treating as session token');
        isJWT = false;
      }

      // Lấy thông tin user từ AsyncStorage
      const userStr = await AsyncStorage.getItem('user');
      console.log('🔍 [checkAuth] User data from storage:', !!userStr);

      if (userStr) {
        const userData = JSON.parse(userStr);
        console.log('✅ [checkAuth] User data loaded from AsyncStorage:', {
          name: userData.fullname || userData.full_name,
          provider: userData.provider,
          id: userData._id,
        });

        // KHÔNG normalize lại vì data từ AsyncStorage đã được normalize khi login
        // Chỉ cần thêm avatar cache bust
        let cachedUser = await attachAvatarCacheBust(userData);
        console.log('✅ [checkAuth] Cached user data:', {
          fullname: cachedUser.fullname,
          jobTitle: cachedUser.jobTitle,
          department: cachedUser.department,
          role: cachedUser.role,
        });

        setUser(cachedUser);

        // Initialize push notifications for cached user
        try {
          await pushNotificationService.initialize();
          console.log('✅ [checkAuth cached] Push notifications initialized');
        } catch (pushError) {
          console.warn('⚠️ [checkAuth cached] Failed to initialize push notifications:', pushError);
        }

        // Đồng bộ dữ liệu người dùng mới nhất ở nền để cập nhật avatar/path thay đổi gần đây
        try {
          // Không await để không chặn UI
          refreshUserData();
        } catch (e) {
          console.warn('[checkAuth] background refreshUserData failed', e);
        }

        setLoading(false);
        return true;
      } else {
        // Check token type and proceed with validation
        if (isJWT && decoded) {
          // Handle JWT tokens
          if (decoded.iss && decoded.iss.includes('prod.sis.wellspring.edu.vn')) {
            console.log('🔍 [checkAuth] Backend JWT token detected');
          } else if (
            decoded.iss &&
            (decoded.iss.includes('windows.net') ||
              decoded.iss.includes('microsoft.com') ||
              decoded.iss.includes('login.microsoftonline.com'))
          ) {
            console.log(
              '⚠️ [checkAuth] Old Microsoft token detected - should not happen with new workflow'
            );
            await logout();
            setLoading(false);
            return false;
          } else {
            console.log('🔍 [checkAuth] JWT token detected, proceeding with validation...');
          }
        } else {
          console.log('🔍 [checkAuth] Session token detected, trying API validation...');
        }

        // Try existing auth endpoints with current token
        try {
          console.log('🔄 [checkAuth] Trying to get user info with current token...');

          // Try ERP current user endpoint with JWT token
          const response = await fetch(
            `${getApiBaseUrl()}/api/method/erp.api.erp_common_user.auth.get_current_user`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.user && data.authenticated) {
              const userData = data.user;
              console.log('✅ [checkAuth] User data fetched from ERP endpoint');
              console.log('User data preview:', {
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                provider: userData.provider,
              });

              // Normalize user data to match UI expectations
              let normalizedUser = normalizeUserData(userData, userData.provider || 'local');
              const roles = normalizedUser.roles || [];
              if (!hasRequiredMobileRole(roles)) {
                console.warn('[checkAuth] User lacks mobile roles');
                await logout();
                setLoading(false);
                return false;
              }
              normalizedUser = await attachAvatarCacheBust(normalizedUser);

              console.log('✅ [checkAuth] Normalized user data:', {
                fullname: normalizedUser.fullname,
                jobTitle: normalizedUser.jobTitle,
                department: normalizedUser.department,
                role: normalizedUser.role,
              });

              setUser(normalizedUser);
              // Save normalized user data to AsyncStorage
              await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
              await AsyncStorage.setItem('userId', normalizedUser.email);
              await AsyncStorage.setItem('userFullname', normalizedUser.fullname);
              await AsyncStorage.setItem('userJobTitle', normalizedUser.jobTitle);
              await AsyncStorage.setItem('userDepartment', normalizedUser.department);
              await AsyncStorage.setItem('userRole', normalizedUser.role);
              await AsyncStorage.setItem('userEmployeeCode', normalizedUser.employeeCode);
              await AsyncStorage.setItem('userAvatarUrl', normalizedUser.avatar);
              await AsyncStorage.setItem('userRoles', JSON.stringify(normalizedUser.roles || []));
              await persistTeacherInfo(normalizedUser.teacher_info);

              // Initialize push notifications after successful authentication
              try {
                await pushNotificationService.initialize();
                console.log('✅ [checkAuth] Push notifications initialized');
              } catch (pushError) {
                console.warn('⚠️ [checkAuth] Failed to initialize push notifications:', pushError);
              }

              setLoading(false);
              return true;
            }
          } else {
            console.warn('❌ [checkAuth] ERP endpoint failed:', response.status);
          }

          // Fallback: Try frappe auth endpoint
          console.log('🔄 [checkAuth] Trying frappe auth endpoint...');
          const fallbackResponse = await fetch(
            `${getApiBaseUrl()}/api/method/frappe.auth.get_logged_user`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (fallbackResponse.ok) {
            const response = await fallbackResponse.json();
            const userData = response.message || response;
            console.log('✅ [checkAuth] Fallback user data fetched from frappe auth');

            // Normalize user data from Frappe endpoint
            let normalizedUser = normalizeUserData(userData, 'frappe');
            const roles = normalizedUser.roles || [];
            if (!hasRequiredMobileRole(roles)) {
              console.warn('[checkAuth fallback] User lacks mobile roles');
              await logout();
              setLoading(false);
              return false;
            }
            normalizedUser = await attachAvatarCacheBust(normalizedUser);

            setUser(normalizedUser);
            // Save normalized user data to AsyncStorage
            await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
            await AsyncStorage.setItem('userId', normalizedUser.email);
            await AsyncStorage.setItem('userFullname', normalizedUser.fullname);
            await AsyncStorage.setItem('userJobTitle', normalizedUser.jobTitle);
            await AsyncStorage.setItem('userDepartment', normalizedUser.department);
            await AsyncStorage.setItem('userRole', normalizedUser.role);
            await AsyncStorage.setItem('userEmployeeCode', normalizedUser.employeeCode);
            await AsyncStorage.setItem('userAvatarUrl', normalizedUser.avatar);
            await AsyncStorage.setItem('userRoles', JSON.stringify(normalizedUser.roles || []));
            await persistTeacherInfo(normalizedUser.teacher_info);

            // Initialize push notifications after successful authentication
            try {
              await pushNotificationService.initialize();
              console.log('✅ [checkAuth fallback] Push notifications initialized');
            } catch (pushError) {
              console.warn(
                '⚠️ [checkAuth fallback] Failed to initialize push notifications:',
                pushError
              );
            }

            setLoading(false);
            return true;
          } else {
            console.warn(
              '❌ [checkAuth] Frappe auth endpoint also failed:',
              fallbackResponse.status
            );
          }
        } catch (error) {
          console.error('❌ [checkAuth] Error validating token:', error);
          await logout();
          setLoading(false);
          return false;
        }
      }
    } catch (error) {
      console.error('❌ [checkAuth] General error:', error);
      await logout();
      setLoading(false);
      console.log('🔄 [checkAuth] Authentication check completed with result: false (error)');
      return false;
    }

    setLoading(false);
    console.log('🔄 [checkAuth] Authentication check completed with result: false (end)');
    return false;
  }, [logout, attachAvatarCacheBust, refreshUserData]);

  // Gọi checkAuth sau khi định nghĩa để tránh lỗi dùng trước khi khai báo
  useEffect(() => {
    console.log('🔄 [AuthProvider] useEffect triggered, calling checkAuth');
    try {
      checkAuth();
    } catch (error) {
      console.error('❌ [AuthProvider] Error in checkAuth:', error);
    }
  }, []);

  const login = async (token: string, userData: any) => {
    try {
      setLoading(true);
      console.log('🔄 [login] Saving regular token and user data');

      // Lưu token trước
      await AsyncStorage.setItem('authToken', token);

      // Save user information
      if (userData) {
        const provider = userData.provider || 'local';
        const normalized = normalizeUserData(userData, provider);
        const roles = normalized.roles || [];
        if (!hasRequiredMobileRole(roles)) {
          console.warn('[login] User does not have required mobile roles');
          await AsyncStorage.removeItem('authToken');
          throw new Error('NO_MOBILE_ACCESS');
        }
        const withBust = await attachAvatarCacheBust(normalized);

        // Lưu TẤT CẢ thông tin vào AsyncStorage - CHUẨN HÓA
        await AsyncStorage.setItem('user', JSON.stringify(withBust));
        await AsyncStorage.setItem('userId', withBust._id || withBust.email);
        await AsyncStorage.setItem('userFullname', withBust.fullname || '');
        await AsyncStorage.setItem('userJobTitle', withBust.jobTitle || '');
        await AsyncStorage.setItem('userDepartment', withBust.department || '');
        await AsyncStorage.setItem('userRole', withBust.role || 'user');
        await AsyncStorage.setItem('userRoles', JSON.stringify(roles));
        await AsyncStorage.setItem('userEmployeeCode', withBust.employeeCode || '');
        await AsyncStorage.setItem('userAvatarUrl', withBust.avatar || '');

        setUser(withBust);
        await persistTeacherInfo(withBust.teacher_info);

        console.log('✅ [login] Initial user data saved:', {
          fullname: withBust.fullname,
          email: withBust.email,
          roles: roles,
          provider: provider,
        });

        // Initialize push notifications after successful login
        try {
          await pushNotificationService.initialize();
          console.log('✅ [login] Push notifications initialized');
        } catch (pushError) {
          console.warn('⚠️ [login] Failed to initialize push notifications:', pushError);
        }

        // QUAN TRỌNG: Gọi refreshUserData để lấy đầy đủ thông tin (teacher_info, avatar mới nhất)
        try {
          console.log('🔄 [login] Fetching enriched user data...');
          await refreshUserData();
          console.log('✅ [login] Enriched user data fetched successfully');
        } catch (e) {
          console.warn('[login] refreshUserData after login failed:', e);
          // Không throw error vì đăng nhập vẫn thành công
        }
      }
    } catch (error) {
      console.error('❌ [login] Error saving login data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithMicrosoft = async (authResponse: MicrosoftAuthResponse) => {
    try {
      setLoading(true);
      console.log('🔄 [loginWithMicrosoft] Processing Microsoft authentication');

      if (!authResponse.success || !authResponse.token || !authResponse.user) {
        throw new Error('Invalid Microsoft authentication response');
      }

      // Lưu token trước - QUAN TRỌNG: giống như login() thường
      await AsyncStorage.setItem('authToken', authResponse.token);

      // Normalize user data - giống như login() thường
      let normalizedUser = normalizeUserData(authResponse.user, 'microsoft');
      const roles = normalizedUser.roles || [];
      if (!hasRequiredMobileRole(roles)) {
        console.warn('[loginWithMicrosoft] User lacks required mobile roles');
        await AsyncStorage.removeItem('authToken');
        throw new Error('NO_MOBILE_ACCESS');
      }
      normalizedUser = await attachAvatarCacheBust(normalizedUser);

      // Lưu TẤT CẢ thông tin vào AsyncStorage - CHUẨN HÓA giống như login() thường
      await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
      await AsyncStorage.setItem('userId', normalizedUser._id || normalizedUser.email);
      await AsyncStorage.setItem(
        'userFullname',
        normalizedUser.fullname || normalizedUser.full_name || ''
      );
      await AsyncStorage.setItem('userJobTitle', normalizedUser.jobTitle || '');
      await AsyncStorage.setItem('userDepartment', normalizedUser.department || '');
      await AsyncStorage.setItem('userRole', normalizedUser.role || 'user');
      await AsyncStorage.setItem('userRoles', JSON.stringify(normalizedUser.roles || []));
      await AsyncStorage.setItem('userEmployeeCode', normalizedUser.employeeCode || '');
      await AsyncStorage.setItem('userAvatarUrl', normalizedUser.avatar || '');

      // Set user state
      setUser(normalizedUser);
      await persistTeacherInfo(normalizedUser.teacher_info);

      console.log('✅ [loginWithMicrosoft] Initial user data saved:', {
        fullname: normalizedUser.fullname,
        email: normalizedUser.email,
        roles: normalizedUser.roles,
        provider: normalizedUser.provider,
      });

      // Initialize push notifications after successful Microsoft login
      try {
        await pushNotificationService.initialize();
        console.log('✅ [loginWithMicrosoft] Push notifications initialized');
      } catch (pushError) {
        console.warn('⚠️ [loginWithMicrosoft] Failed to initialize push notifications:', pushError);
      }

      // QUAN TRỌNG: Gọi refreshUserData để lấy đầy đủ thông tin (teacher_info, avatar mới nhất)
      // Phải await để đảm bảo có dữ liệu trước khi hiển thị
      try {
        console.log('🔄 [loginWithMicrosoft] Fetching enriched user data...');
        await refreshUserData();
        console.log('✅ [loginWithMicrosoft] Enriched user data fetched successfully');
      } catch (e) {
        console.warn('[loginWithMicrosoft] refreshUserData after login failed:', e);
        // Không throw error vì đăng nhập vẫn thành công
      }

      console.log(
        '✅ [loginWithMicrosoft] Microsoft authentication completed with normalized user:',
        {
          fullname: normalizedUser.fullname,
          jobTitle: normalizedUser.jobTitle,
          department: normalizedUser.department,
          role: normalizedUser.role,
        }
      );
    } catch (error) {
      console.error('❌ [loginWithMicrosoft] Error processing Microsoft auth:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Hàm xóa thông tin đăng nhập sinh trắc học (chỉ gọi khi muốn xóa thủ công)
  const clearBiometricCredentials = async () => {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      console.log('Đã xóa thông tin đăng nhập FaceID/TouchID');
    } catch (error) {
      console.error('Lỗi khi xóa thông tin đăng nhập FaceID/TouchID:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        loginWithMicrosoft,
        logout,
        checkAuth,
        clearBiometricCredentials,
        refreshUserData,
        bumpAvatarCacheBust,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
};
