import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HistoryStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatProductTitleText } from '../utils/helpers';
import { listLookups, type LookupSummary } from '../services/lookupService';

const STATUS_LABEL: Record<LookupSummary['status'], string> = {
  queued: 'Preparing',
  searching: 'Preparing',
  needs_choice: 'Choose',
  ready: 'Ready',
  failed: 'No label',
};

function formatRequestedAt(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = raw.includes('T') || hasZone ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusPill(status: LookupSummary['status']) {
  if (status === 'ready') {
    return { color: colors.white, backgroundColor: colors.primary };
  }
  if (status === 'failed') {
    return { color: '#9C4221', backgroundColor: '#F8E6DF' };
  }
  return { color: colors.textSecondary, backgroundColor: colors.lightGray };
}

export function AnalysisRequestsList({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LookupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await listLookups();
      setItems(data.lookups);
      onPendingChange?.(data.pending);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onPendingChange]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + 24,
        gap: spacing.sm,
        flexGrow: items.length === 0 ? 1 : undefined,
        justifyContent: items.length === 0 ? 'center' : undefined,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void refresh(); }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {items.length === 0 ? (
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
          Requests you send from search or a barcode miss show up here.
        </Text>
      ) : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate('LookupRequest', { id: item.id })}
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.large,
            padding: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <View style={{
            width: 44,
            height: 44,
            borderRadius: radius.medium,
            backgroundColor: colors.lightGray,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>{item.entry === 'photo' ? '📷' : '🔍'}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
              {formatProductTitleText([item.brand, item.queryName].filter(Boolean).join(' ')) || 'Food Photos'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
              {[item.petName ? `For ${item.petName}` : '', formatRequestedAt(item.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.full }, statusPill(item.status)]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: statusPill(item.status).color }}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
