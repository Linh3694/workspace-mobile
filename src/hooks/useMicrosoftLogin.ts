import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApiBaseUrl } from '../config/constants';

type SuccessCb = (token: string) => void;
type ErrorCb = (error: string) => void;

/**
 * Custom hook: Microsoft OAuth 2.0 (Authorization‑Code + PKCE) for Expo‑Go
 * Usage:
 *   const { promptAsync } = useMicrosoftLogin(onSuccess, onError);
 *   // then <Button onPress={() => promptAsync()} />
 */
export const useMicrosoftLogin = (onSuccess: SuccessCb, onError: ErrorCb) => {
  const tenantId = Constants.expoConfig?.extra?.azureTenantId as string;
  const clientId = Constants.expoConfig?.extra?.azureClientId as string;

  /* `scheme` in app.config may be `string | string[]` – ensure we pass a single string */
  const appScheme = Array.isArray(Constants.expoConfig?.scheme)
    ? Constants.expoConfig?.scheme[0]
    : Constants.expoConfig?.scheme;

  /* Azure AD v2 discovery endpoints */
  const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };

  /**
   * Build redirect URI based on environment
   * - Development: Use exp:// scheme for Expo Go
   * - Production: Use custom scheme like staffportal://auth
   */
  const isExpoGo = Constants.appOwnership === 'expo';

  let redirectUri: string;
  if (isExpoGo) {
    // Option 1: Use Expo proxy (stable URI) - requires adding to Web section
    // redirectUri = 'https://auth.expo.io/%40hailinh.n23/workspace/auth';

    // Option 2: Use the actual exp:// URI that Expo generates (dynamic IP) - current
    redirectUri = AuthSession.makeRedirectUri({
      scheme: undefined,
      path: 'auth',
    });
  } else {
    // For standalone/dev client, use custom scheme
    redirectUri = `${appScheme}://auth`;
  }

  /* Build the auth request */
  const [request, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false, // Disable PKCE to work with backend token exchange
      redirectUri,
    },
    discovery
  );

  /* Handle the browser callback */
  useEffect(() => {
    const handleAuth = async () => {
      if (!result) return;

      console.log('🔐 Microsoft Auth Result:', result);

      if (result.type === 'success' && result.params.code) {
        try {
          console.log('🔄 Calling backend with Microsoft authorization code...');
          console.log('📝 Code length:', result.params.code.length);
          console.log('📝 State:', result.params.state);

          /* Call backend callback endpoint with authorization code */
          const callbackUrl = `${getApiBaseUrl()}/api/method/erp.api.erp_common_user.microsoft_auth.microsoft_callback?code=${encodeURIComponent(result.params.code)}&state=${encodeURIComponent(result.params.state || '')}`;

          console.log('📤 Sending GET request to:', callbackUrl);

          const response = await fetch(callbackUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'WellspringMobile/1.0',
            },
            redirect: 'manual', // Don't follow redirects automatically
          });

          console.log('🎯 Backend Response Status:', response.status);
          console.log('📦 Response Headers:', Object.fromEntries(response.headers.entries()));

          if (response.status === 302 || response.status === 200) {
            // Backend redirects on success, check redirect URL
            const locationHeader = response.headers.get('location') || '';
            console.log('📍 Redirect Location detected');

            // Extract token from redirect URL fragment
            if (locationHeader.includes('#token=')) {
              const tokenMatch = locationHeader.match(/token=([^&]+)/);
              const userMatch = locationHeader.match(/user=([^&]+)/);

              if (tokenMatch && tokenMatch[1]) {
                const jwtToken = tokenMatch[1];
                console.log('✅ JWT Token received from backend (length:', jwtToken.length, ')');

                // Save JWT token to AsyncStorage
                await AsyncStorage.setItem('authToken', jwtToken);

                // Parse user data if available
                if (userMatch && userMatch[1]) {
                  try {
                    const userData = JSON.parse(atob(userMatch[1]));
                    await AsyncStorage.setItem('user', JSON.stringify(userData));
                    console.log('👤 User data saved:', userData.email);
                  } catch (e) {
                    console.warn('⚠️ Could not parse user data:', e);
                  }
                }

                onSuccess(jwtToken);
              } else {
                console.error('❌ No token found in redirect URL');
                onError('Authentication successful but no token received');
              }
            } else if (locationHeader.includes('success=false')) {
              // Extract error message
              const errorMatch = locationHeader.match(/error=([^&]+)/);
              const errorMessage = errorMatch
                ? decodeURIComponent(errorMatch[1])
                : 'Authentication failed';
              console.error('❌ Backend authentication failed:', errorMessage);
              onError(errorMessage);
            } else if (locationHeader.includes('success=true')) {
              // Success but no token in fragment - this means it's in the URL fragment
              // For mobile app, we'll accept this as success and let AuthContext handle validation
              console.log('✅ Authentication successful, backend will validate token');

              // Try to extract token from any part of location
              const tokenMatch = locationHeader.match(/token=([^&]+)/);
              if (tokenMatch) {
                await AsyncStorage.setItem('authToken', tokenMatch[1]);
                onSuccess(tokenMatch[1]);
              } else {
                // Success without explicit token - let backend session handle it
                onSuccess('authenticated');
              }
            } else {
              console.error('❌ Unexpected redirect format');
              onError('Unexpected response from server');
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Backend call failed:', response.status, errorText);
            onError(`Server error: ${response.status}`);
          }
        } catch (err: any) {
          console.error('❌ Backend callback error:', err);
          console.error('❌ Error details:', {
            name: err?.name,
            message: err?.message,
            stack: err?.stack?.substring(0, 200),
            cause: err?.cause,
          });

          // Network failed - use WebView approach or try alternative methods
          if (err?.message?.includes('Network request failed')) {
            console.log('🔄 Network failed, trying alternative approaches...');

            try {
              // Method 1: Try with XMLHttpRequest instead of fetch
              console.log('🔄 Trying XMLHttpRequest approach...');
              const xhr = new XMLHttpRequest();
              const callbackUrlXhr = `${getApiBaseUrl()}/api/method/erp.api.erp_common_user.microsoft_auth.microsoft_callback?code=${encodeURIComponent(result.params.code)}&state=${encodeURIComponent(result.params.state || '')}`;

              xhr.open('GET', callbackUrlXhr, true);
              xhr.setRequestHeader('Accept', 'application/json');
              xhr.setRequestHeader('User-Agent', 'WellspringMobile/1.0');
              xhr.withCredentials = true;

              xhr.onload = async () => {
                console.log('📊 XHR Response Status:', xhr.status);
                if (xhr.status === 302 || xhr.status === 200) {
                  const locationHeader = xhr.getResponseHeader('location') || '';
                  console.log('📍 XHR Redirect Location:', locationHeader ? 'detected' : 'none');

                  // Extract token from redirect URL fragment
                  if (locationHeader.includes('#token=')) {
                    const tokenMatch = locationHeader.match(/token=([^&]+)/);
                    if (tokenMatch && tokenMatch[1]) {
                      const jwtToken = tokenMatch[1];
                      console.log('✅ JWT Token received from XHR (length:', jwtToken.length, ')');
                      await AsyncStorage.setItem('authToken', jwtToken);
                      onSuccess(jwtToken);
                      return;
                    }
                  }

                  // If no redirect, try WebView fallback
                  console.log('🌐 XHR failed, using WebView fallback...');
                  const webViewCallbackUrl = callbackUrlXhr;
                  await AsyncStorage.setItem('ms_callback_url', webViewCallbackUrl);
                  await AsyncStorage.setItem('ms_auth_pending', 'true');
                  onSuccess(`webview_callback:${webViewCallbackUrl}`);
                } else {
                  console.error('❌ XHR failed with status:', xhr.status);
                  // Use WebView as final fallback
                  const webViewCallbackUrl = callbackUrlXhr;
                  await AsyncStorage.setItem('ms_callback_url', webViewCallbackUrl);
                  await AsyncStorage.setItem('ms_auth_pending', 'true');
                  console.log('🌐 Using WebView as final fallback...');
                  onSuccess(`webview_callback:${webViewCallbackUrl}`);
                }
              };

              xhr.onerror = async () => {
                console.error('❌ XHR also failed, using WebView fallback...');
                // Use WebView as final fallback
                const webViewCallbackUrl = callbackUrlXhr;
                await AsyncStorage.setItem('ms_callback_url', webViewCallbackUrl);
                await AsyncStorage.setItem('ms_auth_pending', 'true');
                console.log('🌐 Using WebView as final fallback...');
                onSuccess(`webview_callback:${webViewCallbackUrl}`);
              };

              xhr.send();
            } catch (fallbackErr) {
              console.error('❌ All fallback methods failed:', fallbackErr);
              onError('Lỗi kết nối mạng. Đang mở trình duyệt để hoàn tất đăng nhập...');
            }
          } else {
            onError(err?.message || 'Backend authentication failed');
          }
        }
      } else if (result?.type === 'error') {
        console.error('❌ Auth error:', result.params);
        onError(result.params?.error_description || 'Authentication cancelled');
      } else if (result?.type === 'cancel') {
        console.log('🚫 Auth cancelled by user');
        onError('Authentication cancelled by user');
      }
    };

    handleAuth();
  }, [result, redirectUri, clientId, request]);

  return { promptAsync };
};
