import React, { useRef } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function PushOptInModal({
  visible,
  onAllow,
  onSkip,
  onClose,
}: {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const pending = useRef<'allow' | 'skip' | null>(null);

  const choose = (action: 'allow' | 'skip') => {
    pending.current = action;
    onClose();
    if (Platform.OS === 'ios') return;
    pending.current = null;
    setTimeout(() => {
      if (action === 'allow') onAllow();
      else onSkip();
    }, 350);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onDismiss={() => {
        const action = pending.current;
        pending.current = null;
        if (action === 'allow') onAllow();
        else if (action === 'skip') onSkip();
      }}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.large, padding: spacing.lg, gap: spacing.md }}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
            We'll ping you when your pet's report is ready!
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            You can leave the app. We'll send a notification when the analysis is done.
          </Text>
          <Pressable onPress={() => choose('allow')} style={{ backgroundColor: colors.primary, borderRadius: radius.medium, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontWeight: '700' }}>Allow notifications</Text>
          </Pressable>
          <Pressable onPress={() => choose('skip')} style={{ alignItems: 'center', padding: spacing.sm }}>
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
    console.log('[Push] registerPushToken() called');
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    console.log('[Push] current permission:', current.status, 'granted:', current.granted);
    const granted = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (!granted.granted) {
      console.log('[Push] permission not granted, skipping token save');
      return;
    }
    console.log('[Push] fetching expo push token...');
    const token = await Notifications.getExpoPushTokenAsync();
    console.log('[Push] got token:', token.data?.slice(0, 30) + '...');
    const { savePushToken } = await import('../services/lookupService');
    await savePushToken(token.data);
    console.log('[Push] token saved to server ✓');
  } catch (error) {
    console.warn('[Push] registration skipped', error);
  }
}
