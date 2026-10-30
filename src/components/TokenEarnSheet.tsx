import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

const WAYS: { title: string; detail: string; reward: string; icon: 'calendar-outline' | 'flame-outline' | 'barcode-outline' }[] = [
  {
    title: 'Daily log',
    detail: 'Log once a day.',
    reward: '+5',
    icon: 'calendar-outline',
  },
  {
    title: 'Streak bonus',
    detail: '7 days +10, 30 days +30, 100 days +50. Each bonus is once.',
    reward: '+10 to +50',
    icon: 'flame-outline',
  },
  {
    title: 'Register a new product',
    detail: "Finish a barcode that isn't in the database.",
    reward: '+20',
    icon: 'barcode-outline',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  onBuyBones?: () => void;
}

export default function TokenEarnSheet({
  visible,
  onClose,
  title = 'Get bones',
  subtitle,
  onBuyBones,
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

          <View style={styles.list}>
            {WAYS.map(way => (
              <View key={way.title} style={styles.row}>
                <View style={styles.iconCircle}>
                  <Ionicons name={way.icon} size={18} color={colors.white} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{way.title}</Text>
                  <Text style={styles.rowDetail}>{way.detail}</Text>
                </View>
                <View style={styles.rewardPill}>
                  <Text style={styles.reward}>{way.reward}</Text>
                </View>
              </View>
            ))}
          </View>

          {onBuyBones ? (
            <Pressable
              onPress={() => { onClose(); setTimeout(onBuyBones, 350); }}
              style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Buy bones"
            >
              <Text style={styles.buyText}>🦴  Buy bones</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
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
    backgroundColor: 'rgba(27, 43, 39, 0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
    ...typography.displaySmall,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  rewardPill: {
    backgroundColor: colors.danger + '18',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reward: {
    ...typography.labelMedium,
    color: colors.danger,
    fontWeight: '700',
  },
  buyBtn: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: {
    ...typography.labelLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  doneBtn: {
    marginTop: spacing.sm,
    minHeight: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
