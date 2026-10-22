import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export function AnalysisNotice() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary + '10', borderRadius: radius.large, borderWidth: 1, borderColor: colors.primary + '33', padding: spacing.md }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="notifications-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>Notification</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          The request is sent when the pet is added. A notification is sent within 24 hours, when the analysis is ready.
        </Text>
      </View>
    </View>
  );
}
