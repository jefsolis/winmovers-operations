import { useState, useEffect, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { AAD_CLIENT_ID, aadDiscovery } from './msalConfig';

WebBrowser.maybeCompleteAuthSession();

const ACCESS_TOKEN_KEY = 'wm_access_token';
const REFRESH_TOKEN_KEY = 'wm_refresh_token';
const TOKEN_EXPIRY_KEY = 'wm_token_expiry';
const USER_NAME_KEY = 'wm_user_name';

// In Expo Go, makeRedirectUri() returns exp://IP:PORT.
// Register that exact URI in Azure AD as a Mobile/Desktop redirect URI.
// Run `npx expo start --tunnel` for a stable URL across network changes.
const USE_PROXY = false;
const redirectUri = AuthSession.makeRedirectUri();

export async function getAccessToken(): Promise<string | null> {
  const bufferMs = 2 * 60 * 1000;
  const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const storedExpiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
  const storedRefresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

  if (stored && storedExpiry) {
    const expiry = parseInt(storedExpiry, 10);
    if (Date.now() < expiry - bufferMs) return stored;
  }

  if (storedRefresh) {
    try {
      const result = await AuthSession.refreshAsync(
        { clientId: AAD_CLIENT_ID, refreshToken: storedRefresh, scopes: [`api://${AAD_CLIENT_ID}/access_as_user`, 'offline_access'] },
        aadDiscovery
      );
      const expiry = result.expiresIn
        ? Date.now() + result.expiresIn * 1000
        : Date.now() + 3600 * 1000;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, result.accessToken);
      await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(expiry));
      if (result.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
      }
      return result.accessToken;
    } catch {
      return stored;
    }
  }
  return null;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  userName: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth(): AuthState & { login: () => Promise<void>; logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    userName: null,
    isLoading: true,
    error: null,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AAD_CLIENT_ID,
      scopes: [`api://${AAD_CLIENT_ID}/access_as_user`, 'openid', 'profile', 'offline_access'],
      redirectUri,
      usePKCE: true,
    },
    aadDiscovery
  );

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      const userName = await SecureStore.getItemAsync(USER_NAME_KEY);
      setState({ isAuthenticated: !!token, accessToken: token, userName, isLoading: false, error: null });
    })();
  }, []);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      (async () => {
        setState(s => ({ ...s, isLoading: true }));
        try {
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: AAD_CLIENT_ID,
              code: response.params.code,
              redirectUri,
              extraParams: { code_verifier: request?.codeVerifier ?? '' },
            },
            aadDiscovery
          );
          const expiry = tokenResult.expiresIn
            ? Date.now() + tokenResult.expiresIn * 1000
            : Date.now() + 3600 * 1000;
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokenResult.accessToken);
          await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(expiry));
          if (tokenResult.refreshToken) {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
          }
          let userName: string | null = null;
          if (tokenResult.idToken) {
            try {
              const payload = JSON.parse(atob(tokenResult.idToken.split('.')[1]));
              userName = payload.name ?? payload.preferred_username ?? null;
            } catch { /* ignore */ }
          }
          if (userName) await SecureStore.setItemAsync(USER_NAME_KEY, userName);
          setState({ isAuthenticated: true, accessToken: tokenResult.accessToken, userName, isLoading: false, error: null });
        } catch (err: unknown) {
          setState(s => ({ ...s, isLoading: false, error: err instanceof Error ? err.message : 'Auth failed' }));
        }
      })();
    } else if (response.type === 'error') {
      setState(s => ({ ...s, isLoading: false, error: response.error?.message ?? 'Auth error' }));
    } else if (response.type === 'cancel') {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [response]);

  const login = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    await promptAsync();
  }, [promptAsync]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
    await SecureStore.deleteItemAsync(USER_NAME_KEY);
    setState({ isAuthenticated: false, accessToken: null, userName: null, isLoading: false, error: null });
  }, []);

  return { ...state, login, logout };
}
