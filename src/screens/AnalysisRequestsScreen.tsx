import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

export function AnalysisRequestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const [items, setItems] = useState<LookupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [choices, setChoices] = useState<LookupCandidate[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await listLookups();
      setItems(data.lookups);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { marginLeft: spacing.sm, color: colors.textPrimary }]}>
          Analysis requests
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
          {items.length === 0 ? (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              Requests you send from search or a barcode miss show up here.
            </Text>
          ) : null}
          {items.map((item) => (
            <Pressable
              key={item.id}
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
          ))}
          {openId ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
