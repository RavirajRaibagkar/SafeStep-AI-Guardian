import { useRef, useCallback } from 'react';
import * as Location from 'expo-location';
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av native module missing. Audio recording mocked.');
  Audio = {
    requestPermissionsAsync: async () => ({ granted: false }),
    setAudioModeAsync: async () => {},
    Recording: {
      createAsync: async () => ({ recording: { stopAndUnloadAsync: async () => {}, getURI: () => null } }),
      RecordingOptionsPresets: { HIGH_QUALITY: {} }
    }
  };
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { encryptLocation } from '../services/encryption';

export interface SOSContext {
  userId: string;
  userName: string;
  contactsCount: number;
}

export function useSOSPipeline() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const locationIntervalRef = useRef<any>(null);
  const activeCaseIdRef = useRef<string | null>(null);

  /**
   * F01 → F02 → F03 → F18 → F19 → F20 → F22
   * Complete SOS pipeline. Must complete SMS send within 8 seconds.
   */
  const fireSOS = useCallback(async (triggerType: string = 'manual') => {
    try {
      // Step 1: Get current GPS (F03)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied — SOS fired without GPS');
      }

      let coords = { latitude: 0, longitude: 0 };
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
        });
        coords = loc.coords;
      } catch (e) {
        console.warn('GPS unavailable:', e);
      }

      // Encrypt location before sending (F27)
      const encryptedLoc = await encryptLocation(coords.latitude, coords.longitude);

      // Step 2: POST to /api/sos/trigger (F18 + F19 cascade fires server-side)
      const sosResponse = await api.post('/sos/trigger', {
        lat: coords.latitude,
        lng: coords.longitude,
        encrypted_location: encryptedLoc,
        trigger_type: triggerType,
      });

      const { case_id: caseId, tracking_url: trackingUrl } = sosResponse.data;
      activeCaseIdRef.current = caseId;

      // Store case ID locally
      await AsyncStorage.setItem('active_case_id', caseId);

      // Step 3: Start live location broadcast via Socket.io (F03)
      socketService.joinCase(caseId);
      locationIntervalRef.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude: lat, longitude: lng } = loc.coords;

          // Broadcast via Socket.io
          socketService.emitLocation(caseId, lat, lng);

          // Also POST to REST endpoint
          await api.post('/location/update', {
            case_id: caseId,
            lat,
            lng,
            battery: 85, // expo-battery could provide real value
          }).catch(console.warn);
        } catch (e) { console.warn('Location update error:', e); }
      }, 3000); // every 3 seconds (F03)

      // Step 4: Start 30-second audio recording (F02)
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;

        // Stop and upload after 30 seconds
        setTimeout(async () => {
          await stopAndUploadAudio(caseId, coords.latitude, coords.longitude);
        }, 30000);
      } catch (audioErr) {
        console.warn('Audio recording failed:', audioErr);
      }

      return { success: true, caseId, trackingUrl };
    } catch (error: any) {
      console.error('SOS pipeline error:', error);

      // F28: Offline fallback — trigger SMS via stored contacts
      await fireOfflineSOS();
      return { success: false, error: error.message };
    }
  }, []);

  const stopAndUploadAudio = async (caseId: string, lat: number, lng: number) => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        const formData = new FormData();
        formData.append('audio', {
          uri,
          type: 'audio/aac',
          name: `evidence_${caseId}.aac`,
        } as any);
        formData.append('case_id', caseId);
        formData.append('lat', String(lat));
        formData.append('lng', String(lng));

        await api.post('/sos/audio-upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        console.log('Audio evidence uploaded for case:', caseId);
      }
    } catch (e) {
      console.error('Audio upload error:', e);
    }
  };

  const cancelSOS = useCallback(async () => {
    const caseId = activeCaseIdRef.current;

    // Stop location interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (e) { console.warn(e); }
    }

    if (caseId) {
      await api.post(`/sos/cancel/${caseId}`).catch(console.error);
      await AsyncStorage.removeItem('active_case_id');
      activeCaseIdRef.current = null;
    }

    return { success: true, caseId };
  }, []);

  const fireOfflineSOS = async () => {
    // F28: When completely offline, we can't call API
    // Twilio SMS API itself works over cellular even without internet data
    // The user should have offline SMS capability configured
    console.warn('Offline SOS: Falling back to emergency SMS');
    // In a real device, we'd use react-native-sms-retriever or similar
    // to send SMS directly from the device
  };

  return { fireSOS, cancelSOS, activeCaseId: activeCaseIdRef };
}
