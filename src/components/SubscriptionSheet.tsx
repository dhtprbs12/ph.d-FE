import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import {
  getOfferings,
  getSubscriptionPackages,
  purchase,
  restorePurchases,
  isRevenueCatAvailable,
  type PackageInfo,
} from '../services/billingService';

const PRIVACY_URL = 'https://phd-be-production.up.railway.app/privacy';
const TERMS_URL = 'https://phd-be-production.up.railway.app/terms';
const SHEET_OFFSET = 640;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}

export function SubscriptionSheet({ visible, onClose, onSubscribed }: Props) {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
      .then(pkgs => {
        const subs = getSubscriptionPackages(pkgs);
        setPackages(subs);
        if (subs.length > 0 && !selected) setSelected(subs[0].identifier);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, backdropOpacity, translateY]);

  const handlePurchase = async () => {
    const pkg = packages.find(p => p.identifier === selected);
    if (!pkg) return;
    setPurchasing(true);
    try {
      const result = await purchase(pkg);
      if (result.success) {
        onSubscribed();
      }
    } catch {}
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) onSubscribed();
    } catch {}
    setRestoring(false);
  };

  const isMonthly = (id: string) => id === '$rc_monthly';
  const isAnnual = (id: string) => id === '$rc_annual';

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

          <View style={styles.titleArea}>
            <Text style={styles.title}>PHD Plus</Text>
            <Text style={styles.subtitle}>
              Ingredient details and a vet PDF.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : packages.length === 0 ? (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', padding: spacing.lg }]}>
              Subscriptions are not available right now.
            </Text>
          ) : (
            <>
              {/* Plans */}
              <View style={styles.plans}>
                {packages.map(pkg => (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => setSelected(pkg.identifier)}
                    style={[
                      styles.planCard,
                      selected === pkg.identifier && styles.planCardSelected,
                    ]}
                  >
                    <View style={[styles.radioEmpty, selected === pkg.identifier && styles.radioSelected]}>
                      {selected === pkg.identifier ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>
                        {isMonthly(pkg.identifier) ? 'Monthly' : isAnnual(pkg.identifier) ? 'Annual' : pkg.product.title}
                      </Text>
                      <Text style={styles.planPrice}>{pkg.priceString}</Text>
                    </View>
                    {isAnnual(pkg.identifier) && (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>Save ~33%</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Subscribe button */}
              <Pressable
                onPress={handlePurchase}
                disabled={purchasing || !selected}
                style={[styles.subscribeBtn, (purchasing || !selected) && { opacity: 0.6 }]}
              >
                {purchasing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.subscribeBtnText}>Subscribe</Text>
                )}
              </Pressable>

              {/* Auto-renew disclosure */}
              <Text style={styles.disclosure}>
                Auto-renews until you cancel. Payment is charged to your App Store or Google Play account. Cancel at least 24 hours before the period ends to avoid the next charge.
              </Text>

              {/* Restore + legal links */}
              <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
                <Text style={styles.restoreBtnText}>
                  {restoring ? 'Restoring...' : 'Restore Subscription'}
                </Text>
              </Pressable>

              <View style={styles.legalRow}>
                <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
                  <Text style={styles.legalLink}>Terms of Use</Text>
                </Pressable>
                <Text style={styles.legalDot}>·</Text>
                <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </Pressable>
              </View>
            </>
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
  titleArea: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  plans: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.large,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0C',
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  planTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  planPrice: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.small,
  },
  saveBadgeText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subscribeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subscribeBtnText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  disclosure: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  restoreBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  legalLink: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
