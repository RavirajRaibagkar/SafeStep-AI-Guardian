import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { socketService } from '../../services/socket';

export default function TabsLayout() {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🏠" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lone-walker"
        options={{
          title: 'Journey',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🚶" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'My Cases',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="📋" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="⚙️" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ opacity: color === '#4f46e5' ? 1 : 0.6 }}>
        {/* emoji as text for cross-platform compatibility */}
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {/* icon would be replaced with proper vector icons */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111827',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: '#111827',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
