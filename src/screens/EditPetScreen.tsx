import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePetPhotoPicker } from '../hooks/usePetPhotoPicker';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { ACTIVITY_LEVELS, PET_SEX_OPTIONS, CONDITION_TYPES } from '../types';
import type { PetSex, ActivityLevel } from '../types';

const CATEGORIES_ORDER = ['Allergies', 'Digestive', 'Organ Health', 'Metabolic', 'Physical'];
import type { PetsStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';

export default function EditPetScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PetsStackParamList, 'EditPet'>>();
  const { pets, updatePet, deletePet } = useApp();

  const pet = pets.find(p => p.id === route.params.petId);

  const totalMonths = pet?.age_months ?? 0;
  const [name, setName] = useState(pet?.name ?? '');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [ageYears, setAgeYears] = useState(String(Math.floor(totalMonths / 12)));
  const [ageMonthsVal, setAgeMonthsVal] = useState(String(totalMonths % 12));
  const [weightLbs, setWeightLbs] = useState(
    pet?.weight_kg ? (pet.weight_kg / 0.453592).toFixed(1) : '',
  );
  const [sex, setSex] = useState<PetSex | undefined>(pet?.sex);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(pet?.activity_level ?? 'moderate');
  const [photoUri, setPhotoUri] = useState<string | null | undefined>(pet?.photoData);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(
    () => new Set((pet?.healthConditions ?? []).map(c => c.condition_type)),
  );
  const [isLoading, setIsLoading] = useState(false);

  const { pickPhoto } = usePetPhotoPicker({
    currentPhotoUri: photoUri ?? null,
    onPhotoSelected: setPhotoUri,
    title: 'Edit Pet Photo',
  });

  const toggleCondition = useCallback((val: string) => {
    setSelectedConditions(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  }, []);

  if (!pet) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>Pet not found</Text>
      </View>
    );
  }

  const petType = pet.pet_type;
  const avatarBg = petType === 'dog' ? colors.accent + '33' : colors.primary + '33';
  const petEmoji = petType === 'dog' ? '🐕' : '🐱';

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const totalAge = (parseInt(ageYears || '0') * 12) + parseInt(ageMonthsVal || '0');
      const weightInLbs = parseFloat(weightLbs);
      const weightKg = isNaN(weightInLbs) ? undefined : weightInLbs * 0.453592;

      const healthConditions = Array.from(selectedConditions).map(ct => {
        const existing = pet.healthConditions.find(c => c.condition_type === ct);
        return existing ?? { id: `${Date.now()}-${ct}`, condition_type: ct, severity: 'moderate' as const, notes: undefined };
      });

      await updatePet({
        ...pet,
        name: name.trim(),
        breed: breed.trim() || undefined,
        age_months: totalAge > 0 ? totalAge : undefined,
        weight_kg: weightKg,
        sex,
        activity_level: activityLevel,
        healthConditions,
        photoData: photoUri ?? undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pet?',
      `This will delete ${pet.name} and all associated scan history. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePet(pet);
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[typography.bodyLarge, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Edit Pet</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* Photo + Type */}
        <View style={[styles.photoSection, { backgroundColor: colors.lightGray }]}>
          <Pressable onPress={pickPhoto}>
            <View style={[styles.photoCircle, { backgroundColor: avatarBg }]}>
              {photoUri ? (
                <Image
                  source={{
                    uri: photoUri.startsWith('data:') ? photoUri : (photoUri.startsWith('file') || photoUri.startsWith('http')) ? photoUri : `data:image/jpeg;base64,${photoUri}`,
                  }}
                  style={styles.photoImage}
                />
              ) : (
                <Text style={{ fontSize: 40 }}>{petEmoji}</Text>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color={colors.white} />
            </View>
          </Pressable>
          <View>
            <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>
              {petType === 'dog' ? 'Dog' : 'Cat'}
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              Tap photo to change
            </Text>
          </View>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Pet's name" placeholderTextColor={colors.textSecondary} />
        </View>

        {/* Breed */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Breed</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Breed (optional)" placeholderTextColor={colors.textSecondary} />
        </View>

        {/* Age */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Age</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextInput style={styles.input} value={ageYears} onChangeText={setAgeYears} placeholder="0" keyboardType="number-pad" placeholderTextColor={colors.textSecondary} />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Years</Text>
            </View>
            <View style={{ flex: 1 }}>
              <TextInput style={styles.input} value={ageMonthsVal} onChangeText={setAgeMonthsVal} placeholder="0" keyboardType="number-pad" placeholderTextColor={colors.textSecondary} />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Months</Text>
            </View>
          </View>
        </View>

        {/* Weight */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Weight (lbs)</Text>
          <TextInput style={styles.input} value={weightLbs} onChangeText={setWeightLbs} placeholder="Weight" keyboardType="decimal-pad" placeholderTextColor={colors.textSecondary} />
        </View>

        {/* Sex */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Sex</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {PET_SEX_OPTIONS.map(opt => {
              const isSelected = sex === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSex(opt.value)}
                  style={[
                    styles.sexBtn,
                    { backgroundColor: isSelected ? colors.primary + '26' : colors.lightGray },
                    isSelected && { borderColor: colors.primary, borderWidth: 1 },
                  ]}
                >
                  <Text style={[typography.labelMedium, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Activity Level */}
        <View style={styles.fieldGroup}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Activity Level</Text>
          <View style={styles.segmentedControl}>
            {ACTIVITY_LEVELS.map(level => {
              const isActive = activityLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  onPress={() => setActivityLevel(level.value)}
                  style={[styles.segment, isActive && styles.segmentActive]}
                >
                  <Text style={[typography.labelMedium, { color: isActive ? colors.white : colors.textPrimary }]}>
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Health Conditions */}
        <View style={styles.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Health Conditions</Text>
            {selectedConditions.size > 0 && (
              <Text style={[typography.labelSmall, { color: colors.primary }]}>
                {selectedConditions.size} selected
              </Text>
            )}
          </View>
          {CATEGORIES_ORDER.map(category => {
            const conditions = CONDITION_TYPES.filter(c => c.category === category);
            if (conditions.length === 0) return null;
            return (
              <View key={category} style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>{category}</Text>
                <View style={styles.chipsWrap}>
                  {conditions.map(c => {
                    const isSelected = selectedConditions.has(c.value);
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => toggleCondition(c.value)}
                        style={[styles.conditionChip, { backgroundColor: isSelected ? colors.primary : colors.lightGray }]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={10} color={colors.white} />}
                        <Text style={[typography.labelSmall, { color: isSelected ? colors.white : colors.textPrimary }]}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={!name.trim() || isLoading}
          style={({ pressed }) => [
            styles.saveBtn,
            (!name.trim() || isLoading) && styles.btnDisabled,
            pressed && name.trim() && !isLoading && { transform: [{ scale: 0.98 }], opacity: 0.95 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </Pressable>

        {/* Delete */}
        <Pressable onPress={handleDelete} style={{ alignItems: 'center', marginTop: spacing.md }}>
          <Text style={[typography.labelMedium, { color: colors.danger }]}>Delete Pet</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.large,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: 80, height: 80, borderRadius: 40 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: { gap: spacing.xs },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    padding: spacing.md,
    fontSize: 17,
    color: colors.textPrimary,
  },
  sexBtn: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.medium,
  },
  segmentActive: { backgroundColor: colors.primary },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  saveBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
    ...shadows.button?.(colors.primary),
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: colors.white },
  btnDisabled: { backgroundColor: colors.textSecondary + '66', shadowOpacity: 0, elevation: 0 },
});
