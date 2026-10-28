import React, { useEffect, useState } from 'react';
import {
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

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getOfferings()
      .then(pkgs => setPackages(getBonePackages(pkgs)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🦴 Get Bones</Text>
            <Pressable onPress={onClose} hitSlop={16}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
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
