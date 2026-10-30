import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import {
  getOfferings,
  getBonePackages,
  purchase,
  pollForBoneUpdate,
  type PackageInfo,
} from '../services/billingService';
import { useToast } from './common/Toast';

const SHEET_OFFSET = 640;

interface Props {
  visible: boolean;
  onClose: () => void;
  currentBalance: number;
  getBalance: () => Promise<number>;
  onBalanceUpdated: (newBalance: number) => void;
}

const BONE_LABELS: Record<string, string> = {
  bones_small: '50 bones',
  bones_100: '100 bones',
  bones_medium: '200 bones',
  bones_large: '500 bones',
};

const BEST_VALUE = 'bones_medium';

export function BonePackSheet({ visible, onClose, currentBalance, getBalance, onBalanceUpdated }: Props) {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const toast = useToast();
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SHEET_OFFSET, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      closing.current = false;
      onClose();
    });
  };

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    translateY.setValue(SHEET_OFFSET);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    setLoading(true);
    getOfferings()
      .then(pkgs => setPackages(getBonePackages(pkgs)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, backdropOpacity, translateY]);

  const handleBuy = async (pkg: PackageInfo) => {
    setPurchasing(pkg.identifier);
    let finished = false;

    const succeed = (newBalance: number) => {
      if (finished) return;
      finished = true;
      const gained = newBalance - currentBalance;
      onBalanceUpdated(newBalance);
      DeviceEventEmitter.emit('phd-bones-refresh');
      toast.show({ message: `🦴×${gained}`, type: 'success' });
      onClose();
      setPurchasing(null);
    };

    const watch = pollForBoneUpdate(currentBalance, getBalance, 20, 1000)
      .then(result => {
        if (result.updated) succeed(result.newBalance);
        return result;
      })
      .catch(() => ({ updated: false, newBalance: currentBalance }));

    let failed = false;
    try {
      const result = await purchase(pkg);
      if (result.cancelled) {
        finished = true;
        setPurchasing(null);
        return;
      }
      failed = !result.success;
    } catch {
      failed = true;
    }

    if (finished) return;

    const result = await watch;
    if (finished || result.updated) return;

    if (failed) {
      toast.show({ message: 'Purchase failed. Please try again.', type: 'error' });
    } else {
      onClose();
    }
    setPurchasing(null);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Pressable onPress={requestClose} hitSlop={16} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>Get bones</Text>
          <Text style={styles.balance}>Current balance {currentBalance}</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : packages.length === 0 ? (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', padding: spacing.lg }]}>
              Bone packs are not available right now.
            </Text>
          ) : (
            <View style={styles.packs}>
              {packages.map(pkg => {
                const label = BONE_LABELS[pkg.identifier] || pkg.product.title;
                const isBuying = purchasing === pkg.identifier;
                const best = pkg.identifier === BEST_VALUE;
                return (
                  <View
                    key={pkg.identifier}
                    style={[styles.packCard, best && styles.packCardBest, !!purchasing && !isBuying && { opacity: 0.6 }]}
                  >
                    {best ? (
                      <View style={styles.bestPill}>
                        <Text style={styles.bestPillText}>Best value</Text>
                      </View>
                    ) : null}
                    <Text style={styles.boneMark}>🦴</Text>
                    <Text style={styles.packLabel}>{label}</Text>
                    <Text style={styles.packPrice}>{pkg.priceString}</Text>
                    <Pressable
                      onPress={() => handleBuy(pkg)}
                      disabled={!!purchasing}
                      style={[styles.buyBtn, best && styles.buyBtnBest, !!purchasing && { opacity: 0.6 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Buy ${label}`}
                    >
                      {isBuying ? (
                        <ActivityIndicator color={best ? colors.white : colors.primary} />
                      ) : (
                        <Text style={[styles.buyBtnText, best && styles.buyBtnTextBest]}>Buy</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
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
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  balance: {
    ...typography.bodyMedium,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontWeight: '600',
  },
  packs: {
    gap: spacing.sm,
  },
  packCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.large,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.divider,
    gap: 2,
  },
  packCardBest: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0C',
  },
  bestPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '16',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  bestPillText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  boneMark: {
    fontSize: 22,
    marginBottom: 2,
  },
  packLabel: {
    ...typography.titleMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  packPrice: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  buyBtn: {
    minWidth: 96,
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnBest: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buyBtnText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  buyBtnTextBest: {
    color: colors.white,
  },
});
