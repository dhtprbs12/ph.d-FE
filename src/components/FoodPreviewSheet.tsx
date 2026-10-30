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
};

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

            <View style={{ alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.sm }}>
              <Fact label="Brand" value={food.brand} />
              <Fact label="Manufacturer" value={food.manufacturer} />
              <Fact label="Life stage" value={lifeStage} />
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
