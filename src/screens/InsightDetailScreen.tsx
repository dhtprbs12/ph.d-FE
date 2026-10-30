import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { colors, spacing, radius, typography } from '../theme';
import passportService from '../services/passportService';
import type { InsightData, InsightFoodRecord, InsightAlternative } from '../services/passportService';
import { buildImageUrl, buildThumbUrl, formatLifeStage, toTitleCase } from '../utils/helpers';
import { calendarDaysOnFood, formatFoodDay } from '../utils/foodTime';
import ZoomableImageModal from '../components/ZoomableImageModal';

let Print: any = null;
try { Print = require('expo-print'); } catch {}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDietTags(tags?: string | null): string {
  if (!tags) return '';
  const labels: Record<string, string> = {
    grain_free: 'Grain-free',
    with_grains: 'With grains',
    limited_ingredient: 'Limited ingredient',
  };
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of String(tags).split(/[,+]/)) {
    const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parts.push(labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }
  return parts.join(' · ');
}

function stoolWords(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 4.5) return 'Excellent';
  if (score >= 3.5) return 'Good';
  if (score >= 2.5) return 'Okay';
  if (score >= 1.5) return 'Poor';
  return 'Bad';
}

function dayCount(n: number): string {
  if (!n) return 'None';
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function periodLine(food: InsightFoodRecord): string {
  const start = formatFoodDay(food.startedAt);
  const end = food.isCurrent || !food.endedAt ? 'now' : formatFoodDay(food.endedAt);
  const days = calendarDaysOnFood(food.startedAt, food.endedAt, food.isCurrent);
  const range = start && end ? `${start} – ${end}` : start || '';
  return [range, `${days} ${days === 1 ? 'day' : 'days'}`].filter(Boolean).join(' · ');
}

function foodsForPdf(insight: InsightData): InsightFoodRecord[] {
  if (insight.data?.records?.length) return insight.data.records;
  if (insight.data?.food) return [insight.data.food];
  const listed = [
    ...(insight.data?.withIngredient?.foods || []),
    ...(insight.data?.withoutIngredient?.foods || []),
  ];
  const seen = new Set<string>();
  const foods: InsightFoodRecord[] = [];
  for (const food of listed) {
    const key = `${food.name}|${food.isCurrent ? '1' : '0'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    foods.push({
      name: food.name,
      isCurrent: food.isCurrent,
      imageUrl: food.imageUrl,
      avgStool: null,
      itchDays: 0,
      vomitDays: 0,
    });
  }
  return foods;
}

function sourceTitle(source: string): string {
  return source.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function speciesLabel(petType?: string): string {
  if (!petType) return '';
  const key = petType.toLowerCase();
  if (key === 'dog') return 'Dog';
  if (key === 'cat') return 'Cat';
  return petType.charAt(0).toUpperCase() + petType.slice(1);
}

function reportDate(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function statCell(label: string, value: string): string {
  return `<div class="stat"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div></div>`;
}

function foodCard(food: InsightFoodRecord, petType?: string): string {
  const meta = [formatDietTags(food.dietTags), formatLifeStage(food.lifeStage, petType)].filter(Boolean).join(' · ');
  const ingredients = (food.ingredients || '').replace(/\s+/g, ' ').trim();
  const stool = stoolWords(food.avgStool);
  return `
    <article class="food">
      <h3>${esc(toTitleCase(food.name))}${food.isCurrent ? '<span class="current">Current</span>' : ''}</h3>
      ${meta ? `<p class="quiet">${esc(meta)}</p>` : ''}
      <p class="quiet">${esc(periodLine(food))}</p>
      <div class="stats">
        ${statCell('Stool', stool ? `Usually ${stool}` : 'No data')}
        ${statCell('Itching', dayCount(food.itchDays))}
        ${statCell('Vomiting', dayCount(food.vomitDays))}
      </div>
      ${ingredients ? `<p class="ingredients">Ingredients: ${esc(ingredients)}</p>` : ''}
    </article>`;
}

function watchingBlock(insight: InsightData): string {
  const sources = insight.data?.topSources || [];
  if (!sources.length) return '';
  const rows = sources.map(s => `
    <div class="watch">
      <div class="bar"></div>
      <div>
        <span class="pill">${esc(s.category.toUpperCase())}</span>
        <div class="watch-name">${esc(sourceTitle(s.source))}</div>
        <div class="watch-cap">Largest ${esc(s.category.toLowerCase())} by weight</div>
      </div>
    </div>`).join('');
  return `<section class="section"><h2>Worth watching</h2>${rows}</section>`;
}

function groupBlock(title: string, group?: { foods: { name: string }[]; avgStoolScore: number | null; avgItchRate: number; avgVomitRate: number }): string {
  if (!group) return '';
  const stool = stoolWords(group.avgStoolScore);
  const names = group.foods.map(f => toTitleCase(f.name)).join(', ');
  return `
    <div class="group">
      <h3>${esc(title)}</h3>
      ${names ? `<p class="quiet">${esc(names)}</p>` : ''}
      <div class="stats">
        ${statCell('Stool', stool ? `Usually ${stool}` : 'No data')}
        ${statCell('Itching', `${group.avgItchRate}% of days`)}
        ${statCell('Vomiting', `${group.avgVomitRate}% of days`)}
      </div>
    </div>`;
}

function comparisonBlock(insight: InsightData): string {
  const withGroup = insight.data?.withIngredient;
  const withoutGroup = insight.data?.withoutIngredient;
  if (!withGroup || !withoutGroup) return '';
  const label = insight.label || 'these ingredients';
  return `
    <section class="section">
      <h2>Compared</h2>
      <div class="compare">
        ${groupBlock(`Foods with ${label}`, withGroup)}
        ${groupBlock(`Foods without ${label}`, withoutGroup)}
      </div>
    </section>`;
}

function buildPdfHtml(insight: InsightData, petName?: string, petType?: string): string {
  const records = foodsForPdf(insight);
  const who = [petName || 'Your pet', speciesLabel(petType), reportDate()].filter(Boolean).join(' · ');
  const foodsTitle = records.length > 1 ? 'Foods in this record' : 'During this food';
  const cards = records.map(food => foodCard(food, petType)).join('');

  return `
    <html><head><meta charset="utf-8"><style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1B2B27; margin: 0; padding: 32px; background: #ffffff; }
      .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: #2D6A4F; margin: 0 0 6px; }
      h1 { font-size: 22px; line-height: 1.25; margin: 0; font-weight: 700; }
      h2 { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #5C6B66; margin: 0 0 8px; font-weight: 700; }
      h3 { font-size: 16px; margin: 0; font-weight: 700; }
      p { margin: 0; }
      .who { color: #5C6B66; font-size: 13px; margin-top: 6px; }
      .finding { margin-top: 20px; padding: 14px 16px; background: #F5F3EF; box-shadow: inset 0 0 0 999px #F5F3EF; border-radius: 12px; font-size: 15px; line-height: 1.45; }
      .section { margin-top: 22px; }
      .watch { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid #E8E4DD; }
      .bar { width: 0; border-left: 4px solid #E76F51; border-radius: 2px; }
      .pill { display: inline-block; font-size: 10px; letter-spacing: 0.06em; background: #F5F3EF; box-shadow: inset 0 0 0 999px #F5F3EF; color: #5C6B66; padding: 2px 8px; border-radius: 99px; font-weight: 700; }
      .watch-name { font-size: 16px; font-weight: 700; margin-top: 4px; }
      .watch-cap { font-size: 12px; color: #5C6B66; margin-top: 2px; }
      .compare { display: flex; gap: 10px; }
      .group, .food { border: 1px solid #E8E4DD; border-radius: 12px; padding: 12px; }
      .group { flex: 1; }
      .food { margin-top: 10px; }
      .current { display: inline-block; margin-left: 8px; background: #2D6A4F; box-shadow: inset 0 0 0 999px #2D6A4F; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; vertical-align: middle; }
      .quiet { color: #5C6B66; font-size: 12px; margin-top: 4px; }
      .stats { display: flex; gap: 8px; margin-top: 12px; }
      .stat { flex: 1; background: #F5F3EF; box-shadow: inset 0 0 0 999px #F5F3EF; border-radius: 10px; padding: 10px; }
      .k { font-size: 11px; color: #5C6B66; }
      .v { font-size: 14px; font-weight: 700; margin-top: 2px; }
      .ingredients { margin-top: 10px; font-size: 11px; line-height: 1.45; color: #5C6B66; }
      .disclaimer { margin-top: 22px; padding: 12px 14px; background: #FFF6E8; box-shadow: inset 0 0 0 999px #FFF6E8; border-radius: 10px; font-size: 12px; line-height: 1.45; color: #5C6B66; }
    </style></head><body>
      <p class="brand">PHD Plus</p>
      <h1>Food summary for your veterinarian</h1>
      <p class="who">${esc(who)}</p>
      ${insight.summary ? `<div class="finding">${esc(insight.summary)}</div>` : ''}
      ${watchingBlock(insight)}
      ${comparisonBlock(insight)}
      ${cards ? `<section class="section"><h2>${esc(foodsTitle)}</h2>${cards}</section>` : ''}
      <div class="disclaimer">${esc(insight.disclaimer || 'These are correlations, not proof of causation. Please consult your veterinarian.')}</div>
    </body></html>`;
}

function FoodLine({
  name,
  isCurrent,
  imageUrl,
  onZoom,
}: {
  name: string;
  isCurrent?: boolean;
  imageUrl?: string | null;
  onZoom: (uri: string) => void;
}) {
  const thumb = buildThumbUrl(imageUrl);
  const full = buildImageUrl(imageUrl);
  return (
    <View style={styles.foodRow}>
      {thumb ? (
        <Pressable onPress={() => full && onZoom(full)} accessibilityRole="button" accessibilityLabel="View product image">
          <Image source={{ uri: thumb }} style={styles.foodThumb} />
        </Pressable>
      ) : (
        <View style={[styles.foodThumb, styles.altImageFallback]}>
          <Ionicons name="nutrition-outline" size={18} color={colors.textSecondary} />
        </View>
      )}
      <Text style={[typography.bodySmall, styles.foodName]} numberOfLines={2}>{toTitleCase(name)}</Text>
      {isCurrent ? (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function InsightDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insight: InsightData = route.params?.insight;
  const petName: string | undefined = route.params?.petName;
  const petType: string | undefined = route.params?.petType;
  const petId: string | undefined = route.params?.petId || route.params?.insight?.petId;
  const [generating, setGenerating] = useState(false);
  const [alternatives, setAlternatives] = useState<InsightAlternative[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const suspectSources = insight?.singleFood
    ? (insight.data?.suspectSources || [])
    : insight?.ingredient?.split(',').filter(Boolean) || [];

  useEffect(() => {
    if (!petId || suspectSources.length === 0) return;
    setAltLoading(true);
    passportService.getInsightAlternatives(petId, suspectSources)
      .then(res => setAlternatives(res.alternatives))
      .catch(() => {})
      .finally(() => setAltLoading(false));
  }, [petId, insight?.ingredient]);

  const handleDownloadPdf = async () => {
    if (!Print || !insight.data) return;
    setGenerating(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildPdfHtml(insight, petName, petType) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share insight report' });
    } catch (e: any) {
      Alert.alert('Error', 'Could not generate the PDF. Please try again.');
    }
    setGenerating(false);
  };

  const handleAltPress = useCallback((alt: InsightAlternative) => {
    (navigation as any).push('Result', { productId: alt.id });
  }, [navigation]);

  if (!insight || !insight.data) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }, styles.center]}>
        <Text>No insight data</Text>
      </View>
    );
  }

  const isSingleFood = !!insight.singleFood;
  const sFood = insight.data.food;
  const topSources = insight.data.topSources || [];

  function StoolWord(score: number | null): string {
    if (score == null) return 'No data';
    if (score >= 4.5) return 'Excellent';
    if (score >= 3.5) return 'Good';
    if (score >= 2.5) return 'Okay';
    if (score >= 1.5) return 'Poor';
    return 'Bad';
  }

  const altLabel = insight.label || suspectSources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

  const sourceName = (source: string) =>
    source.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const watchingFooter = (sources: { category: string }[]) => {
    const labels = sources.map(s => s.category.toLowerCase());
    if (labels.length === 0) return '';
    if (labels.length === 1) return `This is the heaviest ${labels[0]} in this food.`;
    const last = labels[labels.length - 1];
    return `These are the heaviest ${labels.slice(0, -1).join(', ')}, and ${last} in this food.`;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Insight Detail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {/* Title */}
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 48 }}>💡</Text>
          <Text style={[typography.displaySmall, { color: colors.textPrimary, textAlign: 'center' }]}>
            {insight.label}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
            {insight.summary}
          </Text>
        </View>

        {isSingleFood && sFood ? (
          <>
            {/* Health stats */}
            <View style={styles.comparisonCard}>
              <FoodLine
                name={sFood.name}
                isCurrent={sFood.isCurrent}
                imageUrl={sFood.imageUrl}
                onZoom={setZoomUri}
              />
              <View style={styles.healthStats}>
                <View style={styles.healthStat}>
                  <Text style={{ fontSize: 22 }}>🙂</Text>
                  <Text style={styles.healthStatValue}>Usually {StoolWord(sFood.avgStool)}</Text>
                  <Text style={styles.statLabel}>Stool</Text>
                </View>
                <View style={styles.healthStat}>
                  <Text style={{ fontSize: 22 }}>🐾</Text>
                  <Text style={styles.healthStatValue}>{sFood.itchDays > 0 ? `${sFood.itchDays} of ${calendarDaysOnFood(sFood.startedAt, sFood.endedAt, sFood.isCurrent)} days` : 'None'}</Text>
                  <Text style={styles.statLabel}>Itching</Text>
                </View>
                <View style={styles.healthStat}>
                  <Text style={{ fontSize: 22 }}>{sFood.vomitDays > 0 ? '🤮' : '✨'}</Text>
                  <Text style={styles.healthStatValue}>{sFood.vomitDays > 0 ? `${sFood.vomitDays} of ${calendarDaysOnFood(sFood.startedAt, sFood.endedAt, sFood.isCurrent)} days` : 'None'}</Text>
                  <Text style={styles.statLabel}>Vomiting</Text>
                </View>
              </View>
            </View>

            {topSources.length > 0 && (
              <View style={styles.comparisonCard}>
                <Text style={styles.watchTitle}>
                  {insight.data.hasSymptom ? 'Worth watching' : 'Main ingredients'}
                </Text>
                {topSources.map((s, i) => (
                  <View key={`${s.source}-${i}`}>
                    {i > 0 ? <View style={styles.watchDivider} /> : null}
                    <View style={styles.watchRow}>
                      <View style={styles.watchBar} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={styles.watchPill}>
                          <Text style={styles.watchPillText}>{s.category.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.watchName}>{sourceName(s.source)}</Text>
                        <Text style={styles.watchCaption}>Largest {s.category.toLowerCase()} by weight</Text>
                      </View>
                    </View>
                  </View>
                ))}
                <Text style={styles.watchFooter}>{watchingFooter(topSources)}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Multi-food: With ingredient */}
            {insight.data.withIngredient && (
              <View style={styles.comparisonCard}>
                <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                  Foods with {insight.label}
                </Text>
                <View style={styles.comparisonFoods}>
                  {insight.data.withIngredient.foods.map((f, i) => (
                    <FoodLine key={i} name={f.name} isCurrent={f.isCurrent} imageUrl={f.imageUrl} onZoom={setZoomUri} />
                  ))}
                </View>
                <View style={styles.comparisonStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withIngredient.avgStoolScore}</Text>
                    <Text style={styles.statLabel}>Avg Stool</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withIngredient.avgItchRate}%</Text>
                    <Text style={styles.statLabel}>Itch Rate</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withIngredient.avgVomitRate}%</Text>
                    <Text style={styles.statLabel}>Vomit Rate</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Multi-food: Without ingredient */}
            {insight.data.withoutIngredient && (
              <View style={styles.comparisonCard}>
                <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                  Foods without {insight.label}
                </Text>
                <View style={styles.comparisonFoods}>
                  {insight.data.withoutIngredient.foods.map((f, i) => (
                    <FoodLine key={i} name={f.name} isCurrent={f.isCurrent} imageUrl={f.imageUrl} onZoom={setZoomUri} />
                  ))}
                </View>
                <View style={styles.comparisonStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withoutIngredient.avgStoolScore}</Text>
                    <Text style={styles.statLabel}>Avg Stool</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withoutIngredient.avgItchRate}%</Text>
                    <Text style={styles.statLabel}>Itch Rate</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{insight.data.withoutIngredient.avgVomitRate}%</Text>
                    <Text style={styles.statLabel}>Vomit Rate</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* Alternatives without suspect ingredient */}
        {suspectSources.length > 0 && (
          <View style={styles.comparisonCard}>
            <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
              Alternatives
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Without {altLabel}
            </Text>
            {altLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : alternatives.length === 0 ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                No alternatives found in our database yet.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {alternatives.map(alt => {
                  const thumb = buildThumbUrl(alt.image_url);
                  const brand = toTitleCase(alt.brand);
                  const manufacturer = toTitleCase(alt.manufacturer);
                  const maker = manufacturer && manufacturer.toLowerCase() !== brand.toLowerCase() ? manufacturer : '';
                  const meta = [formatLifeStage(alt.life_stage, petType), brand, maker].filter(Boolean).join(' · ');
                  return (
                    <Pressable key={alt.id} style={styles.altRow} onPress={() => handleAltPress(alt)}>
                      {thumb ? (
                        <Pressable onPress={() => setZoomUri(buildImageUrl(alt.image_url))}>
                          <Image source={{ uri: thumb }} style={styles.altImage} />
                        </Pressable>
                      ) : (
                        <View style={[styles.altImage, styles.altImageFallback]}>
                          <Ionicons name="nutrition-outline" size={22} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.labelMedium, { color: colors.textPrimary }]} numberOfLines={2}>
                          {toTitleCase(alt.name)}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={2}>
                          {meta}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Ionicons name="warning-outline" size={20} color={colors.accent} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
            {insight.disclaimer}
          </Text>
        </View>

        {/* Download for vet */}
        {Print && (
          <Pressable
            onPress={handleDownloadPdf}
            disabled={generating}
            style={[styles.downloadBtn, generating && { opacity: 0.6 }]}
          >
            {generating ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={colors.white} />
                <Text style={styles.downloadBtnText}>Download for your vet</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
      <ZoomableImageModal uri={zoomUri} visible={!!zoomUri} onClose={() => setZoomUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  comparisonCard: {
    backgroundColor: colors.white,
    borderRadius: radius.large,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  comparisonFoods: {
    gap: spacing.xs,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  foodThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
  },
  foodName: {
    color: colors.textSecondary,
    flex: 1,
  },
  currentBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  currentBadgeText: {
    ...typography.labelSmall,
    fontWeight: '700',
    color: colors.white,
  },
  comparisonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  healthStats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  healthStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  healthStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  watchTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  watchBar: {
    width: 6,
    alignSelf: 'stretch',
    borderRadius: 3,
    backgroundColor: colors.danger,
    minHeight: 52,
  },
  watchPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lightGray,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  watchPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  watchName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  watchCaption: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  watchDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  watchFooter: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accent + '14',
    borderRadius: radius.medium,
    padding: spacing.md,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.medium,
  },
  downloadBtnText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
  },
  altImage: {
    width: 56,
    height: 56,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
  },
  altImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.divider,
  },
});
