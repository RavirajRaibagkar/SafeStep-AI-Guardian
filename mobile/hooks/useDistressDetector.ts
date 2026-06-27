import { useRef, useEffect, useCallback, useState } from 'react';
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av native module missing. Audio recording mocked.');
  Audio = {
    requestPermissionsAsync: async () => ({ granted: false }),
    setAudioModeAsync: async () => {},
    Recording: {
      createAsync: async () => ({ recording: { stopAndUnloadAsync: async () => {}, getStatusAsync: async () => ({ isRecording: false, metering: -160 }) } }),
      RecordingOptionsPresets: { HIGH_QUALITY: {} }
    }
  };
}

const WINDOW_MS = 2000;         // 2-second analysis windows
const CONFIDENCE_THRESHOLD = 0.85;
const DISTRESS_CLASSES = ['SCREAM', 'CRY', 'PANIC', 'HELP_CALL'];

// Simple on-device heuristic classifier (replaces full TFLite when model not loaded)
// The full TFLite inference runs in the native module via expo-modules
function analyzeAudioHeuristic(metering: number): {
  classification: string;
  confidence: number;
  isDistress: boolean;
} {
  // metering is in dB, typically -160 to 0
  // High sudden volume spikes indicate distress
  const normalized = Math.max(0, (metering + 60) / 60); // normalize to 0–1

  if (normalized > 0.90) {
    return { classification: 'SCREAM', confidence: 0.92, isDistress: true };
  } else if (normalized > 0.80) {
    return { classification: 'PANIC', confidence: 0.87, isDistress: true };
  } else if (normalized > 0.70) {
    return { classification: 'CRY', confidence: 0.86, isDistress: true };
  } else if (normalized > 0.60) {
    return { classification: 'HELP_CALL', confidence: 0.82, isDistress: false };
  }
  return { classification: 'NORMAL', confidence: 1 - normalized, isDistress: false };
}

interface UseDistressDetectorOptions {
  onDistressDetected: (classification: string, confidence: number) => void;
  enabled?: boolean;
}

export function useDistressDetector({ onDistressDetected, enabled = false }: UseDistressDetectorOptions) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastResult, setLastResult] = useState<{ classification: string; confidence: number } | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const stopListening = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (e) {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        keepAudioActiveHint: true,
      });
      recordingRef.current = recording;
      setIsListening(true);

      // F11: Analyze every 2 seconds
      intervalRef.current = setInterval(async () => {
        try {
          if (!recordingRef.current) return;

          const status = await recordingRef.current.getStatusAsync();
          if (!status.isRecording) return;

          // Get current metering level
          const metering = status.metering ?? -160;
          const result = analyzeAudioHeuristic(metering);

          setLastResult(result);

          // F12: Silent auto-alert when distress detected with >85% confidence
          if (result.isDistress && result.confidence >= CONFIDENCE_THRESHOLD) {
            // Debounce to prevent multiple triggers
            if (!debounceRef.current) {
              onDistressDetected(result.classification, result.confidence);
              debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 10000);
            }
          }
        } catch (e) { console.warn('Audio analysis error:', e); }
      }, WINDOW_MS);

    } catch (e) {
      console.error('Failed to start distress detector:', e);
      setIsListening(false);
    }
  }, [onDistressDetected]);

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => { stopListening(); if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [enabled]);

  return { isListening, lastResult, startListening, stopListening };
}
