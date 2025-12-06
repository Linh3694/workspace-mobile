import React, { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import UpdateRequiredModal from './UpdateRequiredModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SKIP_UPDATE_KEY = 'skipUpdateVersion';
const SKIP_UPDATE_DURATION = 24 * 60 * 60 * 1000; // 24 giờ

interface VersionCheckerProps {
  children: React.ReactNode;
}

export const VersionChecker: React.FC<VersionCheckerProps> = ({ children }) => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [hasCheckedSkip, setHasCheckedSkip] = useState(false);
  
  const {
    currentVersion,
    latestVersion,
    needsUpdate,
    isChecking,
    openStore,
  } = useVersionCheck();

  // Kiểm tra xem người dùng đã skip update này chưa
  useEffect(() => {
    const checkSkippedVersion = async () => {
      if (isChecking || !latestVersion) return;

      try {
        const skipData = await AsyncStorage.getItem(SKIP_UPDATE_KEY);
        if (skipData) {
          const { version, timestamp } = JSON.parse(skipData);
          const now = Date.now();
          
          // Nếu đã skip version này trong vòng 24h, không hiển thị modal
          if (version === latestVersion && now - timestamp < SKIP_UPDATE_DURATION) {
            console.log('📱 Skip update modal - user skipped recently');
            setHasCheckedSkip(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking skipped version:', error);
      }
      
      setHasCheckedSkip(true);
      
      // Hiển thị modal nếu cần update
      if (needsUpdate && latestVersion) {
        console.log('📱 Showing update modal');
        setShowUpdateModal(true);
      }
    };

    checkSkippedVersion();
  }, [isChecking, needsUpdate, latestVersion]);

  const handleUpdate = () => {
    openStore();
  };

  const handleLater = async () => {
    try {
      // Lưu lại version đã skip và thời gian
      await AsyncStorage.setItem(
        SKIP_UPDATE_KEY,
        JSON.stringify({
          version: latestVersion,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error saving skipped version:', error);
    }
    setShowUpdateModal(false);
  };

  return (
    <>
      {children}
      {hasCheckedSkip && latestVersion && (
        <UpdateRequiredModal
          visible={showUpdateModal}
          currentVersion={currentVersion}
          latestVersion={latestVersion}
          onUpdate={handleUpdate}
          onLater={handleLater}
          forceUpdate={false} // Set true nếu muốn bắt buộc update
        />
      )}
    </>
  );
};

export default VersionChecker;

