import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { HistoryStackParamList } from '../navigation/types';
import type { Product } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import {
  ackLookup,
  getLookup,
  type LookupDetail,
} from '../services/lookupService';

const STATUS_LABEL: Record<LookupDetail['status'], string> = {
  queued: 'Preparing',
  searching: 'Preparing',
  needs_choice: 'Choose a match',
  ready: 'Ready',
  failed: "Couldn't find a label",
};

const PHOTO_LABELS = [
  { key: 'frontImageUrl', label: 'Front' },
  { key: 'ingredientImageUrl', label: 'Ingredients' },
  { key: 'barcodeImageUrl', label: 'Barcode' },
] as const;

function failureCopy(detail: LookupDetail) {
  if (detail.failureReason === 'unreadable_photo') {
    return "We couldn't read the ingredient panel. Photograph it again.";
  }
  const name = detail.queryName || 'this food';
  return `We couldn't find a published ingredient panel for ${name}. Check the spelling, or add a product page link.`;
}

export function LookupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const route = useRoute<RouteProp<HistoryStackParamList, 'LookupRequest'>>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<LookupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await getLookup(route.params.id);
      setDetail(next);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load this request.');
    } finally {
      setLoading(false);
    }
  }, [route.params.id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!detail || detail.status !== 'ready' || !detail.productId) return;
    const productId = detail.productId;
    const name = [detail.brand, detail.queryName].filter(Boolean).join(' ') || 'Food';
    void ackLookup(detail.id).catch(() => {});
    navigation.replace('Result', {
      productId,
      product: {
        id: productId,
        name,
        ...(detail.brand ? { brand: detail.brand } : {}),
      } as Product,
      preloadedScore: { score: 0 },
    });
  }, [detail, navigation]);

  const title = detail
    ? ([detail.brand, detail.queryName].filter(Boolean).join(' ') || 'Food photos')
    : 'Request';
  const photos = detail
    ? PHOTO_LABELS.map((slot) => ({ label: slot.label, url: detail[slot.key] })).filter((slot) => slot.url)
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
          {error ? <Text style={[typography.bodyMedium, { color: colors.danger }]}>{error}</Text> : null}
          {detail ? (
            <>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{STATUS_LABEL[detail.status]}</Text>
              {detail.status === 'queued' || detail.status === 'searching' ? (
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  We'll notify you within 24 hours.
                </Text>
              ) : null}
              {detail.status === 'failed' ? (
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{failureCopy(detail)}</Text>
              ) : null}
              {detail.status === 'ready' && detail.productId ? (
                <ActivityIndicator color={colors.primary} />
              ) : null}
              {detail.status === 'ready' && !detail.productId ? (
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  This report isn't available yet.
                </Text>
              ) : null}
              {detail.status !== 'ready' && detail.entry === 'photo' && photos.length === 0 ? (
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  Photos for this request weren't saved.
                </Text>
              ) : null}
              {detail.status !== 'ready'
                ? photos.map((slot) => (
                  <View key={slot.label} style={{ gap: spacing.xs }}>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{slot.label}</Text>
                    <Image
                      source={{ uri: slot.url! }}
                      style={{ width: '100%', height: 220, borderRadius: radius.medium, backgroundColor: colors.lightGray }}
                      resizeMode="cover"
                    />
                  </View>
                ))
                : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
