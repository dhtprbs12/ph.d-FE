import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import type { InsightData } from '../services/passportService';

export default function InsightDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insight: InsightData = route.params?.insight;

  if (!insight) {
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
            {insight.label} Connection
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
            {insight.summary}
          </Text>
        </View>

        {/* With ingredient */}
        <View style={styles.comparisonCard}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
            ✅ With {insight.label}
          </Text>
          <View style={styles.comparisonFoods}>
            {insight.data.withIngredient.foods.map((f, i) => (
              <Text key={i} style={[typography.bodySmall, { color: colors.textSecondary }]}>• {f}</Text>
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
          </View>
        </View>

        {/* Without ingredient */}
        <View style={styles.comparisonCard}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
            ❌ Without {insight.label}
          </Text>
          <View style={styles.comparisonFoods}>
            {insight.data.withoutIngredient.foods.map((f, i) => (
              <Text key={i} style={[typography.bodySmall, { color: colors.textSecondary }]}>• {f}</Text>
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
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Ionicons name="warning-outline" size={20} color={colors.accent} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
            {insight.disclaimer}
          </Text>
        </View>
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
    gap: spacing.xxs,
  },
  comparisonStats: {
    flexDirection: 'row',
    gap: spacing.xl,
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
});
