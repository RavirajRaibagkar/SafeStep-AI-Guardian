import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Alert, Vibration, StatusBar, Dimensions, Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSOSPipeline } from '../hooks/useSOSPipeline';
import { useShakeDetector } from '../hooks/useShakeDetector';
import { useDistressDetector } from '../hooks/useDistressDetector';

const { width } = Dimensions.get('window');
const COUNTDOWN_SECONDS = 5;

interface SOSButtonProps {
  onSOSFired?: (caseId: string) => void;
  onSOSCancelled?: () => void;
}

export function SOSButton({ onSOSFired, onSOSCancelled }: SOSButtonProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [detectionLabel, setDetectionLabel] = useState<string | null>(null);

  const countdownRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const { fireSOS, cancelSOS } = useSOSPipeline();

  // F11-F12: Distress voice detection (silent auto-alert)
  const { isListening, lastResult } = useDistressDetector({
    enabled: !sosActive,
    onDistressDetected: async (classification, confidence) => {
      setDetectionLabel(`🎤 ${classification} detected (${(confidence * 100).toFixed(0)}%)`);
      // Silent auto-alert (F12)
      await triggerSOS('voice_distress', true);
    },
  });

  // F01: Shake detector
  useShakeDetector({
    enabled: !sosActive,
    onShake: () => {
      if (countdown === null && !sosActive) {
        startCountdown('shake');
      }
    },
  });

  // Animations
  useEffect(() => {
    if (sosActive) {
      // Pulsing effect during active SOS
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();

      // Ripple glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(rippleAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      rippleAnim.stopAnimation();
      rippleAnim.setValue(0);
    }
  }, [sosActive]);

  const startCountdown = useCallback((triggerType: string) => {
    Vibration.vibrate([0, 100, 100, 100]);
    setCountdown(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        triggerSOS(triggerType);
      }
    }, 1000);
  }, []);

  const cancelCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(null);
    Vibration.cancel();
    onSOSCancelled?.();
  }, [onSOSCancelled]);

  const triggerSOS = useCallback(async (triggerType: string, silent = false) => {
    setSosActive(true);

    if (!silent) {
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    }

    const result = await fireSOS(triggerType);
    if (result.success && result.caseId) {
      setActiveCaseId(result.caseId);
      onSOSFired?.(result.caseId);
    }
  }, [fireSOS, onSOSFired]);

  const handleCancelSOS = async () => {
    // F30: Require biometric to cancel SOS
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity to cancel SOS',
        cancelLabel: 'Keep SOS Active',
        disableDeviceFallback: false,
      });
      if (!result.success) {
        Alert.alert('SOS Still Active', 'Authentication required to cancel SOS alert.');
        return;
      }
    }

    await cancelSOS();
    setSosActive(false);
    setActiveCaseId(null);
    setDetectionLabel(null);
    onSOSCancelled?.();
  };

  const handleManualPress = () => {
    if (sosActive) return;
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    startCountdown('manual');
  };

  return (
    <View style={styles.container}>
      {/* AI Detection Label */}
      {detectionLabel && (
        <View style={styles.detectionBadge}>
          <Text style={styles.detectionText}>{detectionLabel}</Text>
        </View>
      )}

      {/* Active Case ID */}
      {sosActive && activeCaseId && (
        <View style={styles.caseIdBadge}>
          <Text style={styles.caseIdLabel}>CASE</Text>
          <Text style={styles.caseIdText}>{activeCaseId}</Text>
        </View>
      )}

      {/* Ripple rings */}
      {sosActive && (
        <>
          <Animated.View style={[styles.ripple, styles.ripple1, { opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }) }]} />
          <Animated.View style={[styles.ripple, styles.ripple2, { opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }) }]} />
        </>
      )}

      {/* Main SOS Button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.sosButton, sosActive && styles.sosButtonActive, countdown !== null && styles.sosButtonCountdown]}
          onPress={handleManualPress}
          onLongPress={() => { if (!sosActive && countdown === null) startCountdown('manual_long'); }}
          activeOpacity={0.85}
          accessibilityLabel="SOS Emergency Button"
          accessibilityRole="button"
        >
          {countdown !== null ? (
            <View style={styles.countdownContent}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownLabel}>Tap to CANCEL</Text>
            </View>
          ) : sosActive ? (
            <View style={styles.activeContent}>
              <Text style={styles.sosLabel}>SOS</Text>
              <Text style={styles.activeLabel}>ACTIVE</Text>
            </View>
          ) : (
            <View style={styles.idleContent}>
              <Text style={styles.sosLabel}>SOS</Text>
              <Text style={styles.idleHint}>Hold or Shake</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Status Row */}
      <View style={styles.statusRow}>
        {isListening && !sosActive && (
          <View style={styles.listeningBadge}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>AI Listening</Text>
          </View>
        )}
      </View>

      {/* Cancel SOS Button */}
      {sosActive && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSOS}>
          <Text style={styles.cancelBtnText}>Cancel SOS (Requires Biometric)</Text>
        </TouchableOpacity>
      )}

      {/* Countdown cancel hint */}
      {countdown !== null && (
        <TouchableOpacity style={styles.cancelCountdownBtn} onPress={cancelCountdown}>
          <Text style={styles.cancelCountdownText}>✕ CANCEL ({countdown}s)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const BUTTON_SIZE = width * 0.52;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  ripple: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#dc2626',
  },
  ripple1: {
    width: BUTTON_SIZE + 60,
    height: BUTTON_SIZE + 60,
    marginTop: -(BUTTON_SIZE + 60) / 2,
    marginLeft: -(BUTTON_SIZE + 60) / 2,
  },
  ripple2: {
    width: BUTTON_SIZE + 120,
    height: BUTTON_SIZE + 120,
    marginTop: -(BUTTON_SIZE + 120) / 2,
    marginLeft: -(BUTTON_SIZE + 120) / 2,
  },
  sosButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sosButtonActive: {
    backgroundColor: '#991b1b',
    borderColor: '#f87171',
    shadowOpacity: 0.9,
  },
  sosButtonCountdown: {
    backgroundColor: '#b91c1c',
    borderColor: '#fca5a5',
  },
  idleContent: { alignItems: 'center' },
  activeContent: { alignItems: 'center' },
  countdownContent: { alignItems: 'center' },
  sosLabel: { fontSize: 42, fontWeight: '900', color: 'white', letterSpacing: 4 },
  idleHint: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 1 },
  activeLabel: { fontSize: 14, color: '#fca5a5', fontWeight: '700', letterSpacing: 3, marginTop: 4 },
  countdownNumber: { fontSize: 72, fontWeight: '900', color: 'white', lineHeight: 72 },
  countdownLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statusRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  listeningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(22,163,74,0.15)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)',
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  listeningText: { fontSize: 12, color: '#4ade80', fontWeight: '600' },
  caseIdBadge: {
    backgroundColor: 'rgba(220,38,38,0.15)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.4)',
    marginBottom: 20, alignItems: 'center',
  },
  caseIdLabel: { fontSize: 10, color: '#f87171', fontWeight: '700', letterSpacing: 2 },
  caseIdText: { fontSize: 14, color: '#fca5a5', fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  detectionBadge: {
    backgroundColor: 'rgba(220,38,38,0.2)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, marginBottom: 12,
  },
  detectionText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    marginTop: 24, paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: '#374151', borderRadius: 8,
  },
  cancelBtnText: { color: '#9ca3af', fontSize: 13 },
  cancelCountdownBtn: {
    marginTop: 16, paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: '#374151', borderRadius: 8,
  },
  cancelCountdownText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
