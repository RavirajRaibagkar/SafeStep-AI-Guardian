/**
 * Background task definitions for SafeStep.
 *
 * Uses expo-task-manager + expo-location background tracking +
 * expo-background-fetch for periodic check-ins.
 *
 * Registered here at module level so they are available
 * before the app renders (required by Expo).
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from './socket';

// ── Task names ────────────────────────────────────────────────
export const BACKGROUND_LOCATION_TASK = 'safestep-bg-location';
export const BACKGROUND_FETCH_TASK    = 'safestep-bg-fetch';

// ── Background Location Task ──────────────────────────────────
// Fired by expo-location every ~3 s during active SOS.
// Works even when app is killed on Android (foreground service).
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) { console.warn('[BG Location] Error:', error.message); return; }
  if (!data?.locations?.length) return;

  const loc = data.locations[data.locations.length - 1];
  const { latitude: lat, longitude: lng } = loc.coords;

  try {
    const caseId = await AsyncStorage.getItem('active_case_id');
    if (!caseId) return;

    // Try socket first (fast path)
    socketService.emitLocation(caseId, lat, lng, undefined);

    // REST fallback — always succeeds even if socket is down
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api';
    const token   = await AsyncStorage.getItem('auth_token');
    await fetch(`${apiBase}/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ case_id: caseId, lat, lng }),
    }).catch(() => {}); // swallow — we're in background, best-effort
  } catch (e) {
    console.warn('[BG Location] Update failed:', e);
  }
});

// ── Background Fetch Task ─────────────────────────────────────
// Runs every ~15 minutes (OS decides exact interval).
// Used for: lone-walker check-in heartbeat, geofence check.
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const apiBase  = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api';
    const token    = await AsyncStorage.getItem('auth_token');
    const caseId   = await AsyncStorage.getItem('active_case_id');
    const loneEnd  = await AsyncStorage.getItem('lone_walker_end');

    if (!token) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Lone-walker heartbeat: if journey active, send current location
    if (loneEnd && Date.now() < parseInt(loneEnd, 10)) {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);

      if (loc) {
        await fetch(`${apiBase}/location/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            case_id: caseId || 'lone_walker',
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }),
        }).catch(() => {});
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.warn('[BG Fetch] Error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Start background GPS streaming for an active SOS case.
 * Requests background location permission first.
 * On Android: starts a foreground service (persistent notification).
 */
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // Foreground permission (should already be granted at SOS trigger)
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;

    // Background permission (Android 10+ / iOS 13+)
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      console.warn('[BG] Background location denied — using foreground only');
      // Continue anyway; foreground interval in useSOSPipeline still works
      return false;
    }

    const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (already) return true;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,          // ~3 s between updates
      distanceInterval: 5,         // OR every 5 m — whichever comes first
      deferredUpdatesInterval: 3000,
      deferredUpdatesDistance: 5,
      foregroundService: {         // Android: keeps process alive
        notificationTitle: '🛡️ SafeStep — SOS Active',
        notificationBody:  'Your location is being shared with emergency contacts',
        notificationColor: '#dc2626',
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true, // iOS: blue pill in status bar
    });

    console.log('[BG] Background location tracking started');
    return true;
  } catch (e) {
    console.error('[BG] Failed to start background tracking:', e);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (running) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BG] Background location tracking stopped');
    }
  } catch (e) {
    console.warn('[BG] Stop tracking error:', e);
  }
}

/**
 * Register the periodic background fetch (runs ~every 15 min).
 * Safe to call multiple times.
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn('[BG Fetch] Not available on this device');
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (OS may delay)
      stopOnTerminate: false,   // Android: keep running after app closed
      startOnBoot: true,        // Android: restart after device reboot
    });
    console.log('[BG Fetch] Registered');
  } catch (e) {
    // Already registered is a non-fatal error
    if (!(e as Error).message?.includes('already')) {
      console.warn('[BG Fetch] Registration error:', e);
    }
  }
}
