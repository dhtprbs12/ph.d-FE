import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import * as scanService from '../services/scanService';
import { getDeviceId } from '../services/authService';
import { useApp } from '../context/AppContext';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { Pet, PollScanResultResponse, ProductCandidate, ScanResult } from '../types';
import { buildImageUrl } from '../utils/helpers';

type ScanStep = 'front' | 'frontCaptured' | 'selectCandidate' | 'back' | 'analyzing';

function extractScanId(data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.scanId === 'string') return d.scanId;
    if (typeof d.scan_id === 'string') return d.scan_id;
  }
  throw new Error('Missing scan id from server');
}

async function pollUntilComplete(
  scanId: string,
  onTick: (stepIndex: number, message?: string) => void
): Promise<ScanResult> {
  const deadline = Date.now() + 60_000;
  let tick = 0;
  while (Date.now() < deadline) {
    const res: PollScanResultResponse = await scanService.pollResult(scanId);
    const status = String(res.status).toLowerCase();
    const hasResult = !!(res.result || res.analysis);
    if (status === 'complete') {
      if (res.result) return res.result;
      if (res.analysis) return res as unknown as ScanResult;
    }
    if (status === 'error') {
      throw new Error('Analysis failed');
    }
    const prog = res.progress;
    if (typeof prog === 'string') {
      onTick(tick % 4, prog);
    } else if (prog && typeof prog === 'object') {
      const cur = (prog as { current?: number; message?: string }).current;
      const msg = (prog as { message?: string }).message;
      if (typeof cur === 'number') tick = cur;
      onTick(tick % 4, msg);
    } else {
      onTick(tick % 4);
    }
    tick += 1;
    await new Promise<void>(r => setTimeout(() => r(), 2000));
  }
  throw new Error('Analysis timed out. Please try again.');
}

function petToQuickAnalyzeBody(pet: Pet, productId: string, deviceId: string) {
  return {
    productId,
    petName: pet.name,
    petType: pet.pet_type,
    petBreed: pet.breed,
    petAgeMonths: pet.age_months,
    petWeightKg: pet.weight_kg,
    petAllergies: [] as string[],
    petHealthConditions: (pet.healthConditions ?? []).map(c => ({
      conditionType: c.condition_type,
      severity: c.severity,
      notes: c.notes,
    })),
    deviceId,
  };
}

function petToBackFields(pet: Pet, deviceId: string): scanService.ScanBackPetFields {
  return {
    petName: pet.name,
    petType: pet.pet_type,
    petBreed: pet.breed,
    petAgeMonths: pet.age_months?.toString(),
    petWeightKg: pet.weight_kg?.toString(),
    petAllergies: '',
    petHealthConditions: JSON.stringify(
      (pet.healthConditions ?? []).map(c => ({
        conditionType: c.condition_type,
        severity: c.severity,
        notes: c.notes,
      }))
    ),
    deviceId,
  };
}

export function TwoStepScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'TwoStepScan'>>();
  const { selectedPet } = useApp();
  const pet = selectedPet;

  const [step, setStep] = useState<ScanStep>('front');
  const [pendingScanId, setPendingScanId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [frontMeta, setFrontMeta] = useState<{
    productName?: string;
    brand?: string;
    productType?: string;
  }>({});
  const [analyzeStepsDone, setAnalyzeStepsDone] = useState([false, false, false, false]);
  const [processing, setProcessing] = useState(false);
  const [ingredientCount, setIngredientCount] = useState(0);
  const [analyzeLabels, setAnalyzeLabels] = useState([
    'Reading ingredients',
    'Checking database',
    'Scoring for your pet',
    'Generating report',
  ]);

  const showLoadingOverlay = processing && step !== 'analyzing';
  const petLabel = pet?.name ?? 'your pet';

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: false,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }, []);

  const runPoll = useCallback(
    async (scanId: string) => {
      setAnalyzeStepsDone([false, false, false, false]);
      return pollUntilComplete(scanId, idx => {
        setAnalyzeStepsDone(prev => {
          const next = [...prev];
          for (let i = 0; i <= idx; i += 1) next[i] = true;
          return next;
        });
      });
    },
    []
  );

  const finishWithResult = useCallback(
    (result: ScanResult) => {
      navigation.replace('Result', { scanResult: result });
    },
    [navigation]
  );

  const onFrontCapture = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(true);
    if (!uri) return;
    setProcessing(true);
    try {
      const res = await scanService.scanFrontLabel(uri);
      setPendingScanId(res.pendingScanId);
      setFrontMeta({
        productName: res.captured?.productName,
        brand: res.captured?.brand,
        productType: res.captured?.productType,
      });
      const list = res.candidates ?? [];
      if (list.length > 0) {
        setCandidates(list);
        setStep('selectCandidate');
      } else {
        setStep('frontCaptured');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessing(false);
    }
  }, [pet, pickImage]);

  const onFrontLibrary = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(false);
    if (!uri) return;
    setProcessing(true);
    try {
      const res = await scanService.scanFrontLabel(uri);
      setPendingScanId(res.pendingScanId);
      setFrontMeta({
        productName: res.captured?.productName,
        brand: res.captured?.brand,
        productType: res.captured?.productType,
      });
      const list = res.candidates ?? [];
      if (list.length > 0) {
        setCandidates(list);
        setStep('selectCandidate');
      } else {
        setStep('frontCaptured');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessing(false);
    }
  }, [pet, pickImage]);

  const onSelectCandidate = useCallback(
    async (c: ProductCandidate) => {
      if (!pet || !pendingScanId) return;
      setProcessing(true);
      setFrontMeta({ productName: c.name, brand: c.brand, productType: c.productType ?? c.product_type });
      setAnalyzeLabels([
        'Loading ingredients',
        'Checking database',
        `Scoring for ${pet.name}`,
        'Generating report',
      ]);
      try {
        const deviceId = await getDeviceId();
        const body = petToQuickAnalyzeBody(pet, c.id, deviceId);
        const raw = await scanService.quickAnalyze(body);
        const scanId = extractScanId(raw);
        setStep('analyzing');
        setProcessing(false);
        const result = await runPoll(scanId);
        finishWithResult(result);
      } catch (e) {
        console.warn('[SCAN] onSelectCandidate error:', e);
        setProcessing(false);
      }
    },
    [pet, pendingScanId, runPoll, finishWithResult]
  );

  const onNotHereScanBack = useCallback(() => {
    setStep('back');
  }, []);

  const onFrontCapturedContinue = useCallback(() => {
    setStep('back');
  }, []);

  const onBackCapture = useCallback(async () => {
    if (!pet || !pendingScanId) return;
    const uri = await pickImage(true);
    if (!uri) return;
    setProcessing(true);
    setAnalyzeLabels([
      'Reading ingredients',
      'Checking database',
      `Scoring for ${pet.name}`,
      'Generating report',
    ]);
    try {
      const deviceId = await getDeviceId();
      const fields = petToBackFields(pet, deviceId);
      const raw = await scanService.scanBackLabel(uri, pendingScanId, fields);
      const scanId = extractScanId(raw);
      setStep('analyzing');
      setProcessing(false);
      const result = await runPoll(scanId);
      finishWithResult(result);
    } catch (e) {
      console.warn(e);
      setProcessing(false);
    }
  }, [pet, pendingScanId, pickImage, runPoll, finishWithResult]);

  const onBackLibrary = useCallback(async () => {
    if (!pet || !pendingScanId) return;
    const uri = await pickImage(false);
    if (!uri) return;
    setProcessing(true);
    setAnalyzeLabels([
      'Reading ingredients',
      'Checking database',
      `Scoring for ${pet.name}`,
      'Generating report',
    ]);
    try {
      const deviceId = await getDeviceId();
      const fields = petToBackFields(pet, deviceId);
      const raw = await scanService.scanBackLabel(uri, pendingScanId, fields);
      const scanId = extractScanId(raw);
      setStep('analyzing');
      setProcessing(false);
      const result = await runPoll(scanId);
      finishWithResult(result);
    } catch (e) {
      console.warn(e);
      setProcessing(false);
    }
  }, [pet, pendingScanId, pickImage, runPoll, finishWithResult]);

  const step1Active = step === 'front';
  const step1Complete = step !== 'front';
  const step2Active = step === 'back' || step === 'frontCaptured';
  /** Back label is only "done" after the user has submitted it and analysis is running. */
  const step2Complete = step === 'analyzing';
  const barActive = step !== 'front';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Navigation bar */}
      <View style={s.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={s.navTitle}>Scan Product</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* Progress header */}
      <View style={s.progressHeader}>
        <View style={s.progressRow}>
          <StepIndicator number={1} title="Front Label" subtitle="Name & Brand" isActive={step1Active} isComplete={step1Complete} />
          <View style={[s.progressBar, barActive && s.progressBarActive]} />
          <StepIndicator number={2} title="Back Label" subtitle="Ingredients" isActive={step2Active} isComplete={step2Complete} />
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {!pet && (
          <Text style={s.noPet}>Add a pet profile in the Pets tab to run a personalized scan.</Text>
        )}

        {step === 'front' && (
          <View style={s.stepContainer}>
            <View style={s.spacer} />
            <FrontIllustration variant="front" />
            <View style={s.textBlock}>
              <Text style={s.stepTitle}>Step 1: Front Label</Text>
              <Text style={s.stepDesc}>
                Capture the <Text style={{ fontWeight: '700' }}>product name</Text> and{' '}
                <Text style={{ fontWeight: '700' }}>brand</Text> from the front of the package
              </Text>
            </View>
            <View style={s.spacer} />
            <View style={s.buttonGroup}>
              <Pressable style={s.primaryBtn} onPress={onFrontCapture}>
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>Scan Front Label</Text>
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={onFrontLibrary}>
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={s.secondaryBtnText}>Choose from Library</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'frontCaptured' && (
          <View style={s.stepContainer}>
            <View style={s.spacer} />
            <View style={s.successCircle}>
              <Ionicons name="checkmark-circle" size={50} color={colors.safe} />
            </View>
            <View style={s.capturedTextBlock}>
              <Text style={s.stepTitle}>Front Label Captured!</Text>
              {(frontMeta.brand || frontMeta.productName) && (
                <View style={s.capturedCard}>
                  {frontMeta.brand ? (
                    <Text style={s.capturedBrand}>{frontMeta.brand.toUpperCase()}</Text>
                  ) : null}
                  <Text style={s.capturedName}>{frontMeta.productName ?? 'Product'}</Text>
                </View>
              )}
            </View>
            <View style={s.flipBlock}>
              <Ionicons name="refresh" size={28} color={colors.primary} />
              <Text style={s.flipTitle}>Flip the package over</Text>
              <Text style={s.flipSub}>We need the ingredients list from the back</Text>
            </View>
            <View style={s.spacer} />
            <Pressable style={s.primaryBtn} onPress={onFrontCapturedContinue}>
              <Text style={s.primaryBtnText}>Continue to Back Label</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
            </Pressable>
          </View>
        )}

        {step === 'selectCandidate' && (
          <View style={{ gap: 0 }}>
            <View style={s.candidateHeader}>
              <View style={s.candidateHeaderCircle}>
                <Ionicons name="search" size={28} color={colors.primary} />
              </View>
              <Text style={s.candidateTitle}>Is this your product?</Text>
              {(frontMeta.brand || frontMeta.productName) && (
                <Text style={s.candidateSubtitle}>
                  We found matches for "{frontMeta.brand ?? ''} {frontMeta.productName ?? ''}"
                </Text>
              )}
            </View>
            <ScrollView style={s.candidateList} nestedScrollEnabled>
              {candidates.map(c => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [s.candidateCard, pressed && { opacity: 0.9 }]}
                  onPress={() => onSelectCandidate(c)}
                >
                  {buildImageUrl(c.imageUrl ?? c.image_url) ? (
                    <Image
                      source={{ uri: buildImageUrl(c.imageUrl ?? c.image_url)! }}
                      style={s.candidateImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.candidateImg, s.candidateImgPh]}>
                      <Ionicons name="paw" size={28} color={colors.primary} />
                    </View>
                  )}
                  <View style={s.candidateInfo}>
                    <View style={{ flex: 1, gap: 4 }}>
                      {c.brand ? (
                        <Text style={s.candidateCardBrand}>{c.brand.toUpperCase()}</Text>
                      ) : null}
                      <Text style={s.candidateCardName} numberOfLines={2}>
                        {c.name ?? 'Unknown Product'}
                      </Text>
                      {(c.productType ?? c.product_type) ? (
                        <View style={s.candidateTypePill}>
                          <Text style={s.candidateTypeText}>
                            {(c.productType ?? c.product_type ?? '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <View style={s.candidateFooter}>
              <View style={s.candidateOrRow}>
                <View style={s.candidateOrLine} />
                <Text style={s.candidateOrText}>or</Text>
                <View style={s.candidateOrLine} />
              </View>
              <Pressable
                onPress={onNotHereScanBack}
                style={({ pressed }) => [s.notHereCard, pressed && s.notHereCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="None of these products match. Continue to scan the back label."
              >
                <View style={s.notHereTextBlock}>
                  <Text style={s.notHereTitle}>None of these?</Text>
                  <Text style={s.notHereSub}>Continue to scan the back label</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'back' && (
          <View style={s.stepContainer}>
            <View style={s.spacer} />
            <FrontIllustration variant="back" />
            <View style={s.textBlock}>
              <Text style={s.stepTitle}>Step 2: Back Label</Text>
              <Text style={s.stepDesc}>
                Now flip the package and capture the{' '}
                <Text style={{ fontWeight: '700' }}>ingredients list</Text> and{' '}
                <Text style={{ fontWeight: '700' }}>nutrition info</Text>
              </Text>
            </View>
            {(frontMeta.brand || frontMeta.productName) && (
              <View style={s.capturedChip}>
                <Ionicons name="checkmark-circle" size={16} color={colors.safe} />
                <Text style={s.capturedChipText} numberOfLines={1}>
                  {`${frontMeta.brand ?? ''} ${frontMeta.productName ?? ''}`.trim()}
                </Text>
              </View>
            )}
            <View style={s.spacer} />
            <View style={s.buttonGroup}>
              <Pressable style={s.primaryBtn} onPress={onBackCapture}>
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>Scan Back Label</Text>
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={onBackLibrary}>
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={s.secondaryBtnText}>Choose from Library</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'analyzing' && (
          <View style={s.analyzingContainer}>
            <View style={s.spacer} />
            {(frontMeta.brand || frontMeta.productName) && (
              <View style={s.analyzingCard}>
                {frontMeta.brand ? (
                  <Text style={s.analyzingBrand}>{frontMeta.brand.toUpperCase()}</Text>
                ) : null}
                <Text style={s.analyzingName}>{frontMeta.productName ?? 'Product'}</Text>
                {ingredientCount > 0 && (
                  <Text style={s.analyzingIngCount}>{ingredientCount} ingredients detected</Text>
                )}
              </View>
            )}
            <View style={{ height: 32 }} />
            <View style={s.stepsBlock}>
              {analyzeLabels.map((label, i) => {
                const isComplete = analyzeStepsDone[i];
                const isCurrent =
                  !isComplete && analyzeStepsDone.findIndex(d => !d) === i;
                return (
                  <View key={label} style={s.analyzeStepRow}>
                    {isComplete ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
                    ) : isCurrent ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ width: 20, height: 20 }} />
                    ) : (
                      <View style={s.emptyCircle} />
                    )}
                    <Text
                      style={[
                        s.analyzeStepLabel,
                        isComplete && { fontWeight: '500', color: colors.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={s.spacer} />
            <View style={s.analyzeFooter}>
              <Text style={s.analyzeFooterLight}>
                First-time scans take longer while we build the analysis
              </Text>
              <Text style={s.analyzeFooterTeal}>Previously scanned products are instant</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Processing overlay */}
      <Modal visible={showLoadingOverlay} transparent animationType="fade">
        <View style={s.overlayBg}>
          <View style={s.overlayPanel}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={s.overlayText}>
              {step === 'front' ? 'Reading front label...' : 'Processing image...'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StepIndicator({
  number,
  title,
  subtitle,
  isActive,
  isComplete,
}: {
  number: number;
  title: string;
  subtitle: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  /** Done steps: success green + check. Current step: brand primary + number. Upcoming: neutral. */
  const circleBg = isComplete
    ? colors.safe
    : isActive
      ? colors.primary
      : 'rgba(92,107,102,0.15)';
  const activeShadow =
    isActive && !isComplete && Platform.OS === 'ios'
      ? {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        }
      : isActive && !isComplete && Platform.OS === 'android'
        ? { elevation: 4 }
        : {};

  const titleColor = isActive ? colors.textPrimary : colors.textSecondary;
  const subtitleColor = isActive
    ? colors.primary
    : isComplete
      ? colors.safe
      : 'rgba(92,107,102,0.6)';

  return (
    <View style={s.stepIndicator}>
      <View style={[s.stepCircle, { backgroundColor: circleBg }, activeShadow]}>
        {isComplete ? (
          <Ionicons name="checkmark" size={15} color={colors.white} />
        ) : (
          <Text
            style={[
              s.stepNumber,
              { color: isActive ? colors.white : colors.textSecondary },
            ]}
          >
            {number}
          </Text>
        )}
      </View>
      <Text
        style={[
          s.stepIndicatorTitle,
          { color: titleColor },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          s.stepIndicatorSub,
          { color: subtitleColor },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function FrontIllustration({ variant }: { variant: 'front' | 'back' }) {
  return (
    <View style={s.illusOuter}>
      <View style={s.illusDashedFrame}>
        {variant === 'front' ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 28, opacity: 0.5 }}>🐾</Text>
            <Text style={s.illusMockBrand}>BRAND</Text>
            <Text style={s.illusMockProduct}>Product Name</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}>
            <Text style={s.illusIngLabel}>Ingredients:</Text>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={s.illusIngBar} />
            ))}
            <View style={{ height: 8 }} />
            <Text style={s.illusNutrLabel}>Nutrition Facts</Text>
            {[1, 2, 3].map(i => (
              <View key={i} style={s.illusNutrBar} />
            ))}
          </View>
        )}
      </View>
      <Text style={s.illusSideLabel}>{variant === 'front' ? 'FRONT' : 'BACK'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.primary,
  },
  navTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  progressHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(92,107,102,0.2)',
    marginHorizontal: 4,
  },
  progressBarActive: {
    backgroundColor: colors.primary,
  },
  stepIndicator: {
    alignItems: 'center',
    gap: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepIndicatorTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepIndicatorSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  noPet: {
    ...typography.bodyMedium,
    color: colors.warning,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    minHeight: 500,
  },
  spacer: { flex: 1 },
  textBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stepDesc: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonGroup: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.large,
    ...shadows.button(colors.primary),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.divider,
    ...shadows.card,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  successCircle: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(64,145,108,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  capturedTextBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  capturedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    ...shadows.card,
  },
  capturedBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  capturedName: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  flipBlock: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md,
  },
  flipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  flipSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  candidateHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  candidateHeaderCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(45,106,79,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  candidateSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  candidateList: {
    maxHeight: 420,
    marginTop: spacing.md,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    marginBottom: spacing.sm,
    gap: 14,
    ...shadows.card,
  },
  candidateImg: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: 'rgba(45,106,79,0.06)',
  },
  candidateImgPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  candidateCardBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  candidateCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  candidateTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(45,106,79,0.08)',
    marginTop: 2,
  },
  candidateTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  candidateFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  candidateOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  candidateOrLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  candidateOrText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  notHereCard: {
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.22)',
    backgroundColor: 'rgba(45,106,79,0.05)',
    padding: spacing.md,
    ...shadows.card,
  },
  notHereCardPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  notHereTextBlock: {
    gap: 4,
    alignItems: 'center',
  },
  notHereTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  notHereSub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  capturedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(64,145,108,0.1)',
    borderRadius: radius.medium,
  },
  capturedChipText: {
    ...typography.labelMedium,
    color: colors.textPrimary,
  },
  analyzingContainer: {
    flex: 1,
    minHeight: 500,
  },
  analyzingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  analyzingBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  analyzingName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
  analyzingIngCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  stepsBlock: {
    paddingHorizontal: spacing.md,
    gap: 14,
  },
  analyzeStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(92,107,102,0.3)',
  },
  analyzeStepLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  analyzeFooter: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: spacing.xl,
  },
  analyzeFooterLight: {
    fontSize: 12,
    color: 'rgba(92,107,102,0.6)',
    textAlign: 'center',
  },
  analyzeFooterTeal: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(45,106,79,0.7)',
  },
  illusOuter: {
    alignSelf: 'center',
    width: 180,
    height: 220,
    borderRadius: 20,
    backgroundColor: 'rgba(45,106,79,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  illusDashedFrame: {
    width: 140,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(45,106,79,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusMockBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(45,106,79,0.5)',
    letterSpacing: 2,
  },
  illusMockProduct: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(45,106,79,0.6)',
  },
  illusSideLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
    marginTop: 10,
  },
  illusIngLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(45,106,79,0.6)',
  },
  illusIngBar: {
    width: 100,
    height: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(45,106,79,0.2)',
    marginTop: 2,
  },
  illusNutrLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(45,106,79,0.5)',
  },
  illusNutrBar: {
    width: 80,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(45,106,79,0.15)',
    marginTop: 2,
  },
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayPanel: {
    backgroundColor: 'rgba(27,43,39,0.85)',
    borderRadius: radius.large,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  overlayText: {
    ...typography.labelLarge,
    color: colors.white,
  },
});
