import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PetsStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows, getPetTypeIcon } from '../theme';
import type { Pet, HealthCondition } from '../types';
import { formatAge, formatWeight, getConditionLabel } from '../types';
import { useApp } from '../context/AppContext';

type Nav = NativeStackNavigationProp<PetsStackParamList>;

function severityColor(severity: string): string {
  switch (severity) {
    case 'mild': return colors.caution;
    case 'moderate': return colors.warning;
    case 'severe': return colors.danger;
    default: return colors.textSecondary;
  }
}

function StaggeredView({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, delay: index * 80 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, delay: index * 80, damping: 15, stiffness: 100 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ConditionBadge({ condition }: { condition: HealthCondition }) {
  const sColor = severityColor(condition.severity);
  return (
    <View style={[styles.conditionBadge, { backgroundColor: sColor + '1A' }]}>
      <View style={[styles.severityDot, { backgroundColor: sColor }]} />
      <Text style={[typography.labelSmall, { color: colors.textPrimary }]} numberOfLines={1}>
        {getConditionLabel(condition.condition_type)}
      </Text>
    </View>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon as any} size={16} color={colors.primary} />
      <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PetCard({
  pet,
  onEdit,
  onSetPrimary,
}: {
  pet: Pet;
  onEdit: () => void;
  onSetPrimary: () => void;
}) {
  const avatarBg = pet.pet_type === 'dog'
    ? colors.accent + '33'
    : colors.primary + '33';

  return (
    <View style={[styles.card, shadows.card]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
          {pet.photoData ? (
            <Image
              source={{
                uri: pet.photoData.startsWith('data:')
                  ? pet.photoData
                  : pet.photoData.startsWith('file://') || pet.photoData.startsWith('http')
                    ? pet.photoData
                    : `data:image/jpeg;base64,${pet.photoData}`,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={{ fontSize: 30 }}>{getPetTypeIcon(pet.pet_type)}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>{pet.name}</Text>
            {pet.is_primary && (
              <View style={styles.primaryPill}>
                <Text style={{ fontSize: 8, fontWeight: '700', color: colors.white }}>PRIMARY</Text>
              </View>
            )}
          </View>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            {pet.pet_type === 'cat' ? 'Cat' : 'Dog'}
          </Text>
        </View>

        <Pressable onPress={onEdit} hitSlop={8}>
          <Ionicons name="pencil" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.detailsRow}>
        {pet.breed && <DetailItem icon="pricetag" label="Breed" value={pet.breed} />}
        <DetailItem icon="calendar" label="Age" value={formatAge(pet.age_months)} />
        <DetailItem icon="fitness" label="Weight" value={formatWeight(pet.weight_kg)} />
      </View>

      {/* Health Conditions */}
      {(pet.healthConditions ?? []).length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.conditionsSection}>
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Health Conditions</Text>
            <View style={styles.conditionsWrap}>
              {(pet.healthConditions ?? []).map(c => (
                <ConditionBadge key={c.id} condition={c} />
              ))}
            </View>
          </View>
        </>
      )}

      {/* Set as Primary */}
      {!pet.is_primary && (
        <>
          <View style={styles.divider} />
          <Pressable onPress={onSetPrimary} style={({ pressed }) => [styles.setPrimaryBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="star" size={14} color={colors.primary} />
            <Text style={[typography.labelMedium, { color: colors.primary }]}>Set as Primary</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function PetsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { pets, setPrimaryPet } = useApp();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[typography.displayLarge, { color: colors.textPrimary }]}>My Pets</Text>
        <Pressable onPress={() => navigation.navigate('AddPet')} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {pets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="paw-outline" size={80} color={colors.textSecondary + '80'} />
          <Text style={[typography.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>
            No Pets Yet
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Add your first pet to get personalized food analysis
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddPet')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]}
          >
            <Text style={styles.primaryBtnText}>Add Pet</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {pets.map((pet, index) => (
            <StaggeredView key={pet.id} index={index}>
              <PetCard
                pet={pet}
                onEdit={() => navigation.navigate('EditPet', { petId: pet.id })}
                onSetPrimary={() => setPrimaryPet(pet)}
              />
            </StaggeredView>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.md, gap: spacing.md },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  primaryPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  detailsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.lg,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  conditionsSection: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  conditionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  setPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    marginTop: spacing.lg,
    width: 200,
    alignItems: 'center',
    ...shadows.button?.(colors.primary),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
