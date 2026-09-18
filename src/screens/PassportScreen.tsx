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

function StoolScoreLabel(score: number | null): { label: string; emoji: string; color: string } {
  if (score === null) return { label: 'No data', emoji: '—', color: colors.textSecondary };
  if (score >= 4.5) return { label: 'Excellent', emoji: '😊', color: colors.safe };
  if (score >= 3.5) return { label: 'Good', emoji: '🙂', color: colors.primaryLight };
  if (score >= 2.5) return { label: 'Okay', emoji: '😐', color: colors.caution };
  if (score >= 1.5) return { label: 'Poor', emoji: '😕', color: colors.warning };
  return { label: 'Bad', emoji: '😫', color: colors.danger };
}

function TimelineCard({ entry, prevEntry }: { entry: TimelineEntry; prevEntry?: TimelineEntry }) {
  const dateStr = entry.startedAt.includes('T') ? entry.startedAt : entry.startedAt + 'T12:00:00';
  const startMonth = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const stool = StoolScoreLabel(entry.stats.avgStoolScore);
  const hasSymptoms = entry.stats.itchCount > 0 || entry.stats.vomitCount > 0;
  const hasCheckins = entry.stats.checkinCount > 0;

  const prevStool = prevEntry?.stats.avgStoolScore ?? null;
  const stoolDiff = (hasCheckins && prevStool !== null && entry.stats.avgStoolScore !== null)
    ? +(entry.stats.avgStoolScore - prevStool).toFixed(1)
    : null;

  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineContent}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelLarge, { color: colors.textPrimary }]} numberOfLines={2}>{entry.productName}</Text>
            {entry.brand && <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{entry.brand}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{startMonth}</Text>
            <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>{entry.daysOnFood} days</Text>
          </View>
        </View>

        {/* Stats */}
        {hasCheckins ? (
          <View style={{ gap: 6, marginTop: spacing.xs }}>
            {/* Stool summary */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ fontSize: 16 }}>{stool.emoji}</Text>
              <Text style={[typography.bodySmall, { color: stool.color, fontWeight: '600' }]}>
                Stool: {stool.label}
              </Text>
              {stoolDiff !== null && stoolDiff !== 0 && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: stoolDiff > 0 ? colors.safe + '15' : colors.danger + '15',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.small,
                }}>
                  <Ionicons
                    name={stoolDiff > 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={stoolDiff > 0 ? colors.safe : colors.danger}
                  />
                  <Text style={[typography.caption, { color: stoolDiff > 0 ? colors.safe : colors.danger, fontWeight: '600' }]}>
                    {Math.abs(stoolDiff)}
                  </Text>
                </View>
              )}
            </View>

            {/* Symptoms */}
            {hasSymptoms ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {entry.stats.itchCount > 0 && (
                  <View style={styles.symptomTag}>
                    <Text style={styles.symptomTagText}>🐾 Itching {entry.stats.itchCount}x</Text>
                  </View>
                )}
                {entry.stats.vomitCount > 0 && (
                  <View style={[styles.symptomTag, { backgroundColor: colors.danger + '12' }]}>
                    <Text style={[styles.symptomTagText, { color: colors.danger }]}>🤮 Vomiting {entry.stats.vomitCount}x</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 12 }}>✨</Text>
                <Text style={[typography.caption, { color: colors.safe }]}>No symptoms reported</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic' }]}>
              {entry.daysOnFood <= 3 ? 'Keep checking in to see stats!' : 'No check-in data for this period'}
            </Text>
          </View>
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

  const filteredTimeline = timeline.filter(e => e.daysOnFood > 0);

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
          {filteredTimeline.length > 0 ? (
            <View style={{ gap: 0 }}>
              <Text style={[typography.labelLarge, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                Food Timeline
              </Text>

              {/* Comparison banner if 2+ foods with checkin data */}
              {filteredTimeline.length >= 2 && filteredTimeline[0].stats.checkinCount > 0 && filteredTimeline[1].stats.checkinCount > 0 && (
                (() => {
                  const curr = filteredTimeline[0];
                  const prev = filteredTimeline[1];
                  const currStool = curr.stats.avgStoolScore;
                  const prevStool = prev.stats.avgStoolScore;
                  const stoolImproved = currStool !== null && prevStool !== null && currStool > prevStool;
                  const stoolWorsened = currStool !== null && prevStool !== null && currStool < prevStool;
                  const itchImproved = curr.stats.itchCount < prev.stats.itchCount;
                  const itchWorsened = curr.stats.itchCount > prev.stats.itchCount;

                  const changes: string[] = [];
                  if (stoolImproved) changes.push('Stool improved');
                  if (stoolWorsened) changes.push('Stool worsened');
                  if (itchImproved) changes.push('Less itching');
                  if (itchWorsened) changes.push('More itching');

                  if (changes.length === 0) return null;
                  const isPositive = stoolImproved || itchImproved;

                  return (
                    <View style={[styles.comparisonBanner, { backgroundColor: isPositive ? colors.safe + '10' : colors.warning + '10', borderColor: isPositive ? colors.safe + '30' : colors.warning + '30' }]}>
                      <Text style={{ fontSize: 16 }}>{isPositive ? '📈' : '📉'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.labelMedium, { color: isPositive ? colors.safe : colors.warning }]}>
                          Since switching to {curr.productName.split(' ').slice(0, 3).join(' ')}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {changes.join(' · ')}
                        </Text>
                      </View>
                    </View>
                  );
                })()
              )}

              {filteredTimeline.map((entry, i) => (
                <TimelineCard key={entry.id} entry={entry} prevEntry={i < filteredTimeline.length - 1 ? filteredTimeline[i + 1] : undefined} />
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
    paddingBottom: spacing.md,
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
  symptomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.caution + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.small,
  },
  symptomTagText: {
    ...typography.caption,
    fontWeight: '500',
    color: '#B8860B',
  },
  comparisonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.medium,
    borderWidth: 1,
    marginBottom: spacing.md,
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
