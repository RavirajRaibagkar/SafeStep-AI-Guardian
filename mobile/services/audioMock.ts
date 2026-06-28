/**
 * Shared expo-av mock for environments where the native module isn't linked
 * (Expo Go on physical device, web, etc.).
 *
 * Both useSOSPipeline and useDistressDetector import from here instead of
 * doing their own try/require, so the warning only prints once per session.
 */

let _warned = false;

let Audio: any;

try {
  Audio = require('expo-av').Audio;
} catch {
  if (!_warned) {
    _warned = true;
    console.warn('[SafeStep] expo-av native module unavailable — audio features mocked.');
  }
  Audio = {
    requestPermissionsAsync: async () => ({ granted: false }),
    setAudioModeAsync: async () => {},
    Recording: {
      createAsync: async () => ({
        recording: {
          stopAndUnloadAsync: async () => {},
          getURI: () => null,
          getStatusAsync: async () => ({ isRecording: false, metering: -160 }),
        },
      }),
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
    },
  };
}

export { Audio };
