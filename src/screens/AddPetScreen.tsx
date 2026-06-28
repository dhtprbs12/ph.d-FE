import React, { useState, useRef, useCallback } from 'react';
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePetPhotoPicker } from '../hooks/usePetPhotoPicker';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { CONDITION_TYPES, ACTIVITY_LEVELS, PET_SEX_OPTIONS } from '../types';
import type { PetType, ActivityLevel, PetSex } from '../types';
import { useApp } from '../context/AppContext';

const CATEGORIES_ORDER = ['Allergies', 'Digestive', 'Organ Health', 'Metabolic', 'Physical'];

export default function AddPetScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { addPet, pets } = useApp();

  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState('');
  const [petType, setPetType] = useState<PetType>('dog');
  const [breed, setBreed] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [sex, setSex] = useState<PetSex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());

  const canProceed = currentStep === 0 ? name.trim().length > 0 : true;

  const goNext = () => {
    if (currentStep < 2) setCurrentStep(s => s + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const { pickPhoto } = usePetPhotoPicker({
    currentPhotoUri: photoUri,
    onPhotoSelected: setPhotoUri,
    title: 'Add Pet Photo',
  });

  const toggleCondition = (value: string) => {
    setSelectedConditions(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const savePet = async () => {
    setIsLoading(true);
    try {
      const totalAgeMonths = (parseInt(ageYears || '0') * 12) + parseInt(ageMonths || '0');
      const weightInLbs = parseFloat(weightLbs);
      const weightKg = isNaN(weightInLbs) ? undefined : weightInLbs * 0.453592;

      const healthConditions = Array.from(selectedConditions).map(ct => ({
        id: `${Date.now()}-${ct}`,
        condition_type: ct,
        severity: 'moderate' as const,
        notes: undefined,
      }));

      await addPet({
        id: `local-${Date.now()}`,
        name: name.trim(),
        pet_type: petType,
        breed: breed.trim() || undefined,
        age_months: totalAgeMonths > 0 ? totalAgeMonths : undefined,
        weight_kg: weightKg,
        sex: sex ?? undefined,
        activity_level: activityLevel,
        is_primary: pets.length === 0,
        healthConditions,
        photoData: photoUri ?? undefined,
      });

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add pet');
    } finally {
      setIsLoading(false);
    }
  };

  const avatarBg = petType === 'dog' ? colors.accent + '33' : colors.primary + '33';
  const petEmoji = petType === 'dog' ? '🐕' : '🐱';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[typography.bodyLarge, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Add Pet</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {[0, 1, 2].map(step => (
          <View
            key={step}
            style={[styles.progressCapsule, { backgroundColor: step <= currentStep ? colors.primary : colors.lightGray }]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 0 && (
          <View style={styles.stepContent}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>Let's meet your pet!</Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>Start with the basics</Text>
            </View>

            {/* Photo */}
            <Pressable onPress={pickPhoto} style={{ alignSelf: 'center' }}>
              <View style={[styles.photoCircle, { backgroundColor: avatarBg }]}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImage} />
                ) : (
                  <Text style={{ fontSize: 50 }}>{petEmoji}</Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                Add Photo (Optional)
              </Text>
            </Pressable>

            {/* Pet Type */}
            <View style={styles.fieldGroup}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Pet Type</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {(['dog', 'cat'] as PetType[]).map(type => {
                  const isSelected = petType === type;
                  const typeColor = type === 'dog' ? colors.primary : colors.accent;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setPetType(type)}
                      style={[
                        styles.petTypeBtn,
                        { backgroundColor: isSelected ? typeColor + '26' : colors.lightGray },
                        isSelected && { borderColor: typeColor, borderWidth: 2 },
                      ]}
                    >
                      <Text style={{ fontSize: 40 }}>{type === 'dog' ? '🐕' : '🐱'}</Text>
                      <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                        {type === 'dog' ? 'Dog' : 'Cat'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="What's your pet's name?"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Breed */}
            <View style={styles.fieldGroup}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Breed (Optional)</Text>
              <TextInput
                style={styles.input}
                value={breed}
                onChangeText={setBreed}
                placeholder={petType === 'dog' ? 'e.g., Labrador, Mixed' : 'e.g., Persian, Tabby'}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        )}

        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>Physical Details</Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>This helps us personalize the analysis</Text>
            </View>

            {/* Age */}
            <View style={styles.fieldGroup}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Age</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={ageYears}
                    onChangeText={setAgeYears}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Years</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={ageMonths}
                    onChangeText={setAgeMonths}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Months</Text>
                </View>
              </View>
            </View>

            {/* Weight */}
            <View style={styles.fieldGroup}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                value={weightLbs}
                onChangeText={setWeightLbs}
                placeholder={petType === 'dog' ? 'e.g., 55' : 'e.g., 10'}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
              />
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
          </View>
        )}

        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={[typography.displaySmall, { color: colors.textPrimary }]}>Health Conditions</Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>Select any that apply (optional)</Text>
            </View>

            {selectedConditions.size > 0 && (
              <Text style={[typography.labelMedium, { color: colors.primary }]}>
                Selected: {selectedConditions.size}
              </Text>
            )}

            {CATEGORIES_ORDER.map(category => {
              const conditions = CONDITION_TYPES.filter(c => c.category === category);
              if (conditions.length === 0) return null;
              return (
                <View key={category} style={{ gap: spacing.sm }}>
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
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom buttons */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {currentStep > 0 && (
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={[{ fontSize: 16, fontWeight: '600', color: colors.primary }]}>Back</Text>
            </Pressable>
          )}

          {currentStep < 2 ? (
            <Pressable
              onPress={goNext}
              disabled={!canProceed}
              style={({ pressed }) => [
                styles.nextBtn,
                !canProceed && styles.btnDisabled,
                pressed && canProceed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
              ]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={savePet}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.nextBtn,
                isLoading && styles.btnDisabled,
                pressed && !isLoading && { transform: [{ scale: 0.98 }], opacity: 0.95 },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.nextBtnText}>Add Pet</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
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
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  progressCapsule: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepContent: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    padding: spacing.md,
    fontSize: 17,
    color: colors.textPrimary,
  },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: 100, height: 100, borderRadius: 50 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.large,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
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
  segmentActive: {
    backgroundColor: colors.primary,
  },
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
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: radius.medium,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '4D',
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
    ...shadows.button?.(colors.primary),
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  btnDisabled: {
    backgroundColor: colors.textSecondary + '66',
    shadowOpacity: 0,
    elevation: 0,
  },
});
