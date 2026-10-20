import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function PushOptInModal({
  visible,
  onAllow,
  onSkip,
}: {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.large, padding: spacing.lg, gap: spacing.md }}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
            We'll ping you when your pet's report is ready!
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            You can leave the app. We'll send a notification when the analysis is done.
          </Text>
          <Pressable onPress={onAllow} style={{ backgroundColor: colors.primary, borderRadius: radius.medium, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontWeight: '700' }}>Allow notifications</Text>
          </Pressable>
          <Pressable onPress={onSkip} style={{ alignItems: 'center', padding: spacing.sm }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export async function notificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return 'granted';
    if (current.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function registerPushToken() {
  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (!granted.granted) return;
    const token = await Notifications.getExpoPushTokenAsync();
    const { savePushToken } = await import('../services/lookupService');
    await savePushToken(token.data);
  } catch (error) {
    console.warn('[Push] registration skipped', error);
  }
}
