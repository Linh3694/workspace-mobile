import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/constants';
import * as ImageManipulator from 'expo-image-manipulator';

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

      // Create FormData
      const formData = new FormData();
      // Detect extension and convert HEIC/HEIF to JPEG
      const getExtensionFromUri = (uri: string): string => {
        try {
          const clean = uri.split('?')[0].split('#')[0];
          const lastDotIndex = clean.lastIndexOf('.');
          if (lastDotIndex === -1) return '';
          return clean.substring(lastDotIndex + 1).toLowerCase();
        } catch {
          return '';
        }
      };

      const ext = getExtensionFromUri(imageUri);
      const needsConvert = ext === 'heic' || ext === 'heif' || ext === '';

      let uploadUri = imageUri;
      let uploadExt = ext || 'jpg';
      let mimeType = 'image/jpeg';

      if (!needsConvert) {
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      } else {
        // Convert to JPEG for unsupported or unknown types
        const manipulated = await ImageManipulator.manipulateAsync(imageUri, [], {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        uploadUri = manipulated.uri;
        uploadExt = 'jpg';
        mimeType = 'image/jpeg';
      }

      const fileObj: any = {
        uri: uploadUri,
        type: mimeType,
        name: `user-avatar.${uploadExt}`,
      };

      formData.append('avatar', fileObj);

      // Try the original upload_avatar endpoint in auth.py first
      const response = await fetch(
        `${apiBaseUrl}/api/method/erp.api.erp_common_user.auth.upload_avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Let React Native set the correct multipart boundary automatically
            Accept: 'application/json',
          },
          body: formData,
        }
      );

      // Read raw text first to robustly handle non-JSON error bodies from proxies/servers
      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Non-JSON response. Try to give a helpful message based on status/body
        const lower = rawText.toLowerCase();
        if (response.status === 413 || lower.includes('request entity too large')) {
          return {
            success: false,
            message: 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.',
          };
        }
        if (response.status === 401 || response.status === 403 || lower.includes('please login')) {
          return {
            success: false,
            message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
          };
        }
        return {
          success: false,
          message: `Phản hồi không hợp lệ (HTTP ${response.status}).`,
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
          return {
            success: false,
            message: 'Upload completed but avatar URL not found in response',
          };
        }
      } else {
        // Frappe may wrap errors under message/exception
        const errMsg =
          (data && (data.message || data.exception || data.error)) ||
          (typeof data === 'string' ? data : '') ||
          `Upload failed with status ${response.status}`;
        return {
          success: false,
          message: errMsg,
        };
      }
    } catch {
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
    } catch {
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
    } catch {
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
