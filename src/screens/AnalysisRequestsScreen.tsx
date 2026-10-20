import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HistoryStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import {
  ackLookup,
  chooseLookup,
  getLookup,
  listLookups,
  type LookupCandidate,
  type LookupSummary,
} from '../services/lookupService';

const STATUS_LABEL: Record<LookupSummary['status'], string> = {
  queued: 'Preparing',
  searching: 'Preparing',
  needs_choice: 'Choose a match',
  ready: 'Ready',
  failed: "Couldn't find a label",
};

function failureCopy(item: LookupSummary) {
  if (item.failureReason === 'unreadable_photo') {
    return "We couldn't read the ingredient panel. Photograph it again.";
  }
  const name = item.queryName || 'this food';
  return `We couldn't find a published ingredient panel for ${name}. Check the spelling, or add a product page link.`;
}

export function AnalysisRequestsList({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LookupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [choices, setChoices] = useState<LookupCandidate[]>([]);

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

  const open = async (item: LookupSummary) => {
    if (item.status === 'needs_choice') {
      const detail = await getLookup(item.id);
      setOpenId(item.id);
      setChoices(detail.candidates || []);
      return;
    }
    if (item.status !== 'ready') return;
    const detail = await getLookup(item.id);
    if (!detail.scanResult) return;
    await ackLookup(item.id);
    navigation.navigate('Result', { scanResult: detail.scanResult });
  };

  const choose = async (url: string) => {
    if (!openId) return;
    await chooseLookup(openId, url);
    setOpenId(null);
    setChoices([]);
    void refresh();
  };

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
        <View key={item.id} style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => open(item)}
            style={{ backgroundColor: colors.white, borderRadius: radius.large, padding: spacing.md, gap: 4 }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
              {[item.brand, item.queryName].filter(Boolean).join(' ') || 'Food photos'}
            </Text>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{STATUS_LABEL[item.status]}</Text>
            {item.status === 'failed' ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{failureCopy(item)}</Text>
            ) : null}
          </Pressable>
          {openId === item.id ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Which food is it?</Text>
              {choices.map((choice) => (
                <Pressable
                  key={choice.url}
                  onPress={() => choose(choice.url)}
                  style={{ backgroundColor: colors.card, borderRadius: radius.medium, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{choice.title}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {[choice.brand, choice.domain].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
