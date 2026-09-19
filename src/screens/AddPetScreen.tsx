import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
  Keyboard,
  FlatList,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePetPhotoPicker } from '../hooks/usePetPhotoPicker';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { CONDITION_TYPES, ACTIVITY_LEVELS, PET_SEX_OPTIONS } from '../types';
import type { PetType, ActivityLevel, PetSex } from '../types';
import { useApp } from '../context/AppContext';
import { DOG_BREEDS, CAT_BREEDS } from '../data/breeds';
import api from '../services/api';
import { useToast } from '../components/common/Toast';

const CATEGORIES_ORDER = ['Allergies', 'Digestive', 'Organ Health', 'Metabolic', 'Physical'];

export default function AddPetScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { addPet, pets } = useApp();
  const toast = useToast();

  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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

  const canProceed = currentStep === 0 ? name.trim().length > 0 : true;

  const goNext = () => {
    if (currentStep < 3) setCurrentStep(s => s + 1);
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

  const savePetCore = async () => {
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
  };

  const savePet = async () => {
    console.log('[AddPet] savePet (skip) called');
    setIsLoading(true);
    try {
      await savePetCore();
      navigation.goBack();
    } catch (e: any) {
      toast.show({ message: e.message || 'Failed to add pet', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLooking, setScanLooking] = useState(false);
  const scanRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedFood, setScannedFood] = useState<{ productName: string; productId?: string; brand?: string } | null>(null);

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
        setScannedFood({
          productId: result.product.id,
          productName: result.product.name,
          brand: result.product.brand || undefined,
        });
        setScannerOpen(false);
      } else {
        setScannerOpen(false);
        toast.show({ message: 'Product not found. You can register it from the home screen!', type: 'info' });
      }
    } catch {
      setScannerOpen(false);
      toast.show({ message: 'Product not found. You can register it from the home screen!', type: 'info' });
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

  const savePetWithFood = async () => {
    setIsLoading(true);
    try {
      await savePetCore();
      if (scannedFood) {
        const createdPets = await (await import('../services/api')).default.get('/pets');
        const latestPet = createdPets.data.pets?.[createdPets.data.pets.length - 1];
        if (latestPet?.id) {
          await api.post(`/pets/${latestPet.id}/current-food`, {
            productId: scannedFood.productId || undefined,
            productName: scannedFood.productName,
            brand: scannedFood.brand || undefined,
          });
        }
      }
      navigation.goBack();
    } catch (e: any) {
      toast.show({ message: e.message || 'Failed to add pet', type: 'error' });
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
        {[0, 1, 2, 3].map(step => (
          <View
            key={step}
            style={[styles.progressCapsule, { backgroundColor: step <= currentStep ? colors.primary : colors.lightGray }]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
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
                <Pressable
                  onPress={() => setPetType('dog')}
                  style={[
                    styles.petTypeBtn,
                    petType === 'dog'
                      ? { backgroundColor: colors.primary + '26', borderColor: colors.primary, borderWidth: 2 }
                      : { borderWidth: 2, borderColor: colors.lightGray },
                  ]}
                >
                  <Text style={{ fontSize: 40 }}>🐕</Text>
                  <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>Dog</Text>
                </Pressable>
                <View
                  style={[
                    styles.petTypeBtn,
                    { borderWidth: 2, borderColor: colors.lightGray, opacity: 0.45 },
                  ]}
                >
                  <Text style={{ fontSize: 40 }}>🐱</Text>
                  <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Cat</Text>
                  <View style={{ backgroundColor: colors.accent + '33', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent }}>Coming Soon</Text>
                  </View>
                </View>
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
            <View style={[styles.fieldGroup, { zIndex: 10, position: 'relative' }]}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Breed (Optional)</Text>
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
                placeholder={petType === 'dog' ? 'e.g., Labrador, Mixed' : 'e.g., Persian, Tabby'}
                placeholderTextColor={colors.textSecondary}
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
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{b}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
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

        {currentStep === 3 && (
          <View style={styles.stepContent}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ fontSize: 50 }}>{petEmoji}</Text>
              <Text style={[typography.displaySmall, { color: colors.textPrimary, textAlign: 'center' }]}>
                What does {name || 'your pet'} eat?
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                Scan your pet food to start tracking nutrition
              </Text>
            </View>

            {scannedFood ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.safe + '15', borderRadius: radius.large, borderWidth: 1, borderColor: colors.safe + '33' }}>
                <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{scannedFood.productName}</Text>
                  {scannedFood.brand && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{scannedFood.brand}</Text>}
                </View>
                <Pressable onPress={() => setScannedFood(null)}>
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={openScanner}
                style={({ pressed }) => [styles.foodOptionBtn, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="barcode-outline" size={28} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>Scan Food Barcode</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    If not in our database, you can register it and earn 🦴×20
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom buttons */}
      {!keyboardVisible && (
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

          {currentStep < 3 ? (
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
              onPress={scannedFood ? savePetWithFood : savePet}
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
                <Text style={styles.nextBtnText}>{scannedFood ? 'Add Pet' : 'Skip & Add Pet'}</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
      )}

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
    marginBottom: spacing.sm,
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
  breedDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
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
  foodOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
