import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import passportService, { TimelineEntry, InsightData } from '../services/passportService';
import ZoomableImageModal from '../components/ZoomableImageModal';
import { buildImageUrl, buildThumbUrl } from '../utils/helpers';

function StoolScoreLabel(score: number | null): { label: string; emoji: string; color: string } {
  if (score === null) return { label: 'No data', emoji: '—', color: colors.textSecondary };
  if (score >= 4.5) return { label: 'Excellent', emoji: '😊', color: colors.safe };
  if (score >= 3.5) return { label: 'Good', emoji: '🙂', color: colors.primaryLight };
  if (score >= 2.5) return { label: 'Okay', emoji: '😐', color: colors.caution };
  if (score >= 1.5) return { label: 'Poor', emoji: '😕', color: colors.warning };
  return { label: 'Bad', emoji: '😫', color: colors.danger };
}

function formatPassportDay(raw?: string | null) {
  if (!raw) return null;
  const dateStr = raw.includes('T') ? raw : `${raw}T12:00:00`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayWord(n: number) {
  return n === 1 ? 'day' : 'days';
}

function StatTile({
  emoji,
  label,
  value,
  color,
  tint,
}: {
  emoji: string;
  label: string;
  value: string;
  color: string;
  tint: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: tint }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function TimelineCard({ entry, onPressImage }: { entry: TimelineEntry; onPressImage: (uri: string) => void }) {
  const stool = StoolScoreLabel(entry.stats.avgStoolScore);
  const hasCheckins = entry.stats.checkinCount > 0;
  const startLabel = formatPassportDay(entry.startedAt);
  const endLabel = entry.isCurrent || !entry.endedAt ? 'now' : formatPassportDay(entry.endedAt);
  const range = startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel;
  const itchOn = entry.stats.itchCount > 0;
  const vomitOn = entry.stats.vomitCount > 0;
  const thumbUri = buildThumbUrl(entry.imageUrl) || entry.imageUrl;
  const fullUri = buildImageUrl(entry.imageUrl) || entry.imageUrl;

  return (
    <View style={styles.timelineCard}>
      <View style={[styles.timelineContent, entry.isCurrent && styles.timelineContentCurrent]}>
        <View style={styles.titleRow}>
          {thumbUri ? (
            <Pressable
              onPress={() => fullUri && onPressImage(fullUri)}
              accessibilityRole="button"
              accessibilityLabel="View product image full-screen"
            >
              <Image source={{ uri: thumbUri }} style={styles.productImage} />
            </Pressable>
          ) : (
            <View style={[styles.productImage, styles.productImageFallback]}>
              <Ionicons name="nutrition-outline" size={22} color={colors.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.productName} numberOfLines={2}>{entry.productName}</Text>
            {entry.brand ? <Text style={styles.brandName}>{entry.brand}</Text> : null}
          </View>
          {entry.isCurrent ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.dateChip}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={styles.dateChipText}>{range}</Text>
          </View>
          <View style={styles.daysChip}>
            <Text style={styles.daysChipText}>
              {entry.daysOnFood} {dayWord(entry.daysOnFood)}
            </Text>
          </View>
        </View>

        {hasCheckins ? (
          <>
            <View style={styles.checkinChip}>
              <Ionicons name="checkbox-outline" size={15} color={colors.primary} />
              <Text style={styles.checkinChipText}>
                From {entry.stats.checkinCount} {entry.stats.checkinCount === 1 ? 'check-in' : 'check-ins'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <StatTile
                emoji={stool.emoji}
                label="Stool"
                value={`Usually ${stool.label}`}
                color={stool.color}
                tint={stool.color + '18'}
              />
              <StatTile
                emoji="🐾"
                label="Itching"
                value={itchOn ? `${entry.stats.itchCount} ${dayWord(entry.stats.itchCount)}` : 'None'}
                color={itchOn ? '#B8860B' : colors.safe}
                tint={itchOn ? colors.caution + '28' : colors.safe + '14'}
              />
              <StatTile
                emoji={vomitOn ? '🤮' : '✨'}
                label="Vomiting"
                value={vomitOn ? `${entry.stats.vomitCount} ${dayWord(entry.stats.vomitCount)}` : 'None'}
                color={vomitOn ? colors.danger : colors.safe}
                tint={vomitOn ? colors.danger + '18' : colors.safe + '14'}
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyCheckins}>
            <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.emptyCheckinsText}>No check-ins on this food yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InsightCard({ insight, onPress }: { insight: InsightData; onPress: () => void }) {
  const typeColors = {
    itch_correlation: '#E74C3C',
    vomit_correlation: colors.danger,
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
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);

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

  const filteredTimeline = [...timeline]
    .filter(e => e.isCurrent || e.daysOnFood > 0)
    .reverse();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Food history</Text>
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
          <View>
            <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>
              {petName || 'Pet'}'s food history
            </Text>
            <Pressable
              onPress={() => setHowItWorksVisible(true)}
              style={({ pressed }) => [styles.howItWorksLink, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="How food history works"
            >
              <Text style={styles.howItWorksLinkText}>How this works</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          </View>

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
                  const vomitImproved = curr.stats.vomitCount < prev.stats.vomitCount;
                  const vomitWorsened = curr.stats.vomitCount > prev.stats.vomitCount;

                  const changes: string[] = [];
                  if (stoolImproved) changes.push('Stool improved');
                  if (stoolWorsened) changes.push('Stool worsened');
                  if (itchImproved) changes.push('Less itching');
                  if (itchWorsened) changes.push('More itching');
                  if (vomitImproved) changes.push('Less vomiting');
                  if (vomitWorsened) changes.push('More vomiting');

                  if (changes.length === 0) return null;
                  const isPositive = stoolImproved || itchImproved || vomitImproved;

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

              {filteredTimeline.map((entry) => (
                <TimelineCard key={entry.id} entry={entry} onPressImage={setZoomImageUri} />
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
      <ZoomableImageModal uri={zoomImageUri} visible={!!zoomImageUri} onClose={() => setZoomImageUri(null)} />
      <Modal
        visible={howItWorksVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHowItWorksVisible(false)}
      >
        <View style={styles.howSheetRoot} pointerEvents="box-none">
          <Pressable
            style={styles.howSheetBackdrop}
            onPress={() => setHowItWorksVisible(false)}
            accessibilityLabel="Close food history explanation"
          />
          <View style={styles.howSheet}>
            <View style={styles.howSheetHandle} />
            <Text style={styles.howSheetTitle}>How food history works</Text>
            <ScrollView style={styles.howSheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.howBullet}>
                • <Text style={styles.howBulletBold}>Your food story:</Text> See every food your pet has been on, and how
                their stool, itching, and vomiting looked during that time.
              </Text>
              <Text style={styles.howBullet}>
                • <Text style={styles.howBulletBold}>After a switch:</Text> See whether stool, itching, or vomiting got
                better or worse on the current food compared with the one right before it.
              </Text>
              <Text style={styles.howBullet}>
                • <Text style={styles.howBulletBold}>Ingredient patterns:</Text> See which proteins or grains may be
                affecting your pet's stool, itching, or vomiting.
              </Text>
              <Text style={styles.howBullet}>
                • <Text style={styles.howBulletBold}>Check in at least 3 times on each food:</Text> One or two days can't
                tell a real pattern from an off day. Once two of your foods each have three check-ins, we can start
                comparing their ingredients.
              </Text>
              <Text style={styles.howBullet}>
                • <Text style={styles.howBulletBold}>A pattern, not a diagnosis:</Text> Use this to notice what to ask
                your veterinarian about. It does not prove an ingredient caused a symptom.
              </Text>
            </ScrollView>
            <Pressable
              onPress={() => setHowItWorksVisible(false)}
              style={({ pressed }) => [styles.howDoneBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.howDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    borderRadius: radius.large,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineContentCurrent: {
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
  },
  productImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  productName: { ...typography.titleMedium, color: colors.textPrimary },
  brandName: { ...typography.labelSmall, color: colors.textSecondary, marginTop: 2, letterSpacing: 0.2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  dateChipText: { ...typography.labelMedium, fontWeight: '600', color: colors.primary },
  daysChip: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  daysChipText: { ...typography.labelMedium, fontWeight: '600', color: colors.textPrimary },
  checkinChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  checkinChipText: { ...typography.labelLarge, color: colors.textPrimary },
  statRow: { flexDirection: 'row', gap: spacing.xs },
  statTile: {
    flex: 1,
    borderRadius: radius.medium,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 2,
  },
  statEmoji: { fontSize: 16, marginBottom: 2 },
  statLabel: { ...typography.labelSmall, color: colors.textSecondary },
  statValue: { ...typography.labelMedium, fontWeight: '700' },
  emptyCheckins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyCheckinsText: { ...typography.labelMedium, color: colors.textSecondary, flex: 1 },
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
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  currentBadgeText: { ...typography.labelSmall, fontWeight: '700', color: colors.white },
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
  howItWorksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  howItWorksLinkText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  howSheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  howSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  howSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '78%',
    ...shadows.card,
  },
  howSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  howSheetTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  howSheetScroll: {
    maxHeight: 360,
  },
  howBullet: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  howBulletBold: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  howDoneBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    minHeight: 48,
  },
  howDoneText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.large,
    gap: spacing.md,
  },
});
