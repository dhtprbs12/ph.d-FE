import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SortableList, DragHandle } from '@botjaeger/expo-dnd';
import type { HomeStackParamList } from '../navigation/types';
import * as scanService from '../services/scanService';
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
import { buildImageUrl, formatProductTitleText } from '../utils/helpers';
import { pollUntilComplete } from '../utils/analysisPoll';
import {
  clearPendingAnalysisScan,
  loadPendingAnalysisScan,
  savePendingAnalysisScan,
} from '../utils/pendingAnalysisScan';

type ScanStep =
  | 'front'
  | 'selectCandidate'
  | 'back'
  | 'manualIngredients'
  | 'editor'
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

export function TwoStepScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'TwoStepScan'>>();
  const { selectedPet } = useApp();
  const pet = selectedPet;

  const packageShapeRef = useRef<PackageShape | null>(null);
  const manualReturnStepRef = useRef<'front' | 'selectCandidate'>('front');

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
  const [analyzeLabels, setAnalyzeLabels] = useState([
    'Reading ingredients',
    'Checking database',
    'Scoring',
    'Generating report',
  ]);
  const [ingredientsForEditor, setIngredientsForEditor] = useState<string[]>([]);

  const showLoadingOverlay = processing && step !== 'analyzing' && step !== 'manualIngredients' && step !== 'editor';

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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runPoll, finishWithResult]);

  /** Shared front-scan tail: metadata + candidate list or straight to back step. */
  const applyFrontResult = useCallback(async (res: ScanFrontResponse) => {
    setPendingScanId(res.pendingScanId ?? null);
    packageShapeRef.current = res.captured?.packageShape ?? null;
    setFrontMeta({
      productName: res.captured?.productName,
      brand: res.captured?.brand,
      productType: res.captured?.productType,
    });

    // DB match found — go directly to analysis
    if (
      (res.matchType === 'exact' || res.matchType === 'fuzzy') &&
      res.product?.id &&
      pet
    ) {
      setFrontMeta({
        productName: res.product.name ?? res.captured?.productName,
        brand: res.product.brand ?? res.captured?.brand,
        productType: res.product.productType ?? res.captured?.productType,
      });
      setAnalyzeLabels([
        'Loading ingredients',
        'Checking database',
        'Scoring',
        'Generating report',
      ]);
      setStep('analyzing');
      setProcessing(false);
      try {
        const body = petToQuickAnalyzeBody(pet, res.product.id);
        const raw = await scanService.quickAnalyze(body);
        const scanId = extractScanId(raw);
        const result = await runPoll(scanId);
        finishWithResult(result);
      } catch (e) {
        console.warn('[SCAN] DB match quick-analyze failed:', e);
        setStep('back');
      }
      return;
    }

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
  }, [pet, runPoll, finishWithResult]);

  const onFrontCapture = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(true);
    if (!uri) return;
    setProcessing(true);
    try {
      const res = await scanService.scanFrontLabel(uri);
      applyFrontResult(res);
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessing(false);
    }
  }, [pet, pickImage, applyFrontResult]);

  const onFrontLibrary = useCallback(async () => {
    if (!pet) return;
    const uri = await pickImage(false);
    if (!uri) return;
    setProcessing(true);
    try {
      const res = await scanService.scanFrontLabel(uri);
      applyFrontResult(res);
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessing(false);
    }
  }, [pet, pickImage, applyFrontResult]);

  const onSelectCandidate = useCallback(
    async (c: ProductCandidate) => {
      if (!pet || !pendingScanId) return;
      setProcessing(true);
      setFrontMeta({ productName: c.name, brand: c.brand, productType: c.productType ?? c.product_type });
      setAnalyzeLabels([
        'Loading ingredients',
        'Checking database',
        'Scoring',
        'Generating report',
      ]);
      try {
        const body = petToQuickAnalyzeBody(pet, c.id);
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

  const onEditorConfirm = useCallback(async (confirmedIngredients: string[]) => {
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
  }, [pet, pendingScanId, frontMeta, runPoll, finishWithResult]);

  const step1Active = step === 'front';
  const step1Complete = step !== 'front';
  const step2Active = step === 'back' || step === 'manualIngredients' || step === 'editor';
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
          <StepIndicator number={1} title="Identify" subtitle="" isActive={step1Active} isComplete={step1Complete} />
          <View style={[s.progressBar, barActive && s.progressBarActive]} />
          <StepIndicator number={2} title="Ingredients" subtitle="" isActive={step2Active} isComplete={step2Complete} />
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
            {(frontMeta.brand || frontMeta.productName) && (
              <Text style={s.candidateSubtitle} numberOfLines={1}>
                Matches for "
                {[frontMeta.brand, frontMeta.productName]
                  .filter(Boolean)
                  .map((x) => formatProductTitleText(String(x)))
                  .join(' ')}
                "
              </Text>
            )}
          </View>
          <ScrollView
            style={s.candidateList}
            contentContainerStyle={s.candidateListContent}
            showsVerticalScrollIndicator
          >
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
                  <View style={{ flex: 1, gap: 2 }}>
                    {c.brand ? (
                      <Text style={s.candidateCardBrand} numberOfLines={1}>{formatProductTitleText(c.brand)}</Text>
                    ) : null}
                    <Text style={s.candidateCardName} numberOfLines={3}>
                      {formatProductTitleText(c.name ?? 'Unknown Product')}
                    </Text>
                    {(c.productType ?? c.product_type) ? (
                      <View style={s.candidateTypePill}>
                        <Text style={s.candidateTypeText}>
                          {(c.productType ?? c.product_type ?? '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
        <IngredientEditorStep
          ingredients={ingredientsForEditor}
          productName={frontMeta.productName}
          brand={frontMeta.brand}
          onConfirm={onEditorConfirm}
          onCancel={() => setStep('back')}
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
              <Text style={s.stepTitle}>Identify</Text>
            </View>
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
            {(frontMeta.brand || frontMeta.productName) && (
              <View style={s.capturedChipTop}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.safe}
                  style={s.capturedChipIcon}
                />
                <View style={s.capturedChipTextCol}>
                  {frontMeta.brand ? (
                    <Text style={s.capturedChipBrand} numberOfLines={1}>
                      {formatProductTitleText(frontMeta.brand)}
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
            {(frontMeta.brand || frontMeta.productName) && (
              <View style={s.analyzingCard}>
                {frontMeta.brand ? (
                  <Text style={s.analyzingBrand}>{formatProductTitleText(frontMeta.brand)}</Text>
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
            <View style={s.spacer} />
            <View style={s.analyzeFooter}>
              <Text style={s.analyzeFooterLight}>
                You can switch apps — we'll pick up when you return
              </Text>
              <Text style={s.analyzeFooterLight}>
                First-time scans take longer while we build the analysis
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
  candidateSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
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
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(45,106,79,0.08)',
    marginTop: 3,
  },
  candidateTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  candidateFooter: {
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
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
  // Editor styles
  editorContainer: {
    flex: 1,
  },
  editorHeader: {
    backgroundColor: colors.card,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  editorBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  editorProductName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  editorCount: {
    fontSize: 13,
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
  editorEditRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorEditInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
  },
  editorEditBtn: {
    padding: 4,
  },
  editorDeleteBtn: {
    padding: 4,
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

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const startEdit = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  }, []);

  const confirmEdit = useCallback(() => {
    if (editingId === null) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setItems(prev => prev.map(it => it.id === editingId ? { ...it, text: trimmed } : it));
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleReorder = useCallback((reordered: EditorItem[]) => {
    setItems(reordered);
  }, []);

  return (
    <View style={s.editorContainer}>
      <View style={s.editorHeader}>
        {brand ? <Text style={s.editorBrand}>{formatProductTitleText(brand)}</Text> : null}
        <Text style={s.editorProductName}>
          {formatProductTitleText(productName ?? 'Product')}
        </Text>
        <Text style={s.editorCount}>{items.length} ingredients — hold grip to reorder</Text>
      </View>

      <View style={s.editorList}>
        <SortableList<EditorItem>
          data={items}
          keyExtractor={(item) => item.id}
          onReorder={handleReorder}
          handle
          longPressDuration={150}
          activeDragStyle={{ opacity: 0.5 }}
          renderItem={({ item, index: idx }) => (
            <View style={s.editorRow}>
              <DragHandle>
                <View style={s.editorDragHandle}>
                  <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
                </View>
              </DragHandle>

              <Text style={s.editorRowNum}>{idx + 1}</Text>

              {editingId === item.id ? (
                <View style={s.editorEditRow}>
                  <TextInput
                    style={s.editorEditInput}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    onSubmitEditing={confirmEdit}
                    returnKeyType="done"
                  />
                  <Pressable onPress={confirmEdit} hitSlop={6}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={cancelEdit} hitSlop={6}>
                    <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <Text style={s.editorRowText} numberOfLines={2}>{item.text}</Text>
              )}

              {editingId !== item.id && (
                <Pressable onPress={() => startEdit(item.id, item.text)} hitSlop={6} style={s.editorEditBtn}>
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                </Pressable>
              )}

              <Pressable onPress={() => removeItem(item.id)} hitSlop={8} style={s.editorDeleteBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          )}
        />
      </View>

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
    </View>
  );
}
