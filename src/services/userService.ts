import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/constants';

export const userService = {
  /**
   * Upload user avatar
   */
  uploadAvatar: async (
    imageUri: string
  ): Promise<{ success: boolean; avatar_url?: string; message?: string }> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiBaseUrl = getApiBaseUrl();

      // First test if auth works
      console.log('🧪 [uploadAvatar] Testing auth endpoint first...');
      const testResponse = await fetch(
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.get_current_user`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('🧪 [uploadAvatar] Auth test status:', testResponse.status);

      // Create FormData
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'user-avatar.jpg',
      } as any);

      console.log(
        '📤 [uploadAvatar] Uploading to:',
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.upload_avatar`
      );
      console.log('📤 [uploadAvatar] Token exists:', !!token);

      // Try the original upload_avatar endpoint in auth.py first
      const response = await fetch(
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.upload_avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type for FormData, let the browser set it with boundary
          },
          body: formData,
        }
      );

      console.log('📤 [uploadAvatar] Response status:', response.status);
      console.log('📤 [uploadAvatar] Response headers:', response.headers);

      const responseText = await response.text();
      console.log('📤 [uploadAvatar] Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('📤 [uploadAvatar] Failed to parse JSON:', e);
        return {
          success: false,
          message: `Invalid response format: ${responseText.substring(0, 200)}`,
        };
      }

      if (response.ok) {
        // Check different response formats
        if (data.message && data.message.avatar_url) {
          return {
            success: true,
            avatar_url: data.message.avatar_url,
            message: data.message.message,
          };
        } else if (data.avatar_url) {
          return {
            success: true,
            avatar_url: data.avatar_url,
            message: data.message,
          };
        } else {
          console.log('📤 [uploadAvatar] Unexpected success format:', data);
          return {
            success: false,
            message: 'Upload completed but avatar URL not found in response',
          };
        }
      } else {
        return {
          success: false,
          message:
            data.message ||
            data.exception ||
            data.error ||
            `Upload failed with status ${response.status}`,
        };
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return {
        success: false,
        message: 'Network error occurred',
      };
    }
  },

  /**
   * Delete user avatar
   */
  deleteAvatar: async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.delete_avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.message) {
        return {
          success: true,
          message: data.message.message,
        };
      } else {
        return {
          success: false,
          message: data.message || data.exception || 'Delete failed',
        };
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      return {
        success: false,
        message: 'Network error occurred',
      };
    }
  },

  /**
   * Get user avatar URL
   */
  getAvatarUrl: async (
    userEmail?: string
  ): Promise<{ success: boolean; avatar_url?: string; message?: string }> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiBaseUrl = getApiBaseUrl();

      const url = userEmail
        ? `${apiBaseUrl}/api/method/erp.api.erp_common_user.avatar_management.get_avatar_url?user_email=${encodeURIComponent(userEmail)}`
        : `${apiBaseUrl}/api/method/erp.api.erp_common_user.avatar_management.get_avatar_url`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.message) {
        return {
          success: true,
          avatar_url: data.message.avatar_url,
        };
      } else {
        return {
          success: false,
          message: data.message || data.exception || 'Get avatar failed',
        };
      }
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return {
        success: false,
        message: 'Network error occurred',
      };
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (profileData: any): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.update_profile`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profileData),
        }
      );

      const data = await response.json();

      if (response.ok && data.message) {
        return {
          success: true,
          message: data.message.message,
        };
      } else {
        return {
          success: false,
          message: data.message || data.exception || 'Update profile failed',
        };
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      return {
        success: false,
        message: 'Network error occurred',
      };
    }
  },
};
