import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Animated, Dimensions, RefreshControl,
} from 'react-native';
import { SOSButton } from '../../components/SOSButton';
import { FakeCall } from '../../components/FakeCall';
import { CheckInBanner } from '../../components/CheckInBanner';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { hotspotApi } from '../../services/api';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [sosActive, setSosActive] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [nearbyHotspots, setNearbyHotspots] = useState<any[]>([]);
  const [riskLevel, setRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [refreshing, setRefreshing] = useState(false);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const headerAnim = new Animated.Value(0);

  const { getCurrentLocation } = useLocationTracker({ enabled: false });

  const loadNearbyData = useCallback(async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setLastLocation(loc);
        const res = await hotspotApi.getNearby(loc.lat, loc.lng);
        const data = res.data;
        setNearbyHotspots(data.hotspots || []);
        if (data.user_at_risk) {
          setRiskLevel('HIGH');
        } else if (data.hotspots?.length > 0) {
          setRiskLevel('MEDIUM');
        } else {
          setRiskLevel('LOW');
        }
      }
    } catch (e) {
      console.warn('Failed to load nearby data:', e);
    }
  }, [getCurrentLocation]);

  useEffect(() => {
    loadNearbyData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNearbyData();
    setRefreshing(false);
  };

  const riskColors = { LOW: '#4ade80', MEDIUM: '#fbbf24', HIGH: '#f87171' };
  const riskBg = { LOW: 'rgba(22,163,74,0.12)', MEDIUM: 'rgba(217,119,6,0.12)', HIGH: 'rgba(220,38,38,0.12)' };

  return (
    <View style={styles.container}>
      {/* Check-in Banner */}
      <CheckInBanner />

      {/* Fake Call Overlay */}
      {showFakeCall && (
        <FakeCall contactName="Mom" onDismiss={() => setShowFakeCall(false)} />
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>SafeStep</Text>
            <Text style={styles.headerSub}>AI Guardian System</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskBg[riskLevel], borderColor: riskColors[riskLevel] + '60' }]}>
            <View style={[styles.riskDot, { backgroundColor: riskColors[riskLevel] }]} />
            <Text style={[styles.riskText, { color: riskColors[riskLevel] }]}>{riskLevel} RISK</Text>
          </View>
        </View>

        {/* Active Case Banner */}
        {sosActive && activeCaseId && (
          <View style={styles.activeCaseBanner}>
            <Text style={styles.activeCaseIcon}>🚨</Text>
            <View style={styles.activeCaseInfo}>
              <Text style={styles.activeCaseTitle}>SOS ACTIVE</Text>
              <Text style={styles.activeCaseId}>{activeCaseId}</Text>
            </View>
            <TouchableOpacity style={styles.viewCaseBtn}
              onPress={() => Alert.alert('Live Track', `Case: ${activeCaseId}`)}>
              <Text style={styles.viewCaseBtnText}>Track</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SOS Button (Main Feature) */}
        <View style={styles.sosSection}>
          <SOSButton
            onSOSFired={(caseId) => { setSosActive(true); setActiveCaseId(caseId); }}
            onSOSCancelled={() => { setSosActive(false); setActiveCaseId(null); }}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowFakeCall(true)}>
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionLabel}>Fake Call</Text>
              <Text style={styles.actionSub}>F05</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}
              onPress={() => Alert.alert('Lone Walker', 'Navigate to Lone Walker tab')}>
              <Text style={styles.actionIcon}>🚶</Text>
              <Text style={styles.actionLabel}>Lone Walker</Text>
              <Text style={styles.actionSub}>F04</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}
              onPress={() => Alert.alert('Stealth Mode', 'Long-press app icon to activate stealth mode (F06)')}>
              <Text style={styles.actionIcon}>🕵️</Text>
              <Text style={styles.actionLabel}>Stealth</Text>
              <Text style={styles.actionSub}>F06</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}
              onPress={loadNearbyData}>
              <Text style={styles.actionIcon}>🗺️</Text>
              <Text style={styles.actionLabel}>Risk Map</Text>
              <Text style={styles.actionSub}>F07</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Info */}
        {lastLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>📍 Current Location</Text>
            <Text style={styles.locationCoords}>
              {lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Nearby Hotspots */}
        {nearbyHotspots.length > 0 && (
          <View style={styles.hotspotSection}>
            <Text style={styles.sectionTitle}>⚠️ Nearby Danger Zones</Text>
            {nearbyHotspots.slice(0, 3).map((h, i) => (
              <View key={h.id} style={[styles.hotspotCard, { borderColor: h.effective_risk >= 0.7 ? '#f87171' : '#fbbf24' }]}>
                <View style={styles.hotspotLeft}>
                  <Text style={styles.hotspotDistrict}>{h.district}</Text>
                  <Text style={styles.hotspotDist}>{h.distance_km.toFixed(1)} km away</Text>
                  {h.crime_types?.length > 0 && (
                    <Text style={styles.hotspotCrimes}>{h.crime_types.join(', ')}</Text>
                  )}
                </View>
                <View style={[styles.riskMeter, { backgroundColor: h.effective_risk >= 0.7 ? '#f87171' : '#fbbf24' }]}>
                  <Text style={styles.riskScore}>{(h.effective_risk * 100).toFixed(0)}</Text>
                  <Text style={styles.riskUnit}>risk</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d14' },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  headerGreeting: { fontSize: 28, fontWeight: '800', color: '#f1f5f9' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  riskBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  activeCaseBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(220,38,38,0.15)', marginHorizontal: 20, marginBottom: 16,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(220,38,38,0.4)',
  },
  activeCaseIcon: { fontSize: 24 },
  activeCaseInfo: { flex: 1 },
  activeCaseTitle: { fontSize: 14, fontWeight: '700', color: '#f87171' },
  activeCaseId: { fontSize: 11, color: '#fca5a5', fontFamily: 'monospace' },
  viewCaseBtn: { backgroundColor: 'rgba(220,38,38,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  viewCaseBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  sosSection: { alignItems: 'center', paddingVertical: 10 },
  quickActions: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    flex: 1, minWidth: (width - 60) / 2, backgroundColor: '#111827',
    borderRadius: 12, padding: 16, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#f1f5f9' },
  actionSub: { fontSize: 10, color: '#4f46e5', fontWeight: '600' },
  locationCard: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: '#111827',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(79,70,229,0.2)',
  },
  locationTitle: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  locationCoords: { fontSize: 14, color: '#818cf8', fontFamily: 'monospace' },
  hotspotSection: { paddingHorizontal: 20, marginTop: 20 },
  hotspotCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  hotspotLeft: { flex: 1 },
  hotspotDistrict: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  hotspotDist: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  hotspotCrimes: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  riskMeter: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 24 },
  riskScore: { fontSize: 18, fontWeight: '800', color: 'white' },
  riskUnit: { fontSize: 9, color: 'rgba(255,255,255,0.8)' },
});
