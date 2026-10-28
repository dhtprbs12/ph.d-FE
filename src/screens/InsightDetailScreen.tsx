import React, { useState } from 'react';
import {
  View,
  Text,
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
import type { InsightData } from '../services/passportService';

let Print: any = null;
try { Print = require('expo-print'); } catch {}

function buildPdfHtml(insight: InsightData): string {
  const w = insight.data!.withIngredient;
  const wo = insight.data!.withoutIngredient;
  const foodList = (foods: { name: string }[]) => foods.map(f => `<li>${f.name}</li>`).join('');
  return `
    <html><head><meta charset="utf-8"><style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; color: #555; margin-top: 24px; }
      .summary { font-size: 14px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px; }
      th { background: #f5f5f5; }
      .disclaimer { margin-top: 24px; padding: 12px; background: #FFF8E1; border-radius: 8px; font-size: 12px; color: #666; }
      .date { font-size: 12px; color: #999; }
    </style></head><body>
      <h1>🐾 Insight: ${insight.label}</h1>
      <p class="date">Generated ${new Date().toLocaleDateString()}</p>
      <p class="summary">${insight.summary}</p>

      <h2>Foods with ${insight.label}</h2>
      <ul>${foodList(w.foods)}</ul>
      <table><tr><th>Avg Stool</th><th>Itch Rate</th><th>Vomit Rate</th></tr>
      <tr><td>${w.avgStoolScore}</td><td>${w.avgItchRate}%</td><td>${w.avgVomitRate}%</td></tr></table>

      <h2>Foods without ${insight.label}</h2>
      <ul>${foodList(wo.foods)}</ul>
      <table><tr><th>Avg Stool</th><th>Itch Rate</th><th>Vomit Rate</th></tr>
      <tr><td>${wo.avgStoolScore}</td><td>${wo.avgItchRate}%</td><td>${wo.avgVomitRate}%</td></tr></table>

      <div class="disclaimer">⚠️ ${insight.disclaimer}</div>
    </body></html>`;
}

export default function InsightDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insight: InsightData = route.params?.insight;
  const [generating, setGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    if (!Print || !insight.data) return;
    setGenerating(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildPdfHtml(insight) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share insight report' });
    } catch (e: any) {
      Alert.alert('Error', 'Could not generate the PDF. Please try again.');
    }
    setGenerating(false);
  };

  if (!insight || !insight.data) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }, styles.center]}>
        <Text>No insight data</Text>
      </View>
    );
  }

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

        {/* With ingredient */}
        <View style={styles.comparisonCard}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
            Foods with {insight.label}
          </Text>
          <View style={styles.comparisonFoods}>
            {insight.data.withIngredient.foods.map((f, i) => (
              <View key={i} style={styles.foodRow}>
                <Text style={[typography.bodySmall, styles.foodName]}>• {f.name}</Text>
                {f.isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                ) : null}
              </View>
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

        {/* Without ingredient */}
        <View style={styles.comparisonCard}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
            Foods without {insight.label}
          </Text>
          <View style={styles.comparisonFoods}>
            {insight.data.withoutIngredient.foods.map((f, i) => (
              <View key={i} style={styles.foodRow}>
                <Text style={[typography.bodySmall, styles.foodName]}>• {f.name}</Text>
                {f.isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                ) : null}
              </View>
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
});
