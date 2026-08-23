/**
 * Azure AD OAuth2 / PKCE configuration for expo-auth-session.
 *
 * Required environment variables (via Expo's EXPO_PUBLIC_ convention):
 *   EXPO_PUBLIC_AAD_CLIENT_ID   — App Registration client ID
 *   EXPO_PUBLIC_AAD_TENANT_ID   — Azure AD tenant ID
 */

export const AAD_CLIENT_ID = process.env.EXPO_PUBLIC_AAD_CLIENT_ID ?? 'FILL_IN_CLIENT_ID';
export const AAD_TENANT_ID = process.env.EXPO_PUBLIC_AAD_TENANT_ID ?? 'FILL_IN_TENANT_ID';

export const aadDiscovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0/token`,
  revocationEndpoint: `https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0/logout`,
};
