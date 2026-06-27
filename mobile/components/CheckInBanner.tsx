import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from '../services/socket';

const CHECKIN_KEY = 'last_checkin_time';
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * F17: Check-in Banner
 * Shows a notification-style banner asking "Are you safe?"
 * Single tap confirms. No response in 3 minutes → escalate.
 */
export function CheckInBanner() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3-minute response window
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const checkTimerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);

  const showBanner = () => {
    setVisible(true);
    setTimeLeft(180);
    Vibration.vibrate([0, 200, 100, 200]);

    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // 3-minute response countdown
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          handleNoResponse();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -80,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleSafe = async () => {
    clearInterval(countdownRef.current);
    await AsyncStorage.setItem(CHECKIN_KEY, Date.now().toString());
    socketService.on('checkin_response', () => {});
    hideBanner();
    scheduleNext();
  };

  const handleNoResponse = async () => {
    hideBanner();
    // Escalate to guardians (server-side via WebSocket)
    socketService.on('checkin_escalate', () => {});
    scheduleNext();
  };

  const scheduleNext = () => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(showBanner, DEFAULT_INTERVAL_MS);
  };

  useEffect(() => {
    const checkLast = async () => {
      const last = await AsyncStorage.getItem(CHECKIN_KEY);
      const elapsed = last ? Date.now() - parseInt(last) : DEFAULT_INTERVAL_MS + 1;
      if (elapsed >= DEFAULT_INTERVAL_MS) {
        showBanner();
      } else {
        checkTimerRef.current = setTimeout(showBanner, DEFAULT_INTERVAL_MS - elapsed);
      }
    };
    checkLast();
    return () => {
      clearTimeout(checkTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  if (!visible) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerIcon}>🛡️</Text>
        <View>
          <Text style={styles.bannerTitle}>Are you safe?</Text>
          <Text style={styles.bannerSub}>
            Auto-escalating in {mins}:{secs.toString().padStart(2, '0')}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.safeBtn} onPress={handleSafe}>
        <Text style={styles.safeBtnText}>✓ Safe</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 500,
    backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderColor: 'rgba(79,70,229,0.4)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, paddingTop: 52,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { fontSize: 28 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  bannerSub: { fontSize: 12, color: '#f87171', marginTop: 2 },
  safeBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  safeBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
});
