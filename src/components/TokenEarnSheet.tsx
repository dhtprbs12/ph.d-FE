import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, shadows } from '../theme';

const WAYS: { title: string; detail: string; reward: string }[] = [
  {
    title: 'Daily check-in',
    detail: 'Check in once a day.',
    reward: '+5',
  },
  {
    title: 'Streak bonus',
    detail: '7 days +10, 30 days +30, 100 days +50. Each bonus is once.',
    reward: '',
  },
  {
    title: 'Register a new product',
    detail: "Scan a barcode. If it isn't in our database, a register step appears. Finish it.",
    reward: '+20',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export default function TokenEarnSheet({
  visible,
  onClose,
  title = 'How to earn tokens',
  subtitle,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {WAYS.map(way => (
            <View key={way.title} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{way.title}</Text>
                <Text style={styles.rowDetail}>{way.detail}</Text>
              </View>
              {way.reward ? <Text style={styles.reward}>{way.reward}</Text> : null}
            </View>
          ))}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  rowDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  reward: {
    ...typography.labelLarge,
    color: colors.accent,
  },
  doneBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    minHeight: 48,
  },
  doneText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
  },
});
