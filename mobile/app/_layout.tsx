import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// IMPORTANT: import backgroundTasks at root level so TaskManager.defineTask()
// runs before any navigation / before the OS can resume a background task.
import { registerBackgroundFetch } from '../services/backgroundTasks';
import { authApi } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  useEffect(() => {
    // Register the periodic heartbeat on first app launch
    registerBackgroundFetch().catch(console.warn);

    // Auto-login for hackathon demo (since there's no UI for it yet)
    const autoLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
          console.log('[Auth] Attempting auto-login for demo user...');
          const res = await authApi.login('+918888888888', 'user123');
          if (res.data.access_token) {
            await AsyncStorage.setItem('auth_token', res.data.access_token);
            console.log('[Auth] Auto-login successful!');
          }
        }
      } catch (e: any) {
        console.warn('[Auth] Auto-login failed:', e.message);
      }
    };
    autoLogin();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
