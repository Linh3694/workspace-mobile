import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

type SuccessCb = (token: string) => void;
type ErrorCb   = (error: string) => void;

/**
 * Custom hook: Microsoft OAuth 2.0 (Authorization‑Code + PKCE) for Expo‑Go
 * Usage:
 *   const { promptAsync } = useMicrosoftLogin(onSuccess, onError);
 *   // then <Button onPress={() => promptAsync()} />
 */
export const useMicrosoftLogin = (
  onSuccess: SuccessCb,
  onError: ErrorCb
) => {
  const tenantId = Constants.expoConfig?.extra?.azureTenantId as string;
  const clientId = Constants.expoConfig?.extra?.azureClientId as string;

  /* `scheme` in app.config may be `string | string[]` – ensure we pass a single string */
  const appScheme =
    Array.isArray(Constants.expoConfig?.scheme)
      ? Constants.expoConfig?.scheme[0]
      : Constants.expoConfig?.scheme;

  /* Azure AD v2 discovery endpoints */
  const discovery = {
    authorizationEndpoint:
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint:
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
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
    console.log('🔗 Generated Expo URI (add this exact URI to Azure AD):', redirectUri);
    console.log('🔗 Current IP-based URI - may change with network');
    console.log('🔗 Alternative stable URI: https://auth.expo.io/%40hailinh.n23/workspace/auth');
  } else {
    // For standalone/dev client, use custom scheme
    redirectUri = `${appScheme}://auth`;
    console.log('🔗 Using custom scheme for production/standalone');
  }

  // Log for debugging
  console.log('🔗 Microsoft Auth Config:', {
    isExpoGo,
    appScheme,
    redirectUri,
    appOwnership: Constants.appOwnership,
    clientId,
  });

  /* Build the auth request */
  const [request, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
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
          console.log('🔄 Exchanging code for tokens...');
          
          /* Exchange code → tokens */
          const body = new URLSearchParams({
            client_id: clientId,
            scope: 'openid profile email',
            code: result.params.code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: request?.codeVerifier ?? '',
          }).toString();

          const tokenRes = await fetch(discovery.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          }).then(r => r.json());

          console.log('🎯 Token Response:', { success: !!tokenRes.access_token });

          if (tokenRes.access_token) {
            await SecureStore.setItemAsync('ms_access_token', tokenRes.access_token);
            onSuccess(tokenRes.access_token);
          } else {
            console.error('❌ Token exchange failed:', tokenRes);
            onError(tokenRes.error_description || 'Token exchange failed');
          }
        } catch (err: any) {
          console.error('❌ Token exchange error:', err);
          onError(err?.message || 'Token exchange failed');
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