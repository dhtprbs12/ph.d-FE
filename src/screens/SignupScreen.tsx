import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, Platform, Pressable,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import FoodSearchInput, { FoodSelection } from '../components/FoodSearchInput';

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
  const [showPin, setShowPin] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<'dog' | 'cat'>('dog');
  const [breed, setBreed] = useState('');
  const [breedDropdownVisible, setBreedDropdownVisible] = useState(false);
  const breedList = petType === 'dog' ? DOG_BREEDS : CAT_BREEDS;
  const filteredBreeds = useMemo(() => {
    const q = breed.trim().toLowerCase();
    if (!q) return [];
    return breedList.filter(b => b.toLowerCase().includes(q)).slice(0, 6);
  }, [breed, breedList]);
  const selectBreed = (b: string) => {
    setBreed(b);
    setBreedDropdownVisible(false);
  };
  const [ageYears, setAgeYears] = useState('');
  const [ageMonthsVal, setAgeMonthsVal] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [sex, setSex] = useState<PetSex>('male');
  const [activityLevel, setActivityLevel] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [currentFoodSelection, setCurrentFoodSelection] = useState<FoodSelection | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLooking, setScanLooking] = useState(false);
  const scanRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const handleBarcodeScan = useCallback(async ({ data }: { data: string }) => {
    if (scanRef.current) return;
    scanRef.current = true;
    setScanLooking(true);
    try {
      const res = await api.get<any>('/scan/barcode-lookup', {
        params: { barcode: data, petType },
      });
      const result = res.data;
      if (result?.product && result.product.name && !result.product.name.toLowerCase().includes('unknown')) {
        setCurrentFoodSelection({
          productId: result.product.id,
          productName: result.product.name,
          brand: result.product.brand || undefined,
        });
        setScannerOpen(false);
      } else {
        setScannerOpen(false);
        Alert.alert('Not Found', 'This product was not found in our database. Try searching by name instead.');
      }
    } catch {
      setScannerOpen(false);
      Alert.alert('Error', 'Failed to look up barcode. Try searching by name instead.');
    } finally {
      setScanLooking(false);
    }
  }, [petType]);

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    scanRef.current = false;
    setScannerOpen(true);
  };

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
  const emailValid = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const step1Ready = nicknameAvailable === true && pinValid && pinMatch && emailValid;
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
      const { token, user } = await authService.registerWithNickname(nickname, pin, email.trim() || undefined);
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

      if (currentFoodSelection?.productName && createdPet?.id) {
        try {
          await api.post(`/pets/${createdPet.id}/current-food`, {
            productId: currentFoodSelection.productId || undefined,
            productName: currentFoodSelection.productName,
            brand: currentFoodSelection.brand || undefined,
          });
        } catch (e) {
          console.warn('Current food registration failed:', e);
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
            <View style={styles.pinRow}>
              <TextInput
                style={[styles.input, styles.pinInput]}
                value={pin}
                onChangeText={setPin}
                placeholder="••••"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm PIN</Text>
            <View style={styles.pinRow}>
              <TextInput
                style={[styles.input, styles.pinInput]}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                placeholder="••••"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {pinConfirm.length > 0 && !pinMatch && <Text style={styles.hint}>PINs do not match</Text>}

            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (t.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.trim())) {
                  setEmailError('Please enter a valid email address');
                } else {
                  setEmailError('');
                }
              }}
              placeholder="e.g. name@email.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Text style={styles.helperHint}>Needed to reset your password if you forget it</Text>
            {emailError.length > 0 && <Text style={styles.helperError}>{emailError}</Text>}

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
        ) : step === 1 ? (
          <View key="step-pet" style={styles.form}>
            <Text style={styles.title}>Your Pet</Text>
            <Text style={styles.subtitle}>Tell us about your first pet</Text>

            <Pressable onPress={pickPhoto} style={styles.photoWrapper}>
              <View style={[styles.photoCircle, { backgroundColor: colors.accent + '33' }]}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImage} />
                ) : (
                  <Text style={{ fontSize: 44 }}>🐕</Text>
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
              <Pressable
                onPress={() => setPetType('dog')}
                style={[styles.petTypeBtn, petType === 'dog' && styles.petTypeBtnActive]}
              >
                <Text style={{ fontSize: 28 }}>🐕</Text>
                <Text style={[styles.chipText, petType === 'dog' && styles.chipTextActive]}>Dog</Text>
              </Pressable>
              <View style={[styles.petTypeBtn, { opacity: 0.45 }]}>
                <Text style={{ fontSize: 28 }}>🐱</Text>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>Cat</Text>
                <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent }}>Coming Soon</Text>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Breed (Optional)</Text>
            <View style={{ zIndex: 10, position: 'relative' }}>
              <TextInput
                style={styles.input}
                value={breed}
                onChangeText={(text) => {
                  setBreed(text);
                  setBreedDropdownVisible(true);
                }}
                onFocus={() => setBreedDropdownVisible(true)}
                onBlur={() => {
                  setTimeout(() => setBreedDropdownVisible(false), 200);
                }}
                placeholder={petType === 'dog' ? 'e.g. Labrador, Mixed' : 'e.g. Persian, Tabby'}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
              {breedDropdownVisible && filteredBreeds.length > 0 && (
                <View style={styles.breedDropdown}>
                  {filteredBreeds.map((b, i) => (
                    <Pressable
                      key={b}
                      onPress={() => selectBreed(b)}
                      style={[
                        styles.breedDropdownItem,
                        i < filteredBreeds.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                      ]}
                    >
                      <Ionicons name="paw-outline" size={14} color={colors.textSecondary} />
                      <Text style={[{ fontSize: 14, color: colors.textPrimary, flex: 1 }]}>{b}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

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
                style={[styles.button, styles.flex1, !step2Ready && styles.buttonDisabled]}
                onPress={() => setStep(2)}
                disabled={!step2Ready}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View key="step-food" style={styles.form}>
            <Text style={styles.title}>Current Food</Text>
            <Text style={styles.subtitle}>What does {petName || 'your pet'} eat? You can always change this later.</Text>

            <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
              <Text style={{ fontSize: 64 }}>🍖</Text>
            </View>

            {currentFoodSelection ? (
              <View style={styles.selectedFood}>
                <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{currentFoodSelection.productName}</Text>
                  {currentFoodSelection.brand && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{currentFoodSelection.brand}</Text>
                  )}
                </View>
                <Pressable onPress={() => setCurrentFoodSelection(null)}>
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <FoodSearchInput
                petType={petType}
                onSelect={(food) => setCurrentFoodSelection(food)}
                placeholder="Search or type food name..."
              />
            )}

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={styles.scanFoodBtn}
              onPress={openScanner}
            >
              <Ionicons name="barcode-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Scan Food Barcode</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Scan the barcode on your pet food bag</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <View style={[styles.row, { marginTop: spacing.lg }]}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.flex1, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : (
                  <Text style={styles.buttonText}>
                    {currentFoodSelection ? 'Create Account' : 'Skip & Create Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={scannerOpen} animationType="slide" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={scanLooking ? undefined : handleBarcodeScan}
          />
          {scanLooking && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={{ color: colors.white, marginTop: 12, fontSize: 16 }}>Looking up product...</Text>
            </View>
          )}
          <Pressable
            onPress={() => setScannerOpen(false)}
            style={{ position: 'absolute', top: 60, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <View style={{ position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '600' }}>Point at the barcode on the food bag</Text>
          </View>
        </View>
      </Modal>
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
  helperHint: { ...typography.labelSmall, color: colors.textSecondary, marginTop: spacing.xxs },
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
  pinRow: { flexDirection: 'row', alignItems: 'center' },
  pinInput: { flex: 1 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 14 },
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
  breedDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  breedDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  orText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scanFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary + '0D',
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  selectedFood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.safe + '15',
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.safe + '33',
  },
});
