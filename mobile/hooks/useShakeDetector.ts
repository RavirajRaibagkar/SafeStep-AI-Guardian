import { useEffect, useRef, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import { Platform, Vibration } from 'react-native';

const SHAKE_THRESHOLD = 15; // m/s² — matches spec
const REQUIRED_SHAKES = 3;
const SHAKE_WINDOW_MS = 2000;

interface UseShakeDetectorOptions {
  onShake: () => void;
  enabled?: boolean;
}

export function useShakeDetector({ onShake, enabled = true }: UseShakeDetectorOptions) {
  const shakeTimestamps = useRef<number[]>([]);
  const lastMagnitude = useRef(0);
  const subscriptionRef = useRef<any>(null);

  const handleAccelerometer = useCallback(({ x, y, z }: { x: number; y: number; z: number }) => {
    // Magnitude of acceleration vector
    const magnitude = Math.sqrt(x * x + y * y + z * z) * 9.81; // convert to m/s²

    // Detect zero crossing (shake direction change)
    if (magnitude > SHAKE_THRESHOLD && lastMagnitude.current <= SHAKE_THRESHOLD) {
      const now = Date.now();
      // Purge timestamps outside window
      shakeTimestamps.current = shakeTimestamps.current.filter(
        t => now - t < SHAKE_WINDOW_MS
      );
      shakeTimestamps.current.push(now);

      if (shakeTimestamps.current.length >= REQUIRED_SHAKES) {
        shakeTimestamps.current = [];
        Vibration.vibrate([0, 200, 100, 200]);
        onShake();
      }
    }
    lastMagnitude.current = magnitude;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      return;
    }

    Accelerometer.setUpdateInterval(100); // 10Hz polling
    subscriptionRef.current = Accelerometer.addListener(handleAccelerometer);

    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled, handleAccelerometer]);

  return {
    reset: () => { shakeTimestamps.current = []; },
  };
}
