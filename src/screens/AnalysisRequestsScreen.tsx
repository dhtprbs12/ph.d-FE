import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HistoryStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { listLookups, type LookupSummary } from '../services/lookupService';

const STATUS_LABEL: Record<LookupSummary['status'], string> = {
  queued: 'Preparing',
  searching: 'Preparing',
  needs_choice: 'Choose a match',
  ready: 'Ready',
  failed: "Couldn't find a label",
};

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
          style={{ backgroundColor: colors.white, borderRadius: radius.large, padding: spacing.md, gap: 4 }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
            {[item.brand, item.queryName].filter(Boolean).join(' ') || 'Food photos'}
          </Text>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{STATUS_LABEL[item.status]}</Text>
          {item.status === 'queued' || item.status === 'searching' ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              We'll notify you within 24 hours.
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
