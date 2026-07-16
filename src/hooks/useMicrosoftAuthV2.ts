import React, { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { microsoftAuthService, MicrosoftAuthResponse } from '../services/microsoftAuthService';

type SuccessCb = (response: MicrosoftAuthResponse) => void;
type ErrorCb = (error: string, errorCode?: string) => void;

/**
 * New Microsoft OAuth hook using the improved backend endpoint
 * This replaces the old problematic useMicrosoftLogin hook
 */
export const useMicrosoftAuthV2 = (onSuccess: SuccessCb, onError: ErrorCb) => {
  const tenantId = Constants.expoConfig?.extra?.azureTenantId as string;
  const clientId = Constants.expoConfig?.extra?.azureClientId as string;

  // Get app scheme for redirect URI
  const appScheme = Array.isArray(Constants.expoConfig?.scheme)
    ? Constants.expoConfig?.scheme[0]
    : Constants.expoConfig?.scheme;

  // Azure AD v2 discovery endpoints
  const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };

  // Build mobile redirect URI (now registered in Azure AD)
  const isExpoGo = Constants.appOwnership === 'expo';
  let redirectUri: string;

  if (isExpoGo) {
    redirectUri = AuthSession.makeRedirectUri({
      scheme: undefined,
      path: 'auth',
    });
  } else {
    redirectUri = `staffportal://auth`;
  }

  console.log('🔧 [MicrosoftAuthV2] Using mobile redirect URI:', redirectUri);

  // Create auth request
  const [request, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      usePKCE: false, // Disable PKCE to work with backend token exchange
      redirectUri,
      additionalParameters: {
        prompt: 'select_account', // Always show account picker
      },
    },
    discovery
  );

  // Callers pass inline callbacks, so onSuccess/onError change identity on every
  // render of the calling screen and re-run this effect with an already-consumed
  // result. An authorization code is single-use: replaying it re-POSTs the same
  // code and re-fires the callbacks. Each promptAsync() yields a new result
  // object, so identity is the right key here.
  const handledResultRef = React.useRef<AuthSession.AuthSessionResult | null>(null);

  // Handle authentication result
  useEffect(() => {
    const handleAuth = async () => {
      if (!result) return;
      if (handledResultRef.current === result) return;
      handledResultRef.current = result;

      console.log('🔐 [MicrosoftAuthV2] Auth Result:', result.type);

      if (result.type === 'success' && result.params.code) {
        try {
          console.log('✅ [MicrosoftAuthV2] Authorization code received');
          console.log('📝 [MicrosoftAuthV2] Using redirectUri:', redirectUri);

          // Call our improved backend endpoint
          const authResponse = await microsoftAuthService.authenticateWithCode(
            result.params.code,
            result.params.state,
            redirectUri
          );

          if (authResponse.success && authResponse.token && authResponse.user) {
            console.log('✅ [MicrosoftAuthV2] Authentication successful');

            // Save auth data to AsyncStorage
            await microsoftAuthService.saveAuthData(authResponse);

            // Clear any old auth state
            await microsoftAuthService.clearAuthState();

            // Call success callback
            onSuccess(authResponse);
          } else {
            console.error('❌ [MicrosoftAuthV2] Authentication failed:', authResponse.error);

            // Handle specific error cases
            if (authResponse.error_code === 'USER_NOT_REGISTERED') {
              onError(
                `Tài khoản ${authResponse.user_email || ''} chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.`,
                authResponse.error_code
              );
            } else {
              onError(
                authResponse.error || 'Đăng nhập thất bại. Vui lòng thử lại.',
                authResponse.error_code
              );
            }
          }
        } catch (error) {
          console.error('❌ [MicrosoftAuthV2] Unexpected error:', error);
          onError(
            error instanceof Error
              ? error.message
              : 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
            'UNEXPECTED_ERROR'
          );
        }
      } else if (result?.type === 'error') {
        console.error('❌ [MicrosoftAuthV2] OAuth error:', result.params);

        // Check if this is a user cancellation disguised as an error
        const errorDescription = result.params?.error_description || '';
        const errorCode = result.params?.error || '';

        if (
          errorCode === 'access_denied' &&
          (errorDescription.includes('AADSTS90135') ||
            errorDescription.includes('user decided not to continue'))
        ) {
          console.log('🚫 [MicrosoftAuthV2] User cancelled authentication (via error)');
          onError('Người dùng đã hủy đăng nhập', 'USER_CANCELLED');
        } else {
          onError(errorDescription || 'Đăng nhập bị hủy hoặc lỗi', 'OAUTH_ERROR');
        }
      } else if (result?.type === 'cancel') {
        console.log('🚫 [MicrosoftAuthV2] User cancelled authentication');
        onError('Người dùng đã hủy đăng nhập', 'USER_CANCELLED');
      }
    };

    handleAuth();
  }, [result, onSuccess, onError]);

  // Return the prompt function
  return {
    promptAsync: promptAsync || (() => Promise.resolve()),
    isReady: !!request,
  };
};

/**
 * Hook to check Microsoft auth availability on server
 */
export const useMicrosoftAuthStatus = () => {
  const [status, setStatus] = React.useState<{
    loading: boolean;
    available: boolean;
    error?: string;
  }>({
    loading: true,
    available: false,
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const authStatus = await microsoftAuthService.getAuthStatus();
        setStatus({
          loading: false,
          available: authStatus.success && authStatus.microsoft_auth_available,
          error: authStatus.error,
        });
      } catch (error) {
        setStatus({
          loading: false,
          available: false,
          error: error instanceof Error ? error.message : 'Failed to check auth status',
        });
      }
    };

    checkStatus();
  }, []);

  return status;
};

export default useMicrosoftAuthV2;
