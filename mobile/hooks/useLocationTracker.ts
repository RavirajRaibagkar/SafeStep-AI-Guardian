import { useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { socketService } from '../services/socket';
import { api } from '../services/api';

interface UseLocationTrackerOptions {
  caseId?: string | null;
  enabled?: boolean;
  intervalMs?: number; // default 3000 for SOS, 60000 for lone-walker
}

export function useLocationTracker({
  caseId,
  enabled = false,
  intervalMs = 3000,
}: UseLocationTrackerOptions) {
  const intervalRef = useRef<any>(null);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    stopTracking();

    const sendUpdate = async () => {
      try {
        // F03: battery-efficient "significant change" style polling
        const loc = await Location.getCurrentPositionAsync({
          accuracy: intervalMs >= 60000
            ? Location.Accuracy.Low       // Lone walker: low accuracy = less battery
            : Location.Accuracy.Balanced, // SOS: balanced accuracy
        });

        const { latitude: lat, longitude: lng } = loc.coords;
        lastLocation.current = { lat, lng };

        if (caseId) {
          socketService.emitLocation(caseId, lat, lng);
          await api.post('/location/update', { case_id: caseId, lat, lng }).catch(() => {});
        }
      } catch (e) { console.warn('Location tracking error:', e); }
    };

    await sendUpdate(); // immediate first update
    intervalRef.current = setInterval(sendUpdate, intervalMs);
  }, [caseId, intervalMs, stopTracking]);

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }
    return stopTracking;
  }, [enabled, startTracking, stopTracking]);

  const getCurrentLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  }, []);

  return { startTracking, stopTracking, getCurrentLocation, lastLocation };
}
