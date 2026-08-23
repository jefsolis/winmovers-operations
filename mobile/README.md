# WinMovers Packing — Mobile App

React Native (Expo SDK 57) offline-first app for warehouse staff to create and manage Packing Lists.

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli` (for builds)
- An Android device or emulator for testing

## Local Development

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app, or press `a` to open on Android emulator.

## Environment Configuration

Create `mobile/.env` (never commit):
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/api
EXPO_PUBLIC_AAD_CLIENT_ID=<Azure AD App Registration client ID>
EXPO_PUBLIC_AAD_TENANT_ID=<Azure AD tenant ID>
```

For production, update `EXPO_PUBLIC_API_BASE_URL` to the Azure App Service URL.

## EAS Builds

```bash
# Login once
eas login

# Development build (installs dev client on device)
eas build --profile development --platform android

# Preview APK (internal testing)
eas build --profile preview --platform android

# Production APK
eas build --profile production --platform android
```

> Before first EAS build, fill in `extra.eas.projectId` in `app.json` with the value from `eas init`.

## Project Structure

```
mobile/
├── App.tsx                   # Root: DB init + Navigation container
├── app.json                  # Expo config (bundle IDs, permissions, plugins)
├── eas.json                  # EAS build profiles
├── src/
│   ├── auth/
│   │   ├── msalConfig.ts     # Azure AD OAuth config for react-native-app-auth
│   │   ├── useAuth.ts        # Auth hook (login, logout, token refresh)
│   │   ├── AuthGuard.tsx     # Redirects to LoginScreen if not authenticated
│   │   └── deviceId.ts       # Stable per-device UUID via expo-secure-store
│   ├── db/
│   │   ├── schema.ts         # SQLite init (6 tables + WAL mode)
│   │   └── queries.ts        # Typed query helpers
│   ├── services/
│   │   └── api.ts            # axios instance + auth interceptor + API wrappers
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── PackingListScreen.tsx
│   │   ├── ScanScreen.tsx
│   │   ├── PackageDetailScreen.tsx
│   │   ├── PhotoScreen.tsx
│   │   └── SignatureScreen.tsx
│   └── components/
│       ├── SyncStatusBar.tsx
│       └── LockBanner.tsx
```

## Auth Flow

Uses `react-native-app-auth` for Azure AD PKCE. Tokens stored in `expo-secure-store`.
If the device goes offline and the token expires, the app continues in offline mode — it never locks out.

## Sync Model

- All writes go to local SQLite first (immediate)
- A 2.5-second debounced PUT syncs state to the server
- On `AppState → background`, the pending sync flushes immediately
- `expo-network` is checked on `AppState → active` to update online/offline indicator
