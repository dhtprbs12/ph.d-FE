import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, Platform, Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as authService from '../services/authService';
import { usePetPhotoPicker } from '../hooks/usePetPhotoPicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { uploadImage } from '../services/api';
import { savePetsLocally } from '../utils/storage';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography } from '../theme';
import { CONDITION_TYPES, PET_SEX_OPTIONS } from '../types';
import type { PetSex } from '../types';
import type { RootStackParamList } from '../navigation/types';

const CATEGORIES_ORDER = ['Allergies', 'Digestive', 'Organ Health', 'Metabolic', 'Physical'];

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { authenticateAndSync } = useApp();
  const [step, setStep] = useState(0);

  const [nickname, setNickname] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameReason, setNicknameReason] = useState('');
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<'dog' | 'cat'>('dog');
  const [breed, setBreed] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [ageMonthsVal, setAgeMonthsVal] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [sex, setSex] = useState<PetSex>('male');
  const [activityLevel, setActivityLevel] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());

  const toggleCondition = useCallback((value: string) => {
    setSelectedConditions(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!nickname || nickname.length < 2) {
      setNicknameAvailable(null);
      setNicknameReason('');
      setNicknameChecking(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setNicknameAvailable(false);
      setNicknameReason('Only letters, numbers, and underscores');
      setNicknameChecking(false);
      return;
    }

    setNicknameChecking(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await authService.checkNickname(nickname);
        setNicknameAvailable(result.available);
        setNicknameReason(result.reason || '');
      } catch {
        setNicknameAvailable(null);
      } finally {
        setNicknameChecking(false);
      }
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nickname]);

  const pinValid = pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin);
  const pinMatch = pin === pinConfirm;
  const step1Ready = nicknameAvailable === true && pinValid && pinMatch;
  const step2Ready = petName.trim().length > 0;

  const { pickPhoto } = usePetPhotoPicker({
    currentPhotoUri: photoUri,
    onPhotoSelected: setPhotoUri,
    title: 'Add Pet Photo',
  });

  const handleRegister = async () => {
    if (!step2Ready) return;
    setLoading(true);
    try {
      const { token, user } = await authService.registerWithNickname(nickname, pin);
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userNickname', nickname.trim());

      const totalAgeMonths = (parseInt(ageYears || '0') * 12) + parseInt(ageMonthsVal || '0');
      const lbs = parseFloat(weightLbs);
      const weightKg = isNaN(lbs) ? null : +(lbs * 0.453592).toFixed(2);

      const healthConditions = Array.from(selectedConditions).map(ct => ({
        type: ct,
        severity: 'moderate',
      }));

      const { data: petData } = await api.post('/pets', {
        name: petName.trim(),
        petType,
        breed: breed.trim() || null,
        ageMonths: totalAgeMonths > 0 ? totalAgeMonths : null,
        weightKg,
        sex,
        activityLevel,
        healthConditions: healthConditions.length > 0 ? healthConditions : undefined,
      });

      const createdPet = petData.pet;

      if (photoUri && createdPet?.id) {
        try {
          const photoRes = await uploadImage<{ photo_url: string }>(`/pets/${createdPet.id}/photo`, photoUri, undefined, 'photo');
          createdPet.photo_url = photoRes.photo_url;
        } catch (e) {
          console.warn('Pet photo upload failed:', e);
        }
      }

      await savePetsLocally([{ ...createdPet, photoData: photoUri ?? undefined }]);
      await authenticateAndSync();

      navigation.reset({ index: 0, routes: [{ name: 'Disclaimer' }] });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <View key="step-auth" style={styles.form}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Choose your ID and PIN to get started</Text>

            <Text style={styles.label}>ID</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. puppy_lover_42"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            {nicknameChecking && <ActivityIndicator size="small" style={styles.helperLoader} color={colors.primary} />}
            {!nicknameChecking && nicknameAvailable === true && (
              <Text style={styles.helperSuccess}>This ID is available</Text>
            )}
            {!nicknameChecking && nicknameAvailable === false && (
              <Text style={styles.helperError}>{nicknameReason || 'This ID is already taken'}</Text>
            )}

            <Text style={styles.label}>PIN (4-6 digits)</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />

            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              style={styles.input}
              value={pinConfirm}
              onChangeText={setPinConfirm}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            {pinConfirm.length > 0 && !pinMatch && <Text style={styles.hint}>PINs do not match</Text>}

            <TouchableOpacity
              style={[styles.button, !step1Ready && styles.buttonDisabled]}
              onPress={() => setStep(1)}
              disabled={!step1Ready}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View key="step-pet" style={styles.form}>
            <Text style={styles.title}>Your Pet</Text>
            <Text style={styles.subtitle}>Tell us about your first pet</Text>

            <Pressable onPress={pickPhoto} style={styles.photoWrapper}>
              <View style={[styles.photoCircle, { backgroundColor: petType === 'dog' ? colors.accent + '33' : colors.primary + '33' }]}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImage} />
                ) : (
                  <Text style={{ fontSize: 44 }}>{petType === 'dog' ? '🐕' : '🐱'}</Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
              <Text style={styles.photoHint}>Add Photo (Optional)</Text>
            </Pressable>

            <Text style={styles.label}>Pet Name *</Text>
            <TextInput
              style={styles.input}
              value={petName}
              onChangeText={setPetName}
              placeholder="What's your pet's name?"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.petTypeBtn, petType === 'dog' && styles.petTypeBtnActive]} onPress={() => setPetType('dog')}>
                <Text style={{ fontSize: 28 }}>🐕</Text>
                <Text style={[styles.chipText, petType === 'dog' && styles.chipTextActive]}>Dog</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.petTypeBtn, petType === 'cat' && styles.petTypeBtnActive]} onPress={() => setPetType('cat')}>
                <Text style={{ fontSize: 28 }}>🐱</Text>
                <Text style={[styles.chipText, petType === 'cat' && styles.chipTextActive]}>Cat</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Breed (Optional)</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder={petType === 'dog' ? 'e.g. Labrador, Mixed' : 'e.g. Persian, Tabby'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Age</Text>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <TextInput
                  style={styles.input}
                  value={ageYears}
                  onChangeText={setAgeYears}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.fieldUnit}>Years</Text>
              </View>
              <View style={styles.flex1}>
                <TextInput
                  style={styles.input}
                  value={ageMonthsVal}
                  onChangeText={setAgeMonthsVal}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.fieldUnit}>Months</Text>
              </View>
            </View>

            <Text style={styles.label}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={weightLbs}
              onChangeText={setWeightLbs}
              keyboardType="decimal-pad"
              placeholder={petType === 'dog' ? 'e.g. 55' : 'e.g. 10'}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Sex</Text>
            <View style={styles.row}>
              {PET_SEX_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.value} style={[styles.chip, sex === opt.value && styles.chipActive]} onPress={() => setSex(opt.value)}>
                  <Text style={[styles.chipText, sex === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Activity Level</Text>
            <View style={styles.segmentedRow}>
              {(['low', 'moderate', 'high'] as const).map((a) => (
                <TouchableOpacity key={a} style={[styles.segment, activityLevel === a && styles.segmentActive]} onPress={() => setActivityLevel(a)}>
                  <Text style={[styles.segmentText, activityLevel === a && styles.segmentTextActive]}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.conditionSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.label}>Health Conditions (Optional)</Text>
                {selectedConditions.size > 0 && (
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                    {selectedConditions.size} selected
                  </Text>
                )}
              </View>
              {CATEGORIES_ORDER.map(category => {
                const conditions = CONDITION_TYPES.filter(c => c.category === category);
                if (conditions.length === 0) return null;
                return (
                  <View key={category} style={{ gap: 6, marginTop: spacing.sm }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{category}</Text>
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
                            <Text style={{ fontSize: 12, color: isSelected ? colors.white : colors.textPrimary }}>
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

            <View style={[styles.row, { marginTop: spacing.lg }]}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.flex1, (!step2Ready || loading) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={!step2Ready || loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  form: { width: '100%' },
  title: { ...typography.displayLarge, color: colors.textPrimary, marginBottom: spacing.xxs },
  subtitle: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: spacing.lg },
  label: { ...typography.labelLarge, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xxs + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    padding: 14,
    ...typography.bodyLarge,
    backgroundColor: colors.card,
    color: colors.textPrimary,
  },
  helperLoader: { marginTop: spacing.xxs, alignSelf: 'flex-start' },
  helperSuccess: { ...typography.labelSmall, color: colors.safe, marginTop: spacing.xxs },
  helperError: { ...typography.labelSmall, color: colors.danger, marginTop: spacing.xxs },
  hint: { ...typography.labelSmall, color: colors.danger, marginTop: spacing.xxs },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { backgroundColor: colors.divider },
  buttonText: { color: colors.white, ...typography.titleMedium },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.primary, ...typography.bodySmall },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  fieldUnit: { ...typography.labelSmall, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  petTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.large,
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.divider,
    backgroundColor: colors.card,
  },
  petTypeBtnActive: { backgroundColor: colors.primary + '1A', borderColor: colors.primary },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.labelMedium, color: colors.textPrimary },
  segmentTextActive: { color: colors.white },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.lightGray,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  photoWrapper: { alignSelf: 'center', alignItems: 'center', marginBottom: spacing.md },
  photoCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: 100, height: 100, borderRadius: 50 },
  cameraBadge: { position: 'absolute', right: -2, bottom: 24, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  photoHint: { ...typography.labelSmall, color: colors.textSecondary, marginTop: spacing.xs },
  backBtn: { paddingHorizontal: 20, paddingVertical: spacing.md, marginTop: spacing.lg },
  backBtnText: { color: colors.primary, ...typography.titleMedium },
  flex1: { flex: 1 },
  conditionSection: { marginTop: spacing.md },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});
