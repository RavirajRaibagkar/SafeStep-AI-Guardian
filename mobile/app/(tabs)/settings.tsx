import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { authApi, geofenceApi } from '../../services/api';

interface Contact { name: string; phone: string; priority: number; }
interface UserSettings {
  biometric_lock: boolean;
  panic_phrase: string;
  checkin_interval: number;
  fake_call_contact: string;
  lone_walker_enabled: boolean;
  notifications_enabled: boolean;
}

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings>({
    biometric_lock: false,
    panic_phrase: 'SafeStep Help',
    checkin_interval: 60,
    fake_call_contact: 'Mom',
    lone_walker_enabled: false,
    notifications_enabled: true,
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await authApi.getProfile();
      setUser(res.data.user);
      setContacts(res.data.user.emergency_contacts || []);
      setSettings({ ...settings, ...(res.data.user.settings || {}) });
    } catch (e) {
      console.warn('Failed to load profile:', e);
    }
  };

  const saveSettings = async () => {
    try {
      await authApi.updateProfile({
        settings,
        emergency_contacts: contacts,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Required', 'Please enter name and phone');
      return;
    }
    if (contacts.length >= 5) {
      Alert.alert('Limit', 'Maximum 5 emergency contacts');
      return;
    }
    setContacts(prev => [...prev, { ...newContact, priority: prev.length + 1 }]);
    setNewContact({ name: '', phone: '' });
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, priority: i + 1 })));
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    Alert.alert('Logged out', 'You have been logged out.');
  };

  const testBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Test Biometric Auth' });
    Alert.alert(result.success ? '✅ Success' : '❌ Failed', result.success ? 'Biometric works!' : 'Authentication failed');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚙️ Settings</Text>
      {user && <Text style={styles.subtitle}>Logged in as {user.name}</Text>}

      {/* Emergency Contacts (F18) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🆘 Emergency Contacts (F18)</Text>
        <Text style={styles.sectionSub}>Up to 5 contacts in priority order. SOS cascades through them.</Text>

        {contacts.map((c, i) => (
          <View key={i} style={styles.contactRow}>
            <View style={styles.priorityBadge}><Text style={styles.priorityText}>P{c.priority}</Text></View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
            </View>
            <TouchableOpacity onPress={() => removeContact(i)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {contacts.length < 5 && (
          <View style={styles.addContactForm}>
            <TextInput style={styles.input} value={newContact.name} onChangeText={t => setNewContact(p => ({ ...p, name: t }))} placeholder="Contact Name" placeholderTextColor="#6b7280" />
            <TextInput style={styles.input} value={newContact.phone} onChangeText={t => setNewContact(p => ({ ...p, phone: t }))} placeholder="+91XXXXXXXXXX" placeholderTextColor="#6b7280" keyboardType="phone-pad" />
            <TouchableOpacity style={styles.addBtn} onPress={addContact}>
              <Text style={styles.addBtnText}>+ Add Contact</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Security Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔐 Security</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Biometric App Lock (F30)</Text>
            <Text style={styles.settingDesc}>Require fingerprint/Face ID on open</Text>
          </View>
          <Switch value={settings.biometric_lock} onValueChange={v => setSettings(p => ({ ...p, biometric_lock: v }))} trackColor={{ false: '#374151', true: '#4f46e5' }} />
        </View>

        <TouchableOpacity style={styles.testBtn} onPress={testBiometric}>
          <Text style={styles.testBtnText}>🔍 Test Biometric Auth</Text>
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Panic Phrase (F14)</Text>
          <TextInput style={styles.input} value={settings.panic_phrase} onChangeText={t => setSettings(p => ({ ...p, panic_phrase: t }))} placeholder="SafeStep Help" placeholderTextColor="#6b7280" />
          <Text style={styles.inputHint}>Saying this phrase triggers silent SOS</Text>
        </View>
      </View>

      {/* Check-in Settings (F17) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏰ Check-in Settings (F17)</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Text style={styles.settingDesc}>Safety reminders and alerts</Text>
          </View>
          <Switch value={settings.notifications_enabled} onValueChange={v => setSettings(p => ({ ...p, notifications_enabled: v }))} trackColor={{ false: '#374151', true: '#4f46e5' }} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Check-in Interval (minutes)</Text>
          <View style={styles.intervalRow}>
            {[30, 60, 120].map(m => (
              <TouchableOpacity key={m} style={[styles.intervalBtn, settings.checkin_interval === m && styles.intervalBtnActive]}
                onPress={() => setSettings(p => ({ ...p, checkin_interval: m }))}>
                <Text style={[styles.intervalBtnText, settings.checkin_interval === m && { color: 'white' }]}>{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Fake Call (F05) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📞 Fake Call (F05)</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Caller Name Display</Text>
          <TextInput style={styles.input} value={settings.fake_call_contact} onChangeText={t => setSettings(p => ({ ...p, fake_call_contact: t }))} placeholder="Mom" placeholderTextColor="#6b7280" />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveBtn, saved && styles.savedBtn]} onPress={saveSettings}>
        <Text style={styles.saveBtnText}>{saved ? '✅ Saved!' : '💾 Save Settings'}</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>🚪 Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d14' },
  content: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginTop: 40, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 24 },
  section: { backgroundColor: '#111827', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  sectionSub: { fontSize: 12, color: '#6b7280', marginTop: -8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(79,70,229,0.08)', borderRadius: 10, padding: 12 },
  priorityBadge: { backgroundColor: '#4f46e5', borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  priorityText: { color: 'white', fontSize: 11, fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  contactPhone: { fontSize: 12, color: '#9ca3af' },
  removeBtn: { padding: 6 },
  removeBtnText: { color: '#f87171', fontSize: 16 },
  addContactForm: { gap: 10 },
  addBtn: { backgroundColor: 'rgba(79,70,229,0.2)', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(79,70,229,0.4)' },
  addBtnText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  settingDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  testBtn: { backgroundColor: 'rgba(79,70,229,0.1)', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(79,70,229,0.25)' },
  testBtnText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  inputHint: { fontSize: 11, color: '#6b7280' },
  input: { backgroundColor: '#1f2937', borderRadius: 10, padding: 12, color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  intervalRow: { flexDirection: 'row', gap: 10 },
  intervalBtn: { flex: 1, padding: 10, backgroundColor: '#1f2937', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  intervalBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  intervalBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  savedBtn: { backgroundColor: '#16a34a' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  logoutBtn: { alignItems: 'center', padding: 14, marginTop: 8 },
  logoutBtnText: { color: '#f87171', fontSize: 14 },
});
