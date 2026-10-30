import React, { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { buildImageUrl, buildThumbUrl, formatLifeStage, toTitleCase } from '../utils/helpers';
import ZoomableImageModal from './ZoomableImageModal';

export type FoodPreview = {
  productName: string;
  brand?: string | null;
  manufacturer?: string | null;
  lifeStage?: string | null;
  imageUrl?: string | null;
  dietTags?: string | null;
  productType?: string | null;
  primaryProteins?: string | null;
};

function dietPills(tags?: string | null): string[] {
  if (!tags) return [];
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
  return parts;
}

function formatForm(productType?: string | null): string {
  const key = (productType || '').toLowerCase();
  if (key === 'dry_food' || key === 'dry') return 'Dry';
  if (key === 'wet_food' || key === 'wet') return 'Wet';
  if (key === 'treats' || key === 'treat') return 'Treats';
  if (key === 'supplement') return 'Supplement';
  return '';
}

function firstProtein(raw?: string | null): string {
  if (!raw) return '';
  const first = String(raw).split(/[,+|]/)[0]?.trim();
  if (!first) return '';
  return toTitleCase(first.replace(/_/g, ' '));
}

export function FoodPreviewSheet({
  visible,
  food,
  switching = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  food: FoodPreview | null;
  switching?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  if (!food) return null;

  const fullImage = buildImageUrl(food.imageUrl);
  const thumb = buildThumbUrl(food.imageUrl) || fullImage;
  const lifeStage = formatLifeStage(food.lifeStage);
  const pills = dietPills(food.dietTags);
  const form = formatForm(food.productType);
  const protein = firstProtein(food.primaryProteins);

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: spacing.lg, alignItems: 'center' }}>
            <Pressable onPress={onClose} hitSlop={12} style={{ alignSelf: 'flex-end' }} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>

            {thumb ? (
              <Pressable onPress={() => fullImage && setZoomUri(fullImage)} accessibilityLabel="Enlarge product photo">
                <Image source={{ uri: thumb }} style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: colors.lightGray }} resizeMode="contain" />
              </Pressable>
            ) : (
              <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: colors.lightGray, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="nutrition-outline" size={36} color={colors.textSecondary} />
              </View>
            )}

            <Text style={[typography.titleLarge, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }]}>
              {toTitleCase(food.productName)}
            </Text>

            {pills.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
                {pills.map(pill => (
                  <View key={pill} style={{ backgroundColor: colors.primary + '14', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={[typography.labelSmall, { color: colors.primary, fontWeight: '700' }]}>{pill}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.sm }}>
              <Fact label="Manufacturer" value={food.manufacturer} />
              <Fact label="Life stage" value={lifeStage} />
              {form ? <Fact label="Form" value={form} /> : null}
              {protein ? <Fact label="Protein" value={protein} /> : null}
            </View>

            {switching ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 }]}>
                This ends the current food and starts a new period. Past logs stay on the previous food.
              </Text>
            ) : null}

            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={{ marginTop: spacing.lg, alignSelf: 'stretch', minHeight: 48, borderRadius: radius.medium, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
            >
              <Text style={[typography.labelLarge, { color: colors.white, fontWeight: '700' }]}>Set as current food</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ZoomableImageModal uri={zoomUri} visible={!!zoomUri} onClose={() => setZoomUri(null)} />
    </>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  const shown = value?.trim() ? toTitleCase(value) : '—';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' }]}>{shown}</Text>
    </View>
  );
}
