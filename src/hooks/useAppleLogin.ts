import { useState, useEffect } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';

type SuccessCb = (credential: AppleAuthentication.AppleAuthenticationCredential) => void;
type ErrorCb = (error: string) => void;

export const useAppleLogin = (
  onSuccess: SuccessCb,
  onError: ErrorCb
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAvailability = async () => {    
      // Apple Sign In is only available on iOS
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        setIsAvailable(available);
        if (!available) {
          console.warn('⚠️ Apple Authentication is not available on this device');
        }
      } catch (error) {
        console.error('❌ Apple Authentication availability check failed:', error);
        setIsAvailable(false);
      }
    };
    
    checkAvailability();
  }, []);

  const signInAsync = async () => {
    if (!isAvailable) {
      onError('Apple Authentication không khả dụng trên thiết bị này');
      return;
    }

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      onSuccess(credential);
    } catch (error: any) {
      console.error('❌ Apple login error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        onError('Người dùng đã hủy đăng nhập Apple');
      } else {
        onError(`Lỗi đăng nhập Apple: ${error.message || 'Không xác định'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInAsync,
    isAvailable,
    isLoading
  };
}; 