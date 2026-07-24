import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, { ReorderableListReorderEvent, reorderItems, useReorderableDrag } from 'react-native-reorderable-list';
import type { HomeStackParamList } from '../navigation/types';
import * as scanService from '../services/scanService';
import { ApiUploadError } from '../services/api';
import { useApp } from '../context/AppContext';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type {
  Pet,
  PackageShape,
  ProductCandidate,
  ScanFrontResponse,
  ScanResult,
} from '../types';
import { ManualIngredientsFlow } from './ManualIngredientsScreen';
import { buildImageUrl, formatLifeStage, formatProductTitleText, toIngredientTitleCase } from '../utils/helpers';
import { pollUntilComplete } from '../utils/analysisPoll';
import {
  clearPendingAnalysisScan,
  loadPendingAnalysisScan,
  savePendingAnalysisScan,
} from '../utils/pendingAnalysisScan';

const MISSING_FRONT_FIELD_LABEL: Record<string, string> = {
  brand: 'brand',
  lineName: 'product line',
  targetPet: 'dog or cat label',
};

function buildFrontRescanMessage(missingFields?: string[]): string {
  if (!missingFields?.length) {
    return 'Please scan the front label again.';
  }
  const parts = missingFields.map((f) => MISSING_FRONT_FIELD_LABEL[f] ?? f);
  let joined: string;
  if (parts.length === 1) joined = parts[0];
  else if (parts.length === 2) joined = `${parts[0]} or ${parts[1]}`;
  else joined = `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`;
  return `We couldn't read the ${joined}. Please scan the front label again.`;
}

type ScanStep =
  | 'front'
  | 'selectCandidate'
  | 'back'
  | 'manualIngredients'
  | 'editor'
  | 'barcode'
  | 'analyzing';

/** Shown above manual ingredient entry when embedded in label scan (round pack only). */
function manualIngredientsExplainer(shape: PackageShape | null): string {
  if (shape === 'round') {
    return 'Round pack detected - Type ingredients in label order';
  }
  return 'Enter ingredients manually in label order (top of the label first).';
}

function extractScanId(data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.scanId === 'string') return d.scanId;
    if (typeof d.scan_id === 'string') return d.scan_id;
  }
  throw new Error('Missing scan id from server');
}

function petToQuickAnalyzeBody(pet: Pet, productId: string) {
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
  };
}

function petToBackFields(pet: Pet): scanService.ScanBackPetFields {
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
  };
}

function formatBrandLine(manufacturer?: string, brand?: string): string | null {
  const mfr = manufacturer?.trim();
  const b = brand?.trim();
  if (!mfr && !b) return null;
  if (!mfr || mfr.toLowerCase() === b?.toLowerCase()) return b || null;
  if (!b) return mfr;
  return `${mfr} · ${b}`;
}

export function TwoStepScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'TwoStepScan'>>();
  const { selectedPet } = useApp();
  const pet = selectedPet;

  const packageShapeRef = useRef<PackageShape | null>(null);
  const manualReturnStepRef = useRef<'front' | 'selectCandidate'>('front');
  const pendingFrontImageRef = useRef<string | null>(null);
  const frontScanInFlightRef = useRef(false);

  const [step, setStep] = useState<ScanStep>('front');
  const [pendingScanId, setPendingScanId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [frontMeta, setFrontMeta] = useState<{
    productName?: string;
    manufacturer?: string;
    brand?: string;
    productType?: string;
  }>({});
  const [analyzeStepsDone, setAnalyzeStepsDone] = useState([false, false, false, false]);
  const [processing, setProcessing] = useState(false);
  const [frontRescanMessage, setFrontRescanMessage] = useState<string | null>(null);
  const [analyzeLabels, setAnalyzeLabels] = useState([
    'Reading ingredients',
    'Checking database',
    'Scoring',
    'Generating report',
  ]);
  const [ingredientsForEditor, setIngredientsForEditor] = useState<string[]>([]);
  const [confirmedIngredients, setConfirmedIngredients] = useState<string[]>([]);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const showLoadingOverlay = processing && step !== 'analyzing' && step !== 'manualIngredients' && step !== 'editor' && step !== 'barcode';

  // Loading overlay copy. Each step picks the most specific message
  // available so the user always knows which phase is in flight (and
  // never sees a generic "Processing image…" mid-multi-frame flow).
  // Photo counts are omitted on purpose — they kept flickering between
  // numbered and un-numbered variants as `step` transitioned.
  const overlayText =
    step === 'front'
      ? 'Reading product…'
      : step === 'selectCandidate'
        ? 'Loading product…'
        : step === 'back' || step === 'manualIngredients'
          ? 'Reading the label…'
          : 'Working…';

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission Needed',
        fromCamera
          ? 'Camera access is required to scan labels.'
          : 'Photo library access is required to select an image.',
      );
      return null;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }, []);

  const runPoll = useCallback(
    async (scanId: string) => {
      setAnalyzeStepsDone([false, false, false, false]);
      await savePendingAnalysisScan({
        scanId,
        startedAt: Date.now(),
        frontMeta: {
          productName: frontMeta.productName,
          brand: frontMeta.brand,
          productType: frontMeta.productType,
        },
      });
      const result = await pollUntilComplete(scanId, idx => {
        setAnalyzeStepsDone(prev => {
          const next = [...prev];
          const capped = Math.min(idx, 2);
          for (let i = 0; i <= capped; i += 1) next[i] = true;
          return next;
        });
      });
      await clearPendingAnalysisScan();
      setAnalyzeStepsDone([true, true, true, true]);
      await new Promise<void>(r => setTimeout(r, 250));
      return result;
    },
    [frontMeta]
  );

  const finishWithResult = useCallback(
    (result: ScanResult, suppressProductImage?: boolean) => {
      navigation.replace('Result', {
        scanResult: result,
        ...(suppressProductImage ? { suppressProductImage: true } : {}),
      });
    },
    [navigation]
  );

  const resumeChecked = useRef(false);
  useEffect(() => {
    if (resumeChecked.current) return;
    resumeChecked.current = true;
    let cancelled = false;
    (async () => {
      const pending = await loadPendingAnalysisScan();
      if (!pending || cancelled) return;
      setFrontMeta(pending.frontMeta ?? {});
      setAnalyzeLabels([
        'Reading ingredients',
        'Checking database',
        'Scoring',
        'Generating report',
      ]);
      setStep('analyzing');
      try {
        const result = await runPoll(pending.scanId);
        if (!cancelled) finishWithResult(result);
      } catch (e) {
        console.warn('[SCAN] resume pending analysis failed:', e);
        await clearPendingAnalysisScan();
        if (!cancelled) setStep('front');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runPoll, finishWithResult]);

  /** DB product match → quickAnalyze → Result (same as tapping a suggestion). */
  const runQuickAnalyzeForProduct = useCallback(
    async (productId: string, meta?: { name?: string; manufacturer?: string; brand?: string; productType?: string }) => {
      if (!pet) return;
      setProcessing(true);
      setFrontMeta({
        productName: meta?.name,
        manufacturer: meta?.manufacturer,
        brand: meta?.brand,
        productType: meta?.productType,
      });
      setAnalyzeLabels([
        'Loading ingredients',
        'Checking database',
        'Scoring',
        'Generating report',
      ]);
      try {
        const raw = await scanService.quickAnalyze(petToQuickAnalyzeBody(pet, productId));
        const scanId = extractScanId(raw);
        setStep('analyzing');
        setProcessing(false);
        const result = await runPoll(scanId);
        finishWithResult(result);
      } catch (e) {
        console.warn('[SCAN] quickAnalyze failed:', e);
        setProcessing(false);
        Alert.alert('Analysis Failed', 'Could not analyze this product. Please try again.');
      }
    },
    [pet, runPoll, finishWithResult]
  );

  /** Shared front-scan tail: metadata + candidate list or straight to back step. */
  const applyFrontResult = useCallback(async (res: ScanFrontResponse) => {
    setFrontRescanMessage(null);
    setPendingScanId(res.pendingScanId ?? null);
    packageShapeRef.current = res.captured?.packageShape ?? null;

    if (res.matchType === 'exact' && res.product?.id) {
      await runQuickAnalyzeForProduct(res.product.id, {
        name: res.product.name ?? res.captured?.productName,
        manufacturer: res.product.manufacturer ?? res.captured?.manufacturer,
        brand: res.product.brand ?? res.captured?.brand,
        productType: res.product.productType ?? res.captured?.productType,
      });
      return;
    }

    setFrontMeta({
      productName: res.captured?.productName,
      manufacturer: res.captured?.manufacturer,
      brand: res.captured?.brand,
      productType: res.captured?.productType,
    });

    const list = res.candidates ?? [];
    if (list.length > 0) {
      setCandidates(list);
      setStep('selectCandidate');
    } else {
      manualReturnStepRef.current = 'front';
      const shape = packageShapeRef.current;
      if (shape === 'round') {
        setStep('manualIngredients');
      } else {
        setStep('back');
      }
    }
  }, [runQuickAnalyzeForProduct]);

  const doFrontScan = useCallback(async (uri: string) => {
    if (frontScanInFlightRef.current) return;
    pendingFrontImageRef.current = uri;
    frontScanInFlightRef.current = true;
    setProcessing(true);
    try {
      const res = await scanService.scanFrontLabel(uri);
      pendingFrontImageRef.current = null;
      frontScanInFlightRef.current = false;
      await applyFrontResult(res);
    } catch (e) {
      console.warn('[FRONT] scan failed:', e);
      frontScanInFlightRef.current = false;
      if (e instanceof ApiUploadError && e.code === 'incomplete_front_scan') {
        const msg = buildFrontRescanMessage(e.missingFields);
        setFrontRescanMessage(msg);
        Alert.alert('Rescan needed', msg, [{ text: 'OK' }]);
        return;
      }
      if (e instanceof ApiUploadError && e.code === 'back_label_detected') {
        Alert.alert(
          'Ingredients label detected',
          e.suggestion ? `${e.message}\n\n${e.suggestion}` : e.message,
          [
            { text: 'Try again', style: 'cancel' },
            {
              text: 'Enter manually',
              onPress: () => {
                manualReturnStepRef.current = 'front';
                setStep('manualIngredients');
              },
            },
          ],
        );
        return;
      }
      if (e instanceof ApiUploadError) {
        Alert.alert(
          'Scan Failed',
          e.suggestion ? `${e.message}\n\n${e.suggestion}` : e.message,
        );
        return;
      }
      Alert.alert('Scan Failed', 'Could not read the label. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [applyFrontResult]);

  const onFrontCapture = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(true);
    if (!uri) return;
    doFrontScan(uri);
  }, [pet, pickImage, doFrontScan]);

  const onFrontLibrary = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(false);
    if (!uri) return;
    doFrontScan(uri);
  }, [pet, pickImage, doFrontScan]);

  // Auto-retry front scan when returning from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active' &&
        pendingFrontImageRef.current &&
        !frontScanInFlightRef.current
      ) {
        doFrontScan(pendingFrontImageRef.current);
      }
    });
    return () => sub.remove();
  }, [doFrontScan]);

  const onSelectCandidate = useCallback(
    async (c: ProductCandidate) => {
      if (!pet || !pendingScanId) return;
      await runQuickAnalyzeForProduct(c.id, {
        name: c.name,
        manufacturer: c.manufacturer,
        brand: c.brand,
        productType: c.productType ?? c.product_type,
      });
    },
    [pet, pendingScanId, runQuickAnalyzeForProduct]
  );

  const onNotHereScanBack = useCallback(() => {
    manualReturnStepRef.current = 'selectCandidate';
    const shape = packageShapeRef.current;
    if (shape === 'round') {
      setStep('manualIngredients');
    } else {
      setStep('back');
    }
  }, []);

  const handleBackImage = useCallback(async (uri: string) => {
    if (!pet || !pendingScanId) return;
    setProcessing(true);
    try {
      const fields = petToBackFields(pet);
      const raw = await scanService.scanBackLabel(uri, pendingScanId, fields) as Record<string, unknown>;
      const editorList = raw.ingredientsForEditor as string[] | undefined;
      if (editorList && editorList.length > 0) {
        setIngredientsForEditor(editorList);
        setStep('editor');
      } else {
        const scanId = extractScanId(raw);
        setAnalyzeLabels([
          'Reading ingredients',
          'Checking database',
          'Scoring',
          'Generating report',
        ]);
        setStep('analyzing');
        setProcessing(false);
        const result = await runPoll(scanId);
        finishWithResult(result);
        return;
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessing(false);
    }
  }, [pet, pendingScanId, runPoll, finishWithResult]);

  const onBackCapture = useCallback(async () => {
    if (!pet || !pendingScanId) return;
    const uri = await pickImage(true);
    if (!uri) return;
    await handleBackImage(uri);
  }, [pet, pendingScanId, pickImage, handleBackImage]);

  const onBackLibrary = useCallback(async () => {
    if (!pet || !pendingScanId) return;
    const uri = await pickImage(false);
    if (!uri) return;
    await handleBackImage(uri);
  }, [pet, pendingScanId, pickImage, handleBackImage]);

  const onEditorConfirm = useCallback((ingredients: string[]) => {
    setConfirmedIngredients(ingredients);
    setScannedBarcode(null);
    setStep('barcode');
  }, []);

  const startAnalysis = useCallback(async (barcode: string | null) => {
    if (!pet) return;
    setProcessing(true);
    setAnalyzeLabels([
      'Analyzing ingredients',
      'Checking database',
      'Scoring',
      'Generating report',
    ]);
    setStep('analyzing');
    try {
      const raw = await scanService.confirmIngredients({
        pendingScanId: pendingScanId ?? undefined,
        ingredients: confirmedIngredients,
        petName: pet.name,
        petType: pet.pet_type,
        petBreed: pet.breed,
        petAgeMonths: pet.age_months,
        petWeightKg: pet.weight_kg,
        petHealthConditions: JSON.stringify(
          (pet.healthConditions ?? []).map(c => ({
            conditionType: c.condition_type,
            severity: c.severity,
            notes: c.notes,
          }))
        ),
        productName: frontMeta.productName,
        brand: frontMeta.brand,
        productType: frontMeta.productType,
        barcode: barcode ?? undefined,
      });
      const scanId = extractScanId(raw);
      setProcessing(false);
      const result = await runPoll(scanId);
      finishWithResult(result);
    } catch (e) {
      console.warn('[SCAN] confirm-ingredients error:', e);
      setProcessing(false);
      setStep('editor');
    }
  }, [pet, pendingScanId, frontMeta, confirmedIngredients, runPoll, finishWithResult]);

  const step1Active = step === 'front';
  const step1Complete = step !== 'front';
  const step2Active = step === 'back' || step === 'manualIngredients' || step === 'editor';
  const step2Complete = step === 'barcode' || step === 'analyzing';
  const step3Active = step === 'barcode';
  const step3Complete = step === 'analyzing';
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
          <StepIndicator number={1} title="Product" subtitle="" isActive={step1Active} isComplete={step1Complete} />
          <View style={[s.progressBar, barActive && s.progressBarActive]} />
          <StepIndicator number={2} title="Ingredients" subtitle="" isActive={step2Active} isComplete={step2Complete} />
          <View style={[s.progressBar, step2Complete && s.progressBarActive]} />
          <StepIndicator number={3} title="Barcode" subtitle="" isActive={step3Active} isComplete={step3Complete} />
        </View>
      </View>

      {/* Content */}
      {step === 'selectCandidate' ? (
        // selectCandidate gets its own flex layout (NOT inside the outer
        // ScrollView) so we can pin the "None of these" CTA to the bottom
        // of the screen and let only the candidate list scroll. Nesting
        // a ScrollView inside the outer ScrollView traps the gesture once
        // the inner list bottoms out, which made the CTA hard to reach.
        <View style={s.selectCandidateLayout}>
          {!pet && (
            <Text style={s.noPet}>Add a pet profile in the Pets tab to run a personalized scan.</Text>
          )}
          <View style={s.candidateHeader}>
            <View style={s.candidateHeaderTitleRow}>
              <Ionicons name="search" size={18} color={colors.primary} />
              <Text style={s.candidateTitle}>Is this your product?</Text>
            </View>
            {(frontMeta.brand || frontMeta.manufacturer || frontMeta.productName) && (
              <View style={s.candidateScannedInfo}>
                {formatBrandLine(frontMeta.manufacturer, frontMeta.brand) ? (
                  <Text style={s.candidateScannedBrand} numberOfLines={1}>
                    {formatProductTitleText(formatBrandLine(frontMeta.manufacturer, frontMeta.brand)!)}
                  </Text>
                ) : null}
                {frontMeta.productName ? (
                  <Text style={s.candidateScannedName} numberOfLines={2}>
                    {formatProductTitleText(frontMeta.productName)}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          <ScrollView
            style={s.candidateList}
            contentContainerStyle={s.candidateListContent}
            showsVerticalScrollIndicator
          >
            {candidates.map(c => {
              const imgUri = buildImageUrl(c.imageUrl ?? c.image_url);
              const petType = c.targetPetType ?? c.target_pet_type;
              const lifeStage = c.lifeStage;
              const prodType = c.productType ?? c.product_type;
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [s.candidateCard, pressed && { opacity: 0.9 }]}
                  onPress={() => onSelectCandidate(c)}
                >
                  <Pressable onPress={() => imgUri && setZoomImageUri(imgUri)}>
                    {imgUri ? (
                      <Image source={{ uri: imgUri }} style={s.candidateImg} resizeMode="contain" />
                    ) : (
                      <View style={[s.candidateImg, s.candidateImgPh]}>
                        <Ionicons name="paw" size={28} color={colors.primary} />
                      </View>
                    )}
                  </Pressable>
                  <View style={s.candidateInfo}>
                    <View style={{ flex: 1, gap: 2 }}>
                      {c.brand ? (
                        <Text style={s.candidateCardBrand} numberOfLines={1}>{formatProductTitleText(c.brand)}</Text>
                      ) : null}
                      <Text style={s.candidateCardName} numberOfLines={3}>
                        {formatProductTitleText(c.name ?? 'Unknown Product')}
                      </Text>
                      <View style={s.candidatePillRow}>
                        {prodType ? (
                          <View style={s.candidateTypePill}>
                            <Text style={s.candidateTypeText}>
                              {prodType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                          </View>
                        ) : null}
                        {petType && petType !== 'both' ? (
                          <View style={[s.candidateTypePill, { backgroundColor: colors.primary + '14' }]}>
                            <Text style={[s.candidateTypeText, { color: colors.primary }]}>
                              {petType === 'dog' ? 'Dog' : petType === 'cat' ? 'Cat' : petType}
                            </Text>
                          </View>
                        ) : null}
                        {lifeStage && lifeStage !== 'all' ? (
                          <View style={[s.candidateTypePill, { backgroundColor: colors.accent + '14' }]}>
                            <Text style={[s.candidateTypeText, { color: colors.accent }]}>
                              {formatLifeStage(lifeStage, petType)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </Pressable>
              );
            })}
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
              android_ripple={{ color: colors.primary + '18' }}
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
      ) : step === 'manualIngredients' && pet ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <ManualIngredientsFlow
            mode="scan"
            hideNavBar
            entryExplainer={manualIngredientsExplainer(packageShapeRef.current)}
            pet={pet}
            productHint={{
              brand: frontMeta.brand,
              productName: frontMeta.productName,
              productType: frontMeta.productType,
            }}
            onSuccess={(r) => finishWithResult(r, true)}
            onCancel={() => setStep(manualReturnStepRef.current)}
          />
        </View>
      ) : step === 'editor' && pet ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <IngredientEditorStep
            ingredients={ingredientsForEditor}
            productName={frontMeta.productName}
            brand={formatBrandLine(frontMeta.manufacturer, frontMeta.brand) ?? undefined}
            onConfirm={onEditorConfirm}
            onCancel={() => setStep('back')}
          />
        </View>
      ) : step === 'barcode' ? (
        <BarcodeStep
          productName={frontMeta.productName}
          brand={formatBrandLine(frontMeta.manufacturer, frontMeta.brand) ?? undefined}
          onScanned={(code) => {
            setScannedBarcode(code);
            startAnalysis(code);
          }}
          onSkip={() => startAnalysis(null)}
        />
      ) : (
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {!pet && (
          <Text style={s.noPet}>Add a pet profile in the Pets tab to run a personalized scan.</Text>
        )}

        {step === 'front' && (
          <View style={s.stepContainer}>
            <View style={s.spacer} />
            <FrontIllustration variant="front" />
            <View style={s.textBlock}>
              <Text style={s.stepTitle}>Scan the Front Label</Text>
            </View>
            {frontRescanMessage ? (
              <View style={s.frontRescanBanner}>
                <Ionicons name="alert-circle" size={22} color={colors.warning} />
                <Text style={s.frontRescanBody}>{frontRescanMessage}</Text>
              </View>
            ) : null}
            <View style={s.spacer} />
            <View style={s.buttonGroup}>
              <Pressable style={s.primaryBtn} onPress={onFrontCapture}>
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>Scan Product</Text>
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={onFrontLibrary}>
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={s.secondaryBtnText}>Choose from Library</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'back' && (
          <View style={s.stepContainer}>
            {/* Captured chip pinned at top so the user always sees what
                product they're scanning ingredients for. */}
            {(frontMeta.brand || frontMeta.manufacturer || frontMeta.productName) && (
              <View style={s.capturedChipTop}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.safe}
                  style={s.capturedChipIcon}
                />
                <View style={s.capturedChipTextCol}>
                  {formatBrandLine(frontMeta.manufacturer, frontMeta.brand) ? (
                    <Text style={s.capturedChipBrand} numberOfLines={1}>
                      {formatProductTitleText(formatBrandLine(frontMeta.manufacturer, frontMeta.brand)!)}
                    </Text>
                  ) : null}
                  <Text style={s.capturedChipName} numberOfLines={2}>
                    {formatProductTitleText(frontMeta.productName ?? 'Product')}
                  </Text>
                </View>
              </View>
            )}

            <View style={s.spacer} />
            <FrontIllustrationBack />
            <View style={s.textBlock}>
              <Text style={s.stepTitle}>Scan Ingredients</Text>
            </View>

            <View style={s.cameraTipBox}>
              <Ionicons name="scan-outline" size={20} color={colors.primary} />
              <View style={s.cameraTipTextCol}>
                <Text style={s.cameraTipMain}>Get close to the ingredient list</Text>
                <Text style={s.cameraTipSub}>Fill the frame with just the ingredients section so all text is readable</Text>
              </View>
            </View>

            <View style={s.spacer} />

            <View style={s.buttonGroup}>
              <Pressable style={s.primaryBtn} onPress={onBackCapture}>
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>Scan Ingredients</Text>
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
            {(frontMeta.brand || frontMeta.manufacturer || frontMeta.productName) && (
              <View style={s.analyzingCard}>
                {formatBrandLine(frontMeta.manufacturer, frontMeta.brand) ? (
                  <Text style={s.analyzingBrand}>{formatProductTitleText(formatBrandLine(frontMeta.manufacturer, frontMeta.brand)!)}</Text>
                ) : null}
                <Text style={s.analyzingName}>{formatProductTitleText(frontMeta.productName ?? 'Product')}</Text>
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
            <View style={s.analyzeTimeHint}>
              <Ionicons name="time-outline" size={22} color={colors.warning} />
              <Text style={s.analyzeTimeHintText}>
                First-time scans can take up to a minute while we build your report
              </Text>
            </View>
            <View style={s.spacer} />
            <View style={s.analyzeFooter}>
              <Text style={s.analyzeFooterLight}>
                You can switch apps — we'll pick up when you return
              </Text>
              <Text style={s.analyzeFooterTeal}>Previously scanned products are instant</Text>
            </View>
          </View>
        )}
      </ScrollView>
      )}

      {/* Processing overlay */}
      <Modal
        visible={showLoadingOverlay}
        transparent
        animationType="fade"
        onRequestClose={() => { /* ignore back-press while processing */ }}
      >
        <View style={s.overlayBg}>
          <View style={s.overlayPanel}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={s.overlayText}>{overlayText}</Text>
          </View>
        </View>
      </Modal>

      {/* Candidate image zoom with pinch */}
      <Modal
        visible={!!zoomImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}
      >
        <ZoomableImageModal uri={zoomImageUri} onClose={() => setZoomImageUri(null)} />
      </Modal>
    </SafeAreaView>
  );
}

function ZoomableImageModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => {
      if (scale.value < 1) { scale.value = withTiming(1); savedScale.value = 1; }
      else { savedScale.value = scale.value; }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    if (scale.value > 1) {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    } else {
      scale.value = withTiming(2.5);
      savedScale.value = 2.5;
    }
  });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const screenW = Dimensions.get('window').width;
  const imgSize = screenW * 0.9;

  return (
    <GestureHandlerRootView style={s.zoomBackdrop}>
      <Pressable style={s.zoomCloseBtn} onPress={onClose}>
        <Ionicons name="close-circle" size={36} color={colors.white} />
      </Pressable>
      <View style={s.zoomBanner}>
        <Ionicons name="information-circle-outline" size={14} color={colors.white} />
        <Text style={s.zoomBannerText}>Pinch to zoom · Double-tap to toggle</Text>
      </View>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: imgSize, height: imgSize }, animatedStyle]}>
          {uri && (
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          )}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/* ─────────── Barcode Scan Step ─────────── */
function BarcodeStep({
  productName,
  brand,
  onScanned,
  onSkip,
}: {
  productName?: string;
  brand?: string;
  onScanned: (code: string) => void;
  onSkip: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);
    onScanned(data);
  }, [hasScanned, onScanned]);

  if (!permission?.granted) {
    return (
      <View style={barcodeStyles.container}>
        <Text style={barcodeStyles.permText}>Camera permission is required to scan barcodes.</Text>
        <Pressable style={barcodeStyles.skipBtn} onPress={onSkip}>
          <Text style={barcodeStyles.skipBtnText}>Skip</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={barcodeStyles.container}>
      {(brand || productName) && (
        <View style={barcodeStyles.productChip}>
          {brand ? <Text style={barcodeStyles.chipBrand}>{brand}</Text> : null}
          <Text style={barcodeStyles.chipName} numberOfLines={2}>{productName ?? 'Product'}</Text>
        </View>
      )}
      <View style={barcodeStyles.cameraWrap}>
        <CameraView
          style={barcodeStyles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'] }}
          onBarcodeScanned={hasScanned ? undefined : handleBarCodeScanned}
        />
        <View style={barcodeStyles.overlay}>
          <View style={barcodeStyles.scanLine} />
        </View>
      </View>
      <Text style={barcodeStyles.hint}>Point your camera at the barcode</Text>
      <Pressable style={barcodeStyles.skipBtn} onPress={onSkip}>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        <Text style={barcodeStyles.skipBtnText}>Skip Barcode</Text>
      </Pressable>
    </View>
  );
}

const barcodeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  productChip: {
    alignItems: 'center',
    marginBottom: 12,
  },
  chipBrand: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cameraWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    width: '70%',
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.7,
    borderRadius: 1,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  permText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
});

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

/**
 * Step 1 illustration. We deliberately do NOT label this "FRONT" — the
 * brand+product name often lives on a side or top of the package, and a
 * "FRONT" badge would mis-train users to flip the package the wrong way.
 */
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
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Trimmed variant used on Step 2. Smaller dashed frame, no nutrition
 * mock (we don't actually parse nutrition yet), no "BACK" badge.
 */
function FrontIllustrationBack() {
  return (
    <View style={s.illusOuterSmall}>
      <View style={s.illusDashedFrameSmall}>
        <Text style={s.illusIngLabel}>Ingredients:</Text>
        {[1, 2, 3].map(i => (
          <View key={i} style={s.illusIngBar} />
        ))}
      </View>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(92,107,102,0.2)',
    marginHorizontal: 4,
    marginTop: 18,
  },
  progressBarActive: {
    backgroundColor: colors.primary,
  },
  stepIndicator: {
    alignItems: 'center',
    gap: 1,
    width: 72,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    // Keep height stable even when one of the two indicators has no
    // subtitle (e.g. Step 2 = "Ingredients" with no fine-print) so the
    // step circles stay vertically aligned across the progress row.
    minHeight: 14,
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
  frontRescanBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.lg,
    marginHorizontal: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.warning + '18',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.warning + '55',
  },
  frontRescanBody: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  cameraTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.lg,
    marginHorizontal: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary + '0D',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  cameraTipTextCol: {
    flex: 1,
    gap: 3,
  },
  cameraTipMain: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  cameraTipSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
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
  candidateHeader: {
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.sm,
  },
  candidateHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  candidateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  candidateScannedInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  candidateScannedBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  candidateScannedName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
  },
  // selectCandidate step is rendered OUTSIDE the screen-wide ScrollView
  // so we own a flex column here: header (intrinsic) + list (flex: 1)
  // + footer (intrinsic, pinned at bottom).
  selectCandidateLayout: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  candidateList: {
    flex: 1,
    marginTop: spacing.sm,
  },
  candidateListContent: {
    paddingBottom: spacing.sm,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    marginBottom: 8,
    gap: 10,
    ...shadows.card,
  },
  candidateImg: {
    width: 68,
    height: 68,
    borderRadius: 10,
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
    gap: 6,
  },
  candidateCardBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.7,
  },
  candidateCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  candidateTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  candidateTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  candidatePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  candidateFooter: {
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
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
    borderColor: colors.primary + '33',
    backgroundColor: colors.primary + '0D',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  notHereCardPressed: {
    backgroundColor: colors.primary + '14',
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
  capturedChipTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(64,145,108,0.1)',
    borderRadius: radius.medium,
    /* Sit below the header / step indicator so the product chip reads as part of the main column, not stuck under the nav. */
    marginTop: spacing.xxl + spacing.md,
  },
  capturedChipIcon: {
    marginTop: 2,
  },
  capturedChipTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  capturedChipBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  capturedChipName: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.medium,
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.18)',
  },
  modeChipText: {
    ...typography.labelLarge,
    color: colors.primary,
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
  analyzeTimeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xl + spacing.sm,
    marginHorizontal: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.warning + '18',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.warning + '45',
  },
  analyzeTimeHintText: {
    flex: 1,
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  analyzeFooter: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: spacing.xl,
  },
  analyzeFooterLight: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  analyzeFooterTeal: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
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
  illusOuterSmall: {
    alignSelf: 'center',
    width: 130,
    height: 150,
    borderRadius: 16,
    backgroundColor: 'rgba(45,106,79,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  illusDashedFrameSmall: {
    width: 100,
    height: 110,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(45,106,79,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
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
  illusIngLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(45,106,79,0.6)',
  },
  illusIngBar: {
    width: 70,
    height: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(45,106,79,0.2)',
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
  // Zoom modal
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBanner: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.medium,
  },
  zoomBannerText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '500',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 10,
  },
  // Editor styles
  editorContainer: {
    flex: 1,
  },
  editorHeader: {
    backgroundColor: colors.card,
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  editorBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  editorProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  editorCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editorList: {
    flex: 1,
  },
  editorListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    marginBottom: 6,
  },
  editorDragHandle: {
    padding: 6,
  },
  editorRowNum: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 20,
    textAlign: 'center',
  },
  editorRowText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  editorRowActive: {
    backgroundColor: colors.primary,
  },
  editorRowTouched: {
    backgroundColor: colors.safe + '22',
    borderWidth: 1,
    borderColor: colors.safe + '44',
  },
  editorRowTextActive: {
    color: colors.white,
  },
  editorEditBtn: {
    padding: 4,
  },
  editorDeleteBtn: {
    padding: 4,
  },
  editorInlinePanel: {
    backgroundColor: colors.card,
    flexDirection: 'column',
  },
  editorInputDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    zIndex: 3,
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
    ...shadows.card,
  },
  editorSuggestDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    overflow: 'hidden',
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  editorComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    ...shadows.card,
  },
  editorBottomPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: colors.card,
  },
  editorSuggestWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
    flexShrink: 1,
  },
  editorSuggestLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  editorSuggestScrollContent: {
    flexGrow: 0,
  },
  editorSuggestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.card,
  },
  editorSuggestText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  editorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.card,
  },
  editorInputRowKeyboard: {
    paddingBottom: 0,
  },
  editorBottomInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  editorInputBtn: {
    padding: 2,
  },
  editorFooter: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  editorCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editorCancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  editorInsertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginVertical: 2,
  },
  editorInsertBtnActive: {
    paddingVertical: 6,
  },
  editorInsertLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  editorInsertCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 6,
  },
  editorInsertCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  editorConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  editorConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});

// ─── Ingredient Editor Step ───────────────────────────────────────────

interface EditorItem {
  id: string;
  text: string;
}

interface EditorRowProps {
  item: EditorItem;
  index: number;
  editingId: string | null;
  isLastTouched: boolean;
  startEdit: (id: string, text: string) => void;
  removeItem: (id: string) => void;
}

interface EditorInputRowProps {
  inputRef: React.RefObject<TextInput | null>;
  editText: string;
  setEditText: (text: string) => void;
  isAdding: boolean;
  keyboardOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const EditorInputRow = memo(function EditorInputRow({
  inputRef,
  editText,
  setEditText,
  isAdding,
  keyboardOpen,
  onConfirm,
  onCancel,
}: EditorInputRowProps) {
  return (
    <View style={[s.editorInputRow, keyboardOpen && s.editorInputRowKeyboard]}>
      <TextInput
        ref={inputRef}
        style={s.editorBottomInput}
        value={editText}
        onChangeText={setEditText}
        placeholder={isAdding ? 'Add new ingredient...' : 'Edit ingredient...'}
        placeholderTextColor={colors.textSecondary}
        onSubmitEditing={onConfirm}
        returnKeyType="done"
        autoCapitalize="words"
        autoFocus
      />
      <Pressable onPress={onConfirm} hitSlop={8} style={s.editorInputBtn}>
        <Ionicons name={isAdding ? 'add-circle' : 'checkmark-circle'} size={28} color={colors.primary} />
      </Pressable>
      <Pressable onPress={onCancel} hitSlop={8} style={s.editorInputBtn}>
        <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
});

interface EditorSuggestPanelProps {
  suggestLoading: boolean;
  suggestions: string[];
  suggestMaxHeight: number;
  onApplySuggestion: (text: string) => void;
}

const EditorSuggestPanel = memo(function EditorSuggestPanel({
  suggestLoading,
  suggestions,
  suggestMaxHeight,
  onApplySuggestion,
}: EditorSuggestPanelProps) {
  return (
    <View style={[s.editorSuggestWrap, { maxHeight: suggestMaxHeight }]}>
      {suggestLoading ? (
        <View style={s.editorSuggestLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: suggestMaxHeight }}
          contentContainerStyle={s.editorSuggestScrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={suggestions.length > 4}
        >
          {suggestions.map((item, i) => (
            <Pressable
              key={`${i}-${item}`}
              style={({ pressed }) => [s.editorSuggestRow, pressed && { opacity: 0.7 }]}
              onPress={() => onApplySuggestion(item)}
            >
              <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={s.editorSuggestText}>{toIngredientTitleCase(item)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

const EditorRowItem = memo(function EditorRowItem({
  item,
  index: idx,
  editingId,
  isLastTouched,
  startEdit,
  removeItem,
}: EditorRowProps) {
  const drag = useReorderableDrag();
  const isEditing = editingId === item.id;

  return (
    <View style={[
      s.editorRow,
      isLastTouched && !isEditing && s.editorRowTouched,
      isEditing && s.editorRowActive,
    ]}>
      <Pressable onLongPress={drag} style={s.editorDragHandle}>
        <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
      </Pressable>

      <Text style={s.editorRowNum}>{idx + 1}</Text>
      <Text style={[s.editorRowText, isEditing && s.editorRowTextActive]}>
        {toIngredientTitleCase(item.text)}
      </Text>

      <Pressable onPress={() => startEdit(item.id, item.text)} hitSlop={6} style={s.editorEditBtn}>
        <Ionicons name="pencil" size={16} color={isEditing ? colors.white : colors.primary} />
      </Pressable>

      <Pressable onPress={() => removeItem(item.id)} hitSlop={8} style={s.editorDeleteBtn}>
        <Ionicons name="trash-outline" size={18} color={isEditing ? colors.white : colors.danger} />
      </Pressable>
    </View>
  );
});

function IngredientEditorStep({
  ingredients: initialIngredients,
  productName,
  brand,
  onConfirm,
  onCancel,
}: {
  ingredients: string[];
  productName?: string;
  brand?: string;
  onConfirm: (ingredients: string[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<EditorItem[]>(() =>
    initialIngredients.map((text, i) => ({ id: `ing-${i}`, text }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editInputRef = useRef<TextInput>(null);
  const listRef = useRef<any>(null);
  const nextIdRef = useRef(initialIngredients.length);
  const insets = useSafeAreaInsets();

  const isAdding = editingId === '__new__';
  const panelActive = editingId !== null;

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!editingId) {
      setSuggestions([]);
      return;
    }
    const q = editText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const list = await scanService.suggestIngredients(q, 8);
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [editText, editingId]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (editingId === id) { setEditingId(null); setEditText(''); setSuggestions([]); }
    setLastTouchedId(prev => (prev === id ? null : prev));
  }, [editingId]);

  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [lastTouchedId, setLastTouchedId] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputDockHeight, setInputDockHeight] = useState(0);
  const [suggestDockHeight, setSuggestDockHeight] = useState(0);
  const keyboardInsetRef = useRef(0);
  const composerHeightRef = useRef(0);

  const showSuggestions = suggestLoading || suggestions.length > 0;
  const composerHeight = inputDockHeight + (showSuggestions ? suggestDockHeight : 0);

  useEffect(() => {
    composerHeightRef.current = composerHeight;
  }, [composerHeight]);

  const suggestMaxHeight = useMemo(() => {
    const windowH = Dimensions.get('window').height;
    const chrome = 190 + insets.top;
    const inputRow = 68;
    const available = windowH - keyboardInset - chrome - inputRow;
    return Math.max(180, Math.min(360, available));
  }, [keyboardInset, insets.top]);

  const composerBottom = keyboardInset > 0
    ? Math.max(0, keyboardInset - insets.bottom)
    : insets.bottom;


  useEffect(() => {
    if (!panelActive) {
      setKeyboardInset(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const windowH = Dimensions.get('window').height;
      const height = Platform.OS === 'android'
        ? windowH - e.endCoordinates.screenY
        : e.endCoordinates.height;
      keyboardInsetRef.current = height;
      setKeyboardInset(height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardInsetRef.current = 0;
      setKeyboardInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [panelActive]);

  useEffect(() => {
    if (!showSuggestions) setSuggestDockHeight(0);
  }, [showSuggestions]);

  const startEdit = useCallback((id: string, text: string) => {
    setInsertIndex(null);
    setEditingId(id);
    setEditText(text);
  }, []);

  const scrollToInsertedItem = useCallback((_index: number, _itemCount: number) => {}, []);

  const onScrollToIndexFailed = useCallback(() => {}, []);

  const startAdd = useCallback((afterIndex: number) => {
    setInsertIndex(afterIndex);
    setEditingId('__new__');
    setEditText('');
  }, []);

  const confirmEdit = useCallback(() => {
    if (editingId === null) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditText('');
      setSuggestions([]);
      setInsertIndex(null);
      Keyboard.dismiss();
      return;
    }
    if (isAdding) {
      const newId = `ing-${nextIdRef.current++}`;
      const pos = insertIndex ?? items.length;
      setItems(prev => [...prev.slice(0, pos), { id: newId, text: trimmed }, ...prev.slice(pos)]);
      setLastTouchedId(newId);
      scrollToInsertedItem(pos, items.length + 1);
    } else {
      setItems(prev => prev.map(it => it.id === editingId ? { ...it, text: trimmed } : it));
      setLastTouchedId(editingId);
    }
    setEditingId(null);
    setEditText('');
    setSuggestions([]);
    setInsertIndex(null);
    Keyboard.dismiss();
  }, [editingId, editText, isAdding, insertIndex, items.length, scrollToInsertedItem]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
    setSuggestions([]);
    setInsertIndex(null);
    Keyboard.dismiss();
  }, []);

  const applySuggestion = useCallback((text: string) => {
    if (editingId === null) return;
    if (isAdding) {
      const newId = `ing-${nextIdRef.current++}`;
      const pos = insertIndex ?? items.length;
      setItems(prev => [...prev.slice(0, pos), { id: newId, text }, ...prev.slice(pos)]);
      setLastTouchedId(newId);
      scrollToInsertedItem(pos, items.length + 1);
    } else {
      setItems(prev => prev.map(it => it.id === editingId ? { ...it, text } : it));
      setLastTouchedId(editingId);
    }
    setEditingId(null);
    setEditText('');
    setSuggestions([]);
    setInsertIndex(null);
    Keyboard.dismiss();
  }, [editingId, isAdding, insertIndex, items.length, scrollToInsertedItem]);

  const handleReorder = useCallback(({ from, to }: ReorderableListReorderEvent) => {
    setItems(prev => reorderItems(prev, from, to));
  }, []);

  const renderItem = useCallback(({ item, index }: { item: EditorItem; index: number }) => (
    <View>
      <EditorRowItem
        item={item}
        index={index}
        editingId={editingId}
        isLastTouched={lastTouchedId === item.id}
        startEdit={startEdit}
        removeItem={removeItem}
      />
      <Pressable
        style={[
          s.editorInsertBtn,
          insertIndex === index + 1 && isAdding && s.editorInsertBtnActive,
        ]}
        onPress={() => startAdd(index + 1)}
        hitSlop={{ top: 6, bottom: 6 }}
      >
        <View style={s.editorInsertLine} />
        <View style={[
          s.editorInsertCircle,
          insertIndex === index + 1 && isAdding && s.editorInsertCircleActive,
        ]}>
          <Ionicons name="add" size={12} color={insertIndex === index + 1 && isAdding ? colors.white : colors.textSecondary} />
        </View>
        <View style={s.editorInsertLine} />
      </Pressable>
    </View>
  ), [editingId, startEdit, removeItem, startAdd, insertIndex, isAdding, lastTouchedId]);

  return (
    <View style={s.editorContainer}>
      <View style={s.editorHeader}>
        {brand ? <Text style={s.editorBrand}>{formatProductTitleText(brand)}</Text> : null}
        <Text style={s.editorProductName}>
          {formatProductTitleText(productName ?? 'Product')}
        </Text>
        <Text style={s.editorCount}>{items.length} ingredients — hold to reorder</Text>
      </View>

      <ReorderableList
        ref={listRef}
        data={items}
        onReorder={handleReorder}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={s.editorList}
        contentContainerStyle={[
          s.editorListContent,
          { paddingBottom: 320 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollToIndexFailed={onScrollToIndexFailed}
        ListHeaderComponent={
          <Pressable
            style={[
              s.editorInsertBtn,
              insertIndex === 0 && isAdding && s.editorInsertBtnActive,
            ]}
            onPress={() => startAdd(0)}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <View style={s.editorInsertLine} />
            <View style={[
              s.editorInsertCircle,
              insertIndex === 0 && isAdding && s.editorInsertCircleActive,
            ]}>
              <Ionicons name="add" size={12} color={insertIndex === 0 && isAdding ? colors.white : colors.textSecondary} />
            </View>
            <View style={s.editorInsertLine} />
          </Pressable>
        }
      />

      {panelActive && (
        <>
          {showSuggestions && (
            <View
              style={[
                s.editorSuggestDock,
                {
                  bottom: composerBottom + Math.max(inputDockHeight, 68),
                  maxHeight: suggestMaxHeight,
                },
              ]}
              onLayout={(e) => setSuggestDockHeight(e.nativeEvent.layout.height)}
            >
              <EditorSuggestPanel
                suggestLoading={suggestLoading}
                suggestions={suggestions}
                suggestMaxHeight={suggestMaxHeight}
                onApplySuggestion={applySuggestion}
              />
            </View>
          )}
          <View
            style={[s.editorInputDock, { bottom: composerBottom }]}
            onLayout={(e) => setInputDockHeight(e.nativeEvent.layout.height)}
          >
            <EditorInputRow
              key={`${editingId}-${insertIndex}`}
              inputRef={editInputRef}
              editText={editText}
              setEditText={setEditText}
              isAdding={isAdding}
              keyboardOpen={keyboardInset > 0}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
            />
          </View>
        </>
      )}

      {!panelActive && (
        <View style={s.editorFooter}>
          <Pressable onPress={onCancel} style={s.editorCancelBtn}>
            <Text style={s.editorCancelText}>Re-scan</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(items.map(it => it.text))}
            style={[s.editorConfirmBtn, items.length === 0 && { opacity: 0.4 }]}
            disabled={items.length === 0}
          >
            <Text style={s.editorConfirmText}>Confirm & Analyze</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
