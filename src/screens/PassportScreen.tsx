import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import passportService, { TimelineEntry, InsightData } from '../services/passportService';

function StoolScoreEmoji(score: number | null) {
  if (score === null) return '—';
  if (score >= 4.5) return '😊';
  if (score >= 3.5) return '🙂';
  if (score >= 2.5) return '😐';
  if (score >= 1.5) return '😕';
  return '😫';
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const startMonth = new Date(entry.startedAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineDot}>
        <View style={[styles.timelineDotInner, entry.isCurrent && { backgroundColor: colors.primary }]} />
      </View>
      <View style={styles.timelineContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>{entry.productName}</Text>
            {entry.brand && <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{entry.brand}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{startMonth}</Text>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{entry.daysOnFood}d</Text>
          </View>
        </View>
        {entry.stats.checkinCount > 0 && (
          <View style={styles.timelineStats}>
            <Text style={styles.timelineStat}>
              💩 {entry.stats.avgStoolScore ?? '—'} {StoolScoreEmoji(entry.stats.avgStoolScore)}
            </Text>
            {entry.stats.itchCount > 0 && (
              <Text style={styles.timelineStat}>🐾 {entry.stats.itchCount}x itch</Text>
            )}
            {entry.stats.vomitCount > 0 && (
              <Text style={styles.timelineStat}>🤮 {entry.stats.vomitCount}x</Text>
            )}
          </View>
        )}
        {entry.stats.checkinCount === 0 && (
          <Text style={[typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic' }]}>No check-in data</Text>
        )}
        {entry.isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={[typography.labelSmall, { color: colors.primary }]}>Current</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InsightCard({ insight, onPress }: { insight: InsightData; onPress: () => void }) {
  const typeColors = {
    itch_correlation: '#E74C3C',
    stool_negative: '#E67E22',
    stool_positive: colors.safe,
    mixed: colors.textSecondary,
  };

  return (
    <Pressable onPress={onPress} style={styles.insightCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: 20 }}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelMedium, { color: typeColors[insight.type] || colors.textPrimary }]}>
            {insight.summary}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Tap to see details
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

export default function PassportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { petId, petName } = route.params || {};

  const [isLoading, setIsLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [insights, setInsights] = useState<InsightData[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!petId) return;
      setIsLoading(true);
      Promise.all([
        passportService.getPassport(petId),
        passportService.getInsights(petId),
      ])
        .then(([passportData, insightData]) => {
          setTimeline(passportData.timeline);
          setInsights(insightData.insights);
        })
        .catch(console.warn)
        .finally(() => setIsLoading(false));
    }, [petId])
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Nutrition Passport</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Pet Name */}
          <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>
            📊 {petName || 'Pet'}'s Journey
          </Text>

          {/* Timeline */}
          {timeline.length > 0 ? (
            <View style={{ gap: 0 }}>
              <Text style={[typography.labelLarge, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                Food Timeline
              </Text>
              {timeline.map((entry, i) => (
                <TimelineCard key={entry.id} entry={entry} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 40 }}>🍽</Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                No food history yet. Register your pet's food to start tracking!
              </Text>
            </View>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <View>
              <Text style={[typography.labelLarge, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                💡 Insights
              </Text>
              {insights.map((insight, i) => (
                <InsightCard
                  key={i}
                  insight={insight}
                  onPress={() => navigation.navigate('InsightDetail', { insight })}
                />
              ))}
              <Text style={[typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm }]}>
                ⚠️ These are correlations, not proof of causation. Please consult your veterinarian.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timelineCard: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  timelineDot: {
    width: 20,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.divider,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxs,
  },
  timelineStat: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xxs,
  },
  insightCard: {
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.large,
    gap: spacing.md,
  },
});
