import React, { useState, useEffect } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

type SuccessCb = (credential: AppleAuthentication.AppleAuthenticationCredential) => void;
type ErrorCb = (error: string) => void;

/**
 * Custom hook: Apple Authentication for iOS
 * Usage:
 *   const { signInAsync, isAvailable } = useAppleLogin(onSuccess, onError);
 *   // then <Button onPress={() => signInAsync()} />
 */
export const useAppleLogin = (
  onSuccess: SuccessCb,
  onError: ErrorCb
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAvailability = async () => {
      if (Platform.OS === 'ios') {
        try {
          const available = await AppleAuthentication.isAvailableAsync();
          setIsAvailable(available);
        } catch (error) {
          console.log('Apple Authentication not available:', error);
          setIsAvailable(false);
        }
      } else {
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

      console.log('✅ Apple login successful:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        identityToken: !!credential.identityToken,
        authorizationCode: !!credential.authorizationCode
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