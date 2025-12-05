import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/constants';

export interface MicrosoftAuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  expires_in?: number;
  user?: {
    email: string;
    full_name: string;
    first_name: string;
    last_name: string;
    provider: string;
    microsoft_id?: string;
    job_title: string;
    department: string;
    employee_code: string;
    user_role: string;
    roles: string[];
    active: boolean;
    username: string;
    user_image: string;
    account_enabled: boolean;
    // Teacher info - thêm để đồng bộ với local login
    teacher_info?: {
      homeroom_class_ids?: string[];
      vice_homeroom_class_ids?: string[];
      teaching_class_ids?: string[];
    };
    avatar?: string;
    avatar_url?: string;
  };
  error?: string;
  error_code?: string;
  details?: string;
  user_email?: string;
}

export interface MicrosoftAuthStatus {
  success: boolean;
  microsoft_auth_available: boolean;
  tenant_id: string | null;
  client_id: string | null;
  error?: string;
}

class MicrosoftAuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Check if Microsoft authentication is available on the server
   */
  async getAuthStatus(): Promise<MicrosoftAuthStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/method/erp.api.erp_common_user.mobile_microsoft_auth.mobile_auth_status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.message || data;
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [MicrosoftAuthService] Error checking auth status:', error);
      return {
        success: false,
        microsoft_auth_available: false,
        tenant_id: null,
        client_id: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Authenticate with Microsoft using authorization code from OAuth flow
   */
  async authenticateWithCode(
    authorizationCode: string,
    state?: string,
    redirectUri?: string
  ): Promise<MicrosoftAuthResponse> {
    try {
      console.log('🔄 [MicrosoftAuthService] Authenticating with code...');
      console.log('📝 [MicrosoftAuthService] Code length:', authorizationCode.length);
      console.log('📝 [MicrosoftAuthService] State:', state);
      console.log('📝 [MicrosoftAuthService] RedirectUri:', redirectUri);

      const endpoint = `${this.baseUrl}/api/method/erp.api.erp_common_user.mobile_microsoft_auth.mobile_microsoft_callback`;
      console.log('📤 [MicrosoftAuthService] POST to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'WellspringMobile/2.0',
        },
        body: JSON.stringify({ code: authorizationCode, state, redirect_uri: redirectUri }),
      });

      console.log('🎯 [MicrosoftAuthService] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const result = data.message || data;

        // Debug: log full response để xem chi tiết
        console.log('📋 [MicrosoftAuthService] Full response data:', JSON.stringify(data, null, 2));
        console.log('📋 [MicrosoftAuthService] Full result:', JSON.stringify(result, null, 2));

        // Normalize to flat shape: { success, token, user, expires_in, error, error_code }
        let normalized: MicrosoftAuthResponse;
        if (result && typeof result === 'object' && 'data' in result) {
          const payload: any = (result as any).data || {};
          normalized = {
            success: !!(result as any).success,
            token: payload.token,
            user: payload.user,
            expires_in: payload.expires_in,
            error: (result as any).error,
            error_code: (result as any).error_code,
          } as MicrosoftAuthResponse;
        } else {
          normalized = result as MicrosoftAuthResponse;
        }

        console.log('✅ [MicrosoftAuthService] Authentication result (normalized):', {
          success: normalized.success,
          hasToken: !!normalized.token,
          hasUser: !!normalized.user,
          userEmail: normalized.user?.email,
          error: normalized.error,
          errorCode: normalized.error_code,
        });

        return normalized;
      } else {
        const errorText = await response.text();
        console.error('❌ [MicrosoftAuthService] Server error:', response.status, errorText);

        try {
          const errorData = JSON.parse(errorText);
          return {
            success: false,
            error: errorData.exception || errorData.message || `Server error: ${response.status}`,
            error_code: 'SERVER_ERROR',
          };
        } catch {
          return {
            success: false,
            error: `Server error: ${response.status}`,
            error_code: 'SERVER_ERROR',
          };
        }
      }
    } catch (error) {
      console.error('❌ [MicrosoftAuthService] Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
        error_code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Authenticate with Microsoft using an existing Microsoft access token
   * (Alternative method for apps that already have Microsoft token)
   */
  async authenticateWithToken(microsoftToken: string): Promise<MicrosoftAuthResponse> {
    try {
      console.log('🔄 [MicrosoftAuthService] Authenticating with Microsoft token...');

      const response = await fetch(
        `${this.baseUrl}/api/method/erp.api.erp_common_user.mobile_microsoft_auth.mobile_direct_token_auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'WellspringMobile/2.0',
          },
          body: JSON.stringify({
            microsoft_token: microsoftToken,
          }),
        }
      );

      console.log('🎯 [MicrosoftAuthService] Token auth response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const result = data.message || data;

        // Normalize shape to flat
        let normalized: MicrosoftAuthResponse;
        if (result && typeof result === 'object' && 'data' in result) {
          const payload: any = (result as any).data || {};
          normalized = {
            success: !!(result as any).success,
            token: payload.token,
            user: payload.user,
            expires_in: payload.expires_in,
            error: (result as any).error,
            error_code: (result as any).error_code,
          } as MicrosoftAuthResponse;
        } else {
          normalized = result as MicrosoftAuthResponse;
        }

        console.log('✅ [MicrosoftAuthService] Token authentication result (normalized):', {
          success: normalized.success,
          hasToken: !!normalized.token,
          userEmail: normalized.user?.email,
        });

        return normalized;
      } else {
        const errorText = await response.text();
        console.error('❌ [MicrosoftAuthService] Token auth error:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          return {
            success: false,
            error: errorData.message || `Server error: ${response.status}`,
            error_code: 'TOKEN_AUTH_ERROR',
          };
        } catch {
          return {
            success: false,
            error: `Server error: ${response.status}`,
            error_code: 'TOKEN_AUTH_ERROR',
          };
        }
      }
    } catch (error) {
      console.error('❌ [MicrosoftAuthService] Token auth network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
        error_code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Save authentication data to AsyncStorage
   */
  async saveAuthData(response: MicrosoftAuthResponse): Promise<void> {
    if (response.success && response.token && response.user) {
      try {
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        await AsyncStorage.setItem('userId', response.user.email);
        await AsyncStorage.setItem('userFullname', response.user.full_name);
        await AsyncStorage.setItem('userJobTitle', response.user.job_title || '');
        await AsyncStorage.setItem('userDepartment', response.user.department || '');
        await AsyncStorage.setItem('userRole', response.user.user_role || 'user');
        await AsyncStorage.setItem('userRoles', JSON.stringify(response.user.roles || []));
        await AsyncStorage.setItem('userEmployeeCode', response.user.employee_code || '');
        await AsyncStorage.setItem('userAvatarUrl', response.user.user_image || '');

        console.log('✅ [MicrosoftAuthService] Auth data saved to AsyncStorage');
      } catch (error) {
        console.error('❌ [MicrosoftAuthService] Error saving auth data:', error);
        throw error;
      }
    } else {
      throw new Error('Invalid authentication response');
    }
  }

  /**
   * Clear any stored Microsoft auth state
   */
  async clearAuthState(): Promise<void> {
    try {
      await AsyncStorage.removeItem('ms_auth_state');
      await AsyncStorage.removeItem('ms_auth_code');
      await AsyncStorage.removeItem('ms_callback_url');
      await AsyncStorage.removeItem('ms_show_webview');
      await AsyncStorage.removeItem('ms_auth_pending');

      console.log('🧹 [MicrosoftAuthService] Auth state cleared');
    } catch (error) {
      console.warn('⚠️ [MicrosoftAuthService] Error clearing auth state:', error);
    }
  }
}

export const microsoftAuthService = new MicrosoftAuthService();
