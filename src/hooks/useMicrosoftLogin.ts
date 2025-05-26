import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { API_BASE_URL } from '../config/constants';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
    authorizationEndpoint: `${API_BASE_URL}/api/auth/microsoft`,
    tokenEndpoint: `${API_BASE_URL}/api/auth/microsoft/callback`,
};

export const useMicrosoftLogin = (onSuccess: (token: string) => void) => {
    const redirectUri = makeRedirectUri({
        scheme: 'staffportal',
    });

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: '0a39cc1e-f792-457d-8f99-f9c270243665',
            scopes: ['openid', 'profile', 'email'],
            redirectUri,
            responseType: 'code',
            extraParams: {
                mobile: 'true',
                redirectUri: redirectUri
            }
        },
        discovery
    );

    useEffect(() => {
        if (response?.type === 'success') {
            // Lấy token từ response.params.token được trả về từ backend
            const token = response.params.token;
            if (token) onSuccess(token);
        }
    }, [response]);

    return { request, promptAsync };
}; 