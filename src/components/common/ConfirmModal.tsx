import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  visible: boolean;
  icon?: string;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  visible,
  icon,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = colors.primary,
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.btn, styles.cancelBtn]}
            >
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[styles.btn, { backgroundColor: confirmColor, opacity: loading ? 0.6 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.white }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 36,
    marginBottom: 4,
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.medium,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.lightGray,
  },
  btnText: {
    ...typography.labelLarge,
    fontSize: 15,
    fontWeight: '600',
  },
});
