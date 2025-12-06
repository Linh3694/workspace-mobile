import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import VersionCheck from 'react-native-version-check-expo';
import Constants from 'expo-constants';

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  storeUrl: string | null;
  needsUpdate: boolean;
  isChecking: boolean;
  error: string | null;
  isProduction: boolean;
}

// Kiểm tra có phải production build không (không phải Expo Go hay dev build)
const isProductionBuild = (): boolean => {
  // Expo Go có appOwnership = 'expo'
  // Development build có appOwnership = 'guest' hoặc executionEnvironment khác 'standalone'
  const isExpoGo = Constants.appOwnership === 'expo';
  const isStandalone = Constants.executionEnvironment === 'standalone';
  
  // Chỉ là production khi là standalone build (không phải Expo Go, không phải dev client)
  return !isExpoGo && isStandalone;
};

export const useVersionCheck = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    currentVersion: '',
    latestVersion: null,
    storeUrl: null,
    needsUpdate: false,
    isChecking: true,
    error: null,
    isProduction: isProductionBuild(),
  });

  const checkVersion = useCallback(async () => {
    // Chỉ check version trên production build
    if (!isProductionBuild()) {
      console.log('📱 Version Check: Skipped (not production build)', {
        appOwnership: Constants.appOwnership,
        executionEnvironment: Constants.executionEnvironment,
      });
      setVersionInfo(prev => ({
        ...prev,
        isChecking: false,
        needsUpdate: false,
        currentVersion: Constants.expoConfig?.version || '0.0.0',
      }));
      return;
    }

    try {
      setVersionInfo(prev => ({ ...prev, isChecking: true, error: null }));

      const currentVersion = VersionCheck.getCurrentVersion();
      
      // Lấy version mới nhất từ store
      const latestVersion = await VersionCheck.getLatestVersion({
        provider: Platform.OS === 'ios' ? 'appStore' : 'playStore',
      });

      // Lấy store URL
      const storeUrl = await VersionCheck.getStoreUrl({
        appID: Platform.OS === 'ios' ? 'com.wellspring.workspace' : undefined,
        packageName: Platform.OS === 'android' ? 'com.hailinh.n23.workspace' : undefined,
      });

      // Kiểm tra có cần update không
      let needsUpdate = false;
      if (latestVersion && currentVersion) {
        const result = await VersionCheck.needUpdate({
          currentVersion,
          latestVersion,
        });
        needsUpdate = result?.isNeeded || false;
      }

      console.log('📱 Version Check:', {
        currentVersion,
        latestVersion,
        needsUpdate,
        storeUrl,
        isProduction: true,
      });

      setVersionInfo({
        currentVersion,
        latestVersion,
        storeUrl,
        needsUpdate,
        isChecking: false,
        error: null,
        isProduction: true,
      });
    } catch (error) {
      console.error('❌ Error checking version:', error);
      setVersionInfo(prev => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Không thể kiểm tra phiên bản',
      }));
    }
  }, []);

  const openStore = useCallback(async () => {
    try {
      let url = versionInfo.storeUrl;
      
      if (!url) {
        // Fallback URLs
        url = Platform.OS === 'ios'
          ? 'https://apps.apple.com/app/id' // Thêm App Store ID của bạn
          : 'https://play.google.com/store/apps/details?id=com.hailinh.n23.workspace';
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

