import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { API_BASE_URL } from '../config/constants';

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  minVersion: string | null;
  storeUrl: string | null;
  needsUpdate: boolean;
  forceUpdate: boolean;
  isChecking: boolean;
  error: string | null;
  isProduction: boolean;
}

// Fallback store URLs
const IOS_STORE_URL = 'https://apps.apple.com/app/id6746143732';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.hailinh.n23.workspace';

export const useVersionCheck = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    currentVersion: '',
    latestVersion: null,
    minVersion: null,
    storeUrl: null,
    needsUpdate: false,
    forceUpdate: false,
    isChecking: true,
    error: null,
    isProduction: true,
  });

  const checkVersion = useCallback(async () => {
    try {
      setVersionInfo((prev) => ({ ...prev, isChecking: true, error: null }));

      // Lấy version hiện tại - ưu tiên từ app.json config, fallback sang native version
      // Lưu ý: Khi chạy trong Expo Go, nativeApplicationVersion sẽ trả về version của Expo Go
      const currentVersion =
        Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';
      const platform = Platform.OS;

      // Gọi API backend để check version
      const response = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.app_version.check_update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_id: 'wis_staff',
            platform: platform,
            current_version: currentVersion,
          }),
        }
      );

      const data = await response.json();
      const result = data.message;

      if (result?.success) {
        console.log('📱 Version Check:', {
          currentVersion,
          latestVersion: result.latest_version,
          needsUpdate: result.needs_update,
          forceUpdate: result.force_update,
          platform,
        });

        setVersionInfo({
          currentVersion,
          latestVersion: result.latest_version,
          minVersion: result.min_version,
          storeUrl: result.store_url,
          needsUpdate: result.needs_update,
          forceUpdate: result.force_update,
          isChecking: false,
          error: null,
          isProduction: true,
        });
      } else {
        // API failed, skip update check
        console.warn('📱 Version Check API failed:', result?.error);
        setVersionInfo((prev) => ({
          ...prev,
          currentVersion,
          isChecking: false,
          needsUpdate: false,
          forceUpdate: false,
          error: result?.error || 'API error',
        }));
      }
    } catch (error) {
      console.error('❌ Error checking version:', error);
      // Network error - skip update check, don't block user
      const currentVersion =
        Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';
      setVersionInfo((prev) => ({
        ...prev,
        currentVersion,
        isChecking: false,
        needsUpdate: false,
        forceUpdate: false,
        error: error instanceof Error ? error.message : 'Network error',
      }));
    }
  }, []);

  const openStore = useCallback(async () => {
    try {
      let url = versionInfo.storeUrl;

      if (!url) {
        url = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open store URL:', url);
      }
    } catch (error) {
      console.error('Error opening store:', error);
    }
  }, [versionInfo.storeUrl]);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  return {
    ...versionInfo,
    checkVersion,
    openStore,
  };
};
