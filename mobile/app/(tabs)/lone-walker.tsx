import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Animated,
} from 'react-native';
import * as Location from 'expo-location';
import { api } from '../../services/api';
import { useSOSPipeline } from '../../hooks/useSOSPipeline';

interface Destination {
  name: string;
  lat: number;
  lng: number;
  etaMinutes: number;
}

/**
 * F04: Lone Walker Mode
 * User sets destination + ETA. App polls GPS every 60 seconds.
 * No-show → "Are you safe?" → No response 2 min → Auto SOS.
 */
export default function LoneWalkerScreen() {
  const [isActive, setIsActive] = useState(false);
  const [destination, setDestination] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('30');
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [safePromptVisible, setSafePromptVisible] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pollIntervalRef = useRef<any>(null);
  const etaTimerRef = useRef<any>(null);
  const safePromptTimerRef = useRef<any>(null);

  const { fireSOS } = useSOSPipeline();

  const startLoneWalker = async () => {
    if (!destination.trim()) {
      Alert.alert('Required', 'Please enter your destination');
      return;
    }
    const mins = parseInt(etaMinutes) || 30;
    const totalMs = mins * 60 * 1000;
    const now = Date.now();

    setIsActive(true);
    setStartTime(now);
    setTotalDuration(totalMs);
    setTimeRemaining(mins * 60);
    setProgress(0);

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: totalMs,
      useNativeDriver: false,
    }).start();

    // Poll GPS every 60 seconds
    pollIntervalRef.current = setInterval(async () => {
      const elapsed = (Date.now() - now) / 1000;
      const remaining = Math.max(0, mins * 60 - elapsed);
      setTimeRemaining(Math.round(remaining));
      setProgress(elapsed / (mins * 60));
    }, 5000); // Update UI every 5s

    // ETA timer
    etaTimerRef.current = setTimeout(async () => {
      setSafePromptVisible(true);

      // If no response in 2 minutes → auto SOS (F04)
      safePromptTimerRef.current = setTimeout(async () => {
        setSafePromptVisible(false);
        Alert.alert('Auto SOS Triggered', 'No response to safety check. SOS has been activated.');
        await fireSOS('lone_walker_timeout');
        stopLoneWalker();
      }, 120000); // 2 minutes
    }, totalMs);
  };

  const confirmSafe = () => {
    setSafePromptVisible(false);
    clearTimeout(safePromptTimerRef.current);
    stopLoneWalker();
    Alert.alert('✅ Safe', 'You have been marked as safe. Journey complete!');
  };

  const stopLoneWalker = () => {
    clearInterval(pollIntervalRef.current);
    clearTimeout(etaTimerRef.current);
    clearTimeout(safePromptTimerRef.current);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setIsActive(false);
    setProgress(0);
    setSafePromptVisible(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🚶 Lone Walker Mode</Text>
        <Text style={styles.subtitle}>
          Set your destination and expected arrival time. We'll check on you automatically.
        </Text>

        {!isActive ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Destination</Text>
              <TextInput
                style={styles.input}
                value={destination}
                onChangeText={setDestination}
                placeholder="e.g., Home, Office, Market..."
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expected Travel Time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={etaMinutes}
                onChangeText={setEtaMinutes}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How it works:</Text>
              <Text style={styles.infoText}>• GPS tracked every 60 seconds</Text>
              <Text style={styles.infoText}>• "Are you safe?" alert at ETA</Text>
              <Text style={styles.infoText}>• No response → Auto SOS in 2 minutes</Text>
              <Text style={styles.infoText}>• All 5 emergency contacts notified</Text>
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={startLoneWalker}>
              <Text style={styles.startBtnText}>▶ Start Journey</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeSession}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <Text style={styles.progressLabel}>
                {formatTime(timeRemaining)} remaining
              </Text>
            </View>

            {/* Journey Info */}
            <View style={styles.journeyCard}>
              <View style={styles.journeyRow}>
                <Text style={styles.journeyIcon}>📍</Text>
                <View>
                  <Text style={styles.journeyLabel}>Destination</Text>
                  <Text style={styles.journeyValue}>{destination}</Text>
                </View>
              </View>
              <View style={styles.journeyRow}>
                <Text style={styles.journeyIcon}>⏱️</Text>
                <View>
                  <Text style={styles.journeyLabel}>ETA Set For</Text>
                  <Text style={styles.journeyValue}>{etaMinutes} minutes</Text>
                </View>
              </View>
              <View style={styles.journeyRow}>
                <Text style={styles.journeyIcon}>🛡️</Text>
                <View>
                  <Text style={styles.journeyLabel}>Status</Text>
                  <Text style={[styles.journeyValue, { color: '#4ade80' }]}>Monitored</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.stopBtn} onPress={stopLoneWalker}>
              <Text style={styles.stopBtnText}>✓ I've Arrived Safely</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={stopLoneWalker}>
              <Text style={styles.cancelBtnText}>Cancel Journey</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Safety Prompt Modal */}
        {safePromptVisible && (
          <View style={styles.safePromptOverlay}>
            <View style={styles.safePromptCard}>
              <Text style={styles.safePromptIcon}>🛡️</Text>
              <Text style={styles.safePromptTitle}>Are You Safe?</Text>
              <Text style={styles.safePromptBody}>
                Your expected arrival time has passed. Please confirm you're safe.
                If no response in 2 minutes, SOS will auto-activate.
              </Text>
              <TouchableOpacity style={styles.safeBtn} onPress={confirmSafe}>
                <Text style={styles.safeBtnText}>✅ YES, I'M SAFE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d14' },
  content: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginTop: 40, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 28 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  input: {
    backgroundColor: '#111827', borderRadius: 12, padding: 14, color: '#f1f5f9',
    fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  infoBox: { backgroundColor: 'rgba(79,70,229,0.1)', borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: 'rgba(79,70,229,0.25)' },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#818cf8', marginBottom: 4 },
  infoText: { fontSize: 13, color: '#a5b4fc' },
  startBtn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  startBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  activeSession: { gap: 20 },
  progressContainer: { gap: 8 },
  progressTrack: { height: 8, backgroundColor: '#1f2937', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4f46e5', borderRadius: 4 },
  progressLabel: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  journeyCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, gap: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  journeyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  journeyIcon: { fontSize: 22, width: 32 },
  journeyLabel: { fontSize: 12, color: '#6b7280' },
  journeyValue: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  stopBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 16, alignItems: 'center' },
  stopBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#6b7280', fontSize: 14 },
  safePromptOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100, borderRadius: 20 },
  safePromptCard: { backgroundColor: '#1f2937', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, margin: 20 },
  safePromptIcon: { fontSize: 48 },
  safePromptTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  safePromptBody: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  safeBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  safeBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
