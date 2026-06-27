import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { casesApi } from '../../services/api';

interface Case {
  case_id: string;
  status: string;
  trigger_type: string;
  start_time: string;
  end_time?: string;
  ai_classification?: string;
  confidence_score?: number;
  fir_pdf_url?: string;
  gps_trail: any[];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#f87171',
  resolved: '#4ade80',
  false_alarm: '#fbbf24',
  closed: '#6b7280',
};

/** F22: My Cases tab — view, track, and download FIR for each SOS event */
export default function CasesScreen() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCases = async (pageNum = 1, refresh = false) => {
    try {
      const res = await casesApi.list(pageNum);
      const data = res.data;
      if (refresh || pageNum === 1) {
        setCases(data.cases || []);
      } else {
        setCases(prev => [...prev, ...(data.cases || [])]);
      }
      setHasMore(data.has_next || false);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load cases:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadCases(); }, []);

  const onRefresh = () => { setRefreshing(true); loadCases(1, true); };
  const onLoadMore = () => { if (hasMore && !loading) { loadCases(page + 1); } };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }); }
    catch { return iso; }
  };

  const handleResolve = async (caseId: string) => {
    Alert.alert('Resolve Case', 'Mark this case as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve', onPress: async () => {
          try {
            await casesApi.resolve(caseId, 'Marked safe by user');
            await loadCases(1, true);
          } catch (e) { Alert.alert('Error', 'Failed to resolve case'); }
        }
      },
    ]);
  };

  const renderCase = ({ item }: { item: Case }) => (
    <View style={styles.caseCard}>
      <View style={styles.caseHeader}>
        <Text style={styles.caseIdText}>{item.case_id}</Text>
        <View style={[styles.statusChip, { backgroundColor: (STATUS_COLORS[item.status] || '#6b7280') + '22', borderColor: STATUS_COLORS[item.status] || '#6b7280' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#6b7280' }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.caseBody}>
        <View style={styles.caseRow}>
          <Text style={styles.caseLabel}>Trigger</Text>
          <Text style={styles.caseValue}>{item.trigger_type?.replace('_', ' ') || 'Manual'}</Text>
        </View>
        <View style={styles.caseRow}>
          <Text style={styles.caseLabel}>Started</Text>
          <Text style={styles.caseValue}>{formatTime(item.start_time)}</Text>
        </View>
        {item.ai_classification && (
          <View style={styles.caseRow}>
            <Text style={styles.caseLabel}>AI Detection</Text>
            <Text style={[styles.caseValue, { color: '#818cf8' }]}>
              {item.ai_classification} {item.confidence_score ? `(${(item.confidence_score * 100).toFixed(0)}%)` : ''}
            </Text>
          </View>
        )}
        <View style={styles.caseRow}>
          <Text style={styles.caseLabel}>GPS Points</Text>
          <Text style={styles.caseValue}>{item.gps_trail?.length || 0} recorded</Text>
        </View>
      </View>

      <View style={styles.caseActions}>
        {item.fir_pdf_url && (
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>📄 FIR PDF</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn}
          onPress={() => Alert.alert('Live Track', `Track URL: https://safestep.app/track/${item.case_id}`)}>
          <Text style={styles.actionBtnText}>🗺️ Track</Text>
        </TouchableOpacity>
        {item.status === 'active' && (
          <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={() => handleResolve(item.case_id)}>
            <Text style={[styles.actionBtnText, { color: '#4ade80' }]}>✓ Resolve</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4f46e5" size="large" />
        <Text style={styles.loadingText}>Loading your cases...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📋 My Cases</Text>
        <Text style={styles.sub}>{cases.length} total incidents</Text>
      </View>

      <FlatList
        data={cases}
        renderItem={renderCase}
        keyExtractor={item => item.case_id}
        contentContainerStyle={styles.list}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Cases Yet</Text>
            <Text style={styles.emptySub}>Your SOS history will appear here</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d14' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#f1f5f9' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  caseCard: {
    backgroundColor: '#111827', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  caseIdText: { fontFamily: 'monospace', fontSize: 13, color: '#818cf8', fontWeight: '600' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  caseBody: { gap: 8, marginBottom: 14 },
  caseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  caseLabel: { fontSize: 13, color: '#6b7280' },
  caseValue: { fontSize: 13, color: '#d1d5db', fontWeight: '500' },
  caseActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  resolveBtn: { borderColor: 'rgba(22,163,74,0.4)', backgroundColor: 'rgba(22,163,74,0.08)' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#0b0d14' },
  loadingText: { color: '#6b7280', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptySub: { fontSize: 14, color: '#6b7280' },
});
