import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HistoryStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { getGradeColor, getPetTypeIcon } from '../theme';
import type { ScanHistoryItem } from '../types';
import { useApp } from '../context/AppContext';
import * as scanService from '../services/scanService';
import * as communityService from '../services/communityService';
import { buildImageUrl, formatDate, formatProductTitleText } from '../utils/helpers';

type Nav = NativeStackNavigationProp<HistoryStackParamList>;

function scanTypeIcon(scanType: string): string {
  switch (scanType?.toLowerCase()) {
    case 'barcode': return 'barcode-outline';
    case 'label_photo':
    case 'label': return 'camera-outline';
    case 'manual_input':
    case 'manual': return 'text-outline';
    case 'product_search': return 'search-outline';
    default: return 'scan-outline';
  }
}

function scanTypeLabel(scanType: string): string {
  switch (scanType?.toLowerCase()) {
    case 'barcode': return 'Barcode';
    case 'label_photo':
    case 'label': return 'Label';
    case 'manual_input':
    case 'manual': return 'Manual';
    case 'product_search': return 'Product';
    default: return 'Scan';
  }
}

/** Local calendar day key for grouping (Y-M-D in device timezone). */
function toLocalYmd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '0000-00-00';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSectionLabel(ymd: string): string {
  if (ymd === '0000-00-00') return 'Unknown date';
  const [Y, M, D] = ymd.split('-').map(Number);
  const dayRef = new Date(Y, M - 1, D);
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (dayRef.getTime() - today0.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  const yLabel = Y !== now.getFullYear() ? { year: 'numeric' as const } : {};
  return dayRef.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...yLabel });
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function groupHistoryByDay(
  items: ScanHistoryItem[]
): { ymd: string; label: string; items: ScanHistoryItem[] }[] {
  const order: string[] = [];
  const byDay = new Map<string, ScanHistoryItem[]>();
  for (const item of items) {
    const ymd = toLocalYmd(item.created_at);
    if (!byDay.has(ymd)) {
      byDay.set(ymd, []);
      order.push(ymd);
    }
    byDay.get(ymd)!.push(item);
  }
  return order.map((ymd) => ({
    ymd,
    label: formatSectionLabel(ymd),
    items: byDay.get(ymd) ?? [],
  }));
}

function ProductThumb({
  imageUrl,
  brandHint,
  isListFocused,
}: {
  imageUrl: string | null;
  brandHint?: string | null;
  /** When History list is visible again (e.g. back from Result), retry so we don’t stay on placeholder after a failed load. */
  isListFocused: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  useEffect(() => {
    if (isListFocused) {
      setFailed(false);
    }
  }, [isListFocused]);

  if (!imageUrl || failed) {
    return (
      <View style={styles.thumbPlaceholder}>
        <Text style={styles.thumbPhEmoji} allowFontScaling={false}>
          🍽
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.thumbImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
      accessibilityLabel={brandHint ? `${brandHint} product` : 'Product image'}
    />
  );
}

function StaggeredView({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, delay: index * 50 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, delay: index * 50, damping: 15, stiffness: 100 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function HistoryCard({ item, onPress, isSaved, onToggleSave }: {
  item: ScanHistoryItem;
  onPress: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const isListFocused = useIsFocused();
  const gradeColor = getGradeColor(item.grade);
  const productImageUrl = buildImageUrl(item.product_image);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.95 }]}
      accessibilityRole="button"
      accessibilityLabel={`${formatProductTitleText(item.product_name ?? 'Product')}, ${formatDate(item.created_at)}`}
    >
      <View style={[styles.card, shadows.card]}>
        {/* Top section: thumbnail + text + score */}
        <View style={styles.cardTop}>
          <ProductThumb
            imageUrl={productImageUrl}
            brandHint={item.product_brand ? formatProductTitleText(item.product_brand) : null}
            isListFocused={isListFocused}
          />

          <View style={styles.cardMiddle}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text
                  style={[typography.bodyLarge, { fontWeight: '500', color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {formatProductTitleText(item.product_name ?? 'Unknown Product')}
                </Text>
                {item.product_brand ? (
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                    {formatProductTitleText(item.product_brand)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.scoreCircle, { backgroundColor: gradeColor + '26' }]}>
                <Text style={[typography.numericLarge, { color: gradeColor, fontSize: 18, lineHeight: 22 }]}>{item.final_score}</Text>
                <Text style={[typography.labelSmall, { color: gradeColor, fontSize: 10 }]}>{item.grade}</Text>
              </View>
            </View>

            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Ionicons name={scanTypeIcon(item.scan_type) as any} size={10} color={colors.textSecondary} />
                <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                  {scanTypeLabel(item.scan_type)}
                </Text>
              </View>
              {item.pet_name && item.pet_type && (
                <View style={styles.badge}>
                  <Text style={{ fontSize: 10 }}>{getPetTypeIcon(item.pet_type)}</Text>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{item.pet_name}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Date strip */}
        <View style={styles.dateStrip}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              {formatTimeOnly(item.created_at)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {item.product_id && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); onToggleSave(); }}
                hitSlop={8}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={isSaved ? colors.primary : colors.textSecondary}
                />
              </Pressable>
            )}
            <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { pets } = useApp();

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPetId, setFilterPetId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const filterPet = filterPetId ? pets.find(p => p.id === filterPetId) : null;

  const historyByDay = useMemo(() => groupHistoryByDay(history), [history]);

  const loadHistory = useCallback(async () => {
    try {
      const items = await scanService.getHistory({
        petName: filterPet?.name,
        petType: filterPet?.pet_type,
        limit: 50,
        offset: 0,
      });
      setHistory(items);
    } catch (e) {
      console.warn('History load failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [filterPet]);

  useEffect(() => {
    setIsLoading(true);
    void loadHistory();
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  useEffect(() => {
    if (history.length === 0) return;
    const productIds = [...new Set(history.filter(h => h.product_id).map(h => h.product_id!))];
    const loadSaved = async () => {
      try {
        const saved = await communityService.getMySaved();
        const ids = new Set(saved.map(s => s.product_id));
        setSavedIds(ids);
      } catch {}
    };
    loadSaved();
  }, [history]);

  const toggleSave = useCallback(async (productId: string) => {
    const wasSaved = savedIds.has(productId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      if (wasSaved) await communityService.unsaveProduct(productId);
      else await communityService.saveProduct(productId);
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(productId);
        else next.delete(productId);
        return next;
      });
    }
  }, [savedIds]);

  const onCardPress = (item: ScanHistoryItem) => {
    navigation.navigate('Result', {
      scanId: item.id,
      preloadedScore: {
        score: item.final_score,
        ...(item.grade ? { grade: item.grade } : {}),
        ...(item.recommendation ? { recommendation: item.recommendation } : {}),
      },
      ...(item.product_id
        ? {
            product: {
              id: item.product_id,
              name: item.product_name ?? 'Product',
              ...(item.product_brand ? { brand: item.product_brand } : {}),
              ...(item.product_image ? { image_url: item.product_image } : {}),
            },
          }
        : {}),
      ...(item.product_image ? { historyImageUrl: item.product_image } : {}),
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[typography.displayLarge, { color: colors.textPrimary }]}>History</Text>
        <Pressable onPress={() => setShowFilter(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="filter" size={20} color={colors.primary} />
          {filterPet && (
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primary }}>{filterPet.name}</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Loading history...
          </Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={60} color={colors.textSecondary + '80'} />
          <Text style={[typography.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>
            No Scans Yet
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Your scan history will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {historyByDay.map((section, sIdx) => (
            <View key={section.ymd} style={[styles.daySection, sIdx > 0 && styles.daySectionSpaced]}>
              <Text style={styles.daySectionLabel} allowFontScaling={false}>
                {section.label}
              </Text>
              {section.items.map((item, i) => (
                <StaggeredView key={item.id} index={sIdx * 20 + i}>
                  <HistoryCard
                    item={item}
                    onPress={() => onCardPress(item)}
                    isSaved={item.product_id ? savedIds.has(item.product_id) : false}
                    onToggleSave={() => item.product_id && toggleSave(item.product_id)}
                  />
                </StaggeredView>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilter(false)}
      >
        <Pressable style={styles.modalBg} onPress={() => setShowFilter(false)}>
          <View style={styles.filterSheet}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              Filter by Pet
            </Text>

            <Pressable
              onPress={() => { setFilterPetId(null); setShowFilter(false); }}
              style={[styles.filterRow, !filterPetId && { backgroundColor: colors.primary + '14' }]}
            >
              <Ionicons name="paw" size={18} color={colors.primary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>All Pets</Text>
              {!filterPetId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>

            {pets.map(p => (
              <Pressable
                key={p.id}
                onPress={() => { setFilterPetId(p.id); setShowFilter(false); }}
                style={[styles.filterRow, filterPetId === p.id && { backgroundColor: colors.primary + '14' }]}
              >
                <Text style={{ fontSize: 16 }}>{getPetTypeIcon(p.pet_type)}</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{p.name}</Text>
                {filterPetId === p.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: 0 },
  daySection: { gap: spacing.sm },
  daySectionSpaced: { marginTop: spacing.lg },
  daySectionLabel: {
    ...typography.labelLarge,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  thumbImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPhEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  cardMiddle: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.lightGray,
    borderRadius: radius.small,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.lightGray + '80',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    marginBottom: spacing.xxs,
  },
});
