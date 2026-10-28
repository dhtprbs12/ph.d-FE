import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  bones_small: '50 Bones',
  bones_100: '100 Bones',
  bones_medium: '200 Bones',
  bones_large: '500 Bones',
};

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
    try {
      const result = await purchase(pkg);
      if (result.success) {
        const { updated, newBalance } = await pollForBoneUpdate(currentBalance, getBalance);
        if (updated) {
          const gained = newBalance - currentBalance;
          toast.show({ message: `🦴×${gained}`, type: 'success' });
          onBalanceUpdated(newBalance);
        } else {
          toast.show({ message: 'Your bones will appear shortly.', type: 'info' });
        }
        onClose();
      }
    } catch {
      toast.show({ message: 'Purchase failed. Please try again.', type: 'error' });
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
          <View style={styles.header}>
            <Text style={styles.title}>🦴 Get Bones</Text>
            <Pressable onPress={requestClose} hitSlop={16}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.balance}>Current balance: {currentBalance} 🦴</Text>

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
                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => handleBuy(pkg)}
                    disabled={!!purchasing}
                    style={[styles.packCard, !!purchasing && { opacity: 0.6 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packLabel}>{label}</Text>
                      <Text style={styles.packPrice}>{pkg.priceString}</Text>
                    </View>
                    {isBuying ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <View style={styles.buyBtn}>
                        <Text style={styles.buyBtnText}>Buy</Text>
                      </View>
                    )}
                  </Pressable>
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  balance: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  packs: {
    gap: spacing.sm,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
    gap: spacing.md,
  },
  packLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  packPrice: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
  },
  buyBtnText: {
    ...typography.labelMedium,
    color: colors.white,
    fontWeight: '700',
  },
});
