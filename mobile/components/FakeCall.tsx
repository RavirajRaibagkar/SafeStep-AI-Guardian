import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';

interface FakeCallProps {
  contactName?: string;
  onDismiss: () => void;
}

/**
 * F05: Fake Call Trigger
 * Displays realistic incoming call UI with 8-second ringtone simulation.
 */
export function FakeCall({ contactName = 'Mom', onDismiss }: FakeCallProps) {
  const [callState, setCallState] = useState<'ringing' | 'answered' | null>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Pulse avatar animation (simulates ringing)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Auto-dismiss after 8 seconds if not answered
    const timer = setTimeout(() => {
      setCallState(null);
      setTimeout(onDismiss, 500);
    }, 8000);

    // Elapsed timer
    const elapsed = setInterval(() => setElapsed(s => s + 1), 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(elapsed);
      pulse.stop();
    };
  }, []);

  const handleAccept = () => {
    setCallState('answered');
    // Simulate 30-second call
    setTimeout(() => {
      setCallState(null);
      setTimeout(onDismiss, 500);
    }, 30000);
  };

  const handleDecline = () => {
    setCallState(null);
    setTimeout(onDismiss, 300);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.background}>
        {/* Header */}
        <Text style={styles.callLabel}>
          {callState === 'answered' ? 'On Call' : 'Incoming Call'}
        </Text>

        {/* Avatar */}
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{contactName[0]?.toUpperCase()}</Text>
          </View>
          {callState === 'ringing' && <View style={styles.avatarRipple} />}
        </Animated.View>

        {/* Contact Name */}
        <Text style={styles.contactName}>{contactName}</Text>
        <Text style={styles.contactSub}>
          {callState === 'answered' ? formatTime(elapsed) : 'Mobile · Calling...'}
        </Text>

        {/* Answer/Decline Buttons */}
        {callState === 'ringing' && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleDecline}>
              <Text style={styles.callBtnIcon}>📵</Text>
              <Text style={styles.callBtnLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAccept}>
              <Text style={styles.callBtnIcon}>📞</Text>
              <Text style={styles.callBtnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active call controls */}
        {callState === 'answered' && (
          <View style={styles.activeCallRow}>
            <TouchableOpacity style={styles.activeBtn}>
              <Text style={styles.activeBtnIcon}>🔇</Text>
              <Text style={styles.activeBtnLabel}>Mute</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.activeBtn}>
              <Text style={styles.activeBtnIcon}>🔊</Text>
              <Text style={styles.activeBtnLabel}>Speaker</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.callBtn, styles.endBtn]} onPress={handleDecline}>
              <Text style={styles.callBtnIcon}>📵</Text>
              <Text style={styles.callBtnLabel}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', inset: 0, zIndex: 9999,
  },
  background: {
    flex: 1, backgroundColor: '#1a1a2e',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  callLabel: { fontSize: 14, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' },
  avatarContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 20,
  },
  avatarText: { fontSize: 48, fontWeight: '700', color: 'white' },
  avatarRipple: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: 'rgba(79,70,229,0.3)',
  },
  contactName: { fontSize: 32, fontWeight: '700', color: 'white' },
  contactSub: { fontSize: 14, color: '#9ca3af' },
  buttonRow: { flexDirection: 'row', gap: 60, marginTop: 40 },
  callBtn: { alignItems: 'center', gap: 8 },
  declineBtn: {},
  acceptBtn: {},
  endBtn: {},
  callBtnIcon: { fontSize: 40, width: 72, height: 72, textAlign: 'center', lineHeight: 72,
    borderRadius: 36, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  callBtnLabel: { fontSize: 12, color: '#9ca3af' },
  activeCallRow: { flexDirection: 'row', gap: 24, alignItems: 'center', marginTop: 40 },
  activeBtn: { alignItems: 'center', gap: 6 },
  activeBtnIcon: { fontSize: 28 },
  activeBtnLabel: { fontSize: 11, color: '#9ca3af' },
});
