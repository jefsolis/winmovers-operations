import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

import { initDb } from './src/db/schema';
import AuthGuard from './src/auth/AuthGuard';
import { getAccessToken } from './src/auth/useAuth';
import { RootStackParamList } from './src/navigation/types';

import HomeScreen from './src/screens/HomeScreen';
import NewPackingListScreen from './src/screens/NewPackingListScreen';
import PackingListScreen from './src/screens/PackingListScreen';
import ScanScreen from './src/screens/ScanScreen';
import PackageDetailScreen from './src/screens/PackageDetailScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import SignatureScreen from './src/screens/SignatureScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  // T020: On app foreground, attempt silent token refresh and connectivity probe
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        await Network.getNetworkStateAsync(); // connectivity probe
        await getAccessToken().catch(() => {}); // silent refresh (no-op if offline)
      }
    });
    return () => subscription.remove();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AuthGuard>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ headerStyle: { backgroundColor: '#1a73e8' }, headerTintColor: '#fff' }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'WinMovers Packing' }} />
          <Stack.Screen name="NewPackingList" component={NewPackingListScreen} options={{ title: 'Nueva Lista' }} />
          <Stack.Screen name="PackingList" component={PackingListScreen} options={{ title: 'Packing List' }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Escanear Caja' }} />
          <Stack.Screen name="PackageDetail" component={PackageDetailScreen} options={{ title: 'Contenido de Caja' }} />
          <Stack.Screen name="Photo" component={PhotoScreen} options={{ title: 'Fotos' }} />
          <Stack.Screen name="Signature" component={SignatureScreen} options={{ title: 'Firma del Cliente' }} />
        </Stack.Navigator>
      </AuthGuard>
    </NavigationContainer>
  );
}
