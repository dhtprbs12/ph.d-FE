import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { HomeStackParamList } from '../navigation/types';
import type { Pet, ScanResult } from '../types';
import { colors, radius, shadows, spacing, typography } from '../theme';
import * as scanService from '../services/scanService';
import { formatProductTitleText } from '../utils/helpers';
import { useApp } from '../context/AppContext';

export type ManualProductFormType = 'food' | 'treats';

export type ManualProductHint = {
  brand?: string;
  productName?: string;
  productType?: string;
};

/** Map front-label / filter hints to manual scan productType (cache key). */
export function normalizeProductTypeFromHint(raw?: string | null): ManualProductFormType | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.toLowerCase();
  if (s.includes('treat') || s.includes('snack') || s.includes('chew') || s.includes('jerky')) {
    return 'treats';
  }
  if (s.includes('food') || s.includes('kibble') || s.includes('meal') || s.includes('canned') || s.includes('wet')) {
    return 'food';
  }
  return null;
}

type FlowMode = 'standalone' | 'scan';

export type ManualIngredientsFlowProps = {
  mode: FlowMode;
  /** When true, no Back / title row (e.g. embedded under Scan Product header). */
  hideNavBar?: boolean;
  /** Short explainer above the form (e.g. round pack → manual entry). */
  entryExplainer?: string;
  productHint?: ManualProductHint;
  pet: Pet;
  onSuccess: (result: ScanResult) => void;
  onCancel: () => void;
};

/**
 * Enter ingredients one line at a time (label order).
 * Used from Home ("ingredients only") and from TwoStepScan when package shape is round.
 */
export function ManualIngredientsFlow({
  mode,
  hideNavBar = false,
  entryExplainer,
  productHint,
  pet,
  onSuccess,
  onCancel,
}: ManualIngredientsFlowProps) {
  void mode;
  const [productForm, setProductForm] = useState<ManualProductFormType>(
    () => normalizeProductTypeFromHint(productHint?.productType) ?? 'food'
  );
  const [lines, setLines] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const analyzeInFlight = useRef(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = draft.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const list = await scanService.suggestIngredients(q, 18);
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 320);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [draft]);

  const addLine = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setLines((prev) => [...prev, t]);
    setDraft('');
    setSuggestions([]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveLineToDraft = useCallback((index: number) => {
    setLines((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) setDraft(removed);
      return copy;
    });
    setSuggestions([]);
  }, []);

  const onAnalyze = useCallback(async () => {
    const tail = draft.trim();
    const effectiveLines = tail ? [...lines, tail] : lines;
    if (effectiveLines.length === 0 || analyzeInFlight.current) return;
    analyzeInFlight.current = true;
    setSubmitting(true);
    const ingredientsText = effectiveLines.map((l) => l.trim()).filter(Boolean).join(', ');
    try {
      const productName =
        productHint?.brand || productHint?.productName
          ? [productHint?.brand, productHint?.productName].filter(Boolean).join(' ').trim()
          : undefined;
      const result = await scanService.scanManual({
        ingredientsText,
        productType: productForm,
        productName,
        petName: pet.name,
        petType: pet.pet_type,
        petAllergies: [],
        petHealthConditions: (pet.healthConditions ?? []).map((c) => ({
          condition_type: c.condition_type,
          severity: c.severity,
          ...(c.notes ? { notes: c.notes } : {}),
        })),
      });
      setDraft('');
      onSuccess(result);
    } catch (e) {
      console.warn('[ManualIngredients] analyze failed', e);
    } finally {
      analyzeInFlight.current = false;
      setSubmitting(false);
    }
  }, [lines, draft, pet, productHint, productForm, onSuccess]);

  const title = 'Ingredients';
  const canAnalyze = (lines.length > 0 || draft.trim().length > 0) && !submitting;

  /** Nested under Scan Product: plain View + minHeight 0 so ScrollView gets a bounded height and can scroll. */
  const body = (
    <KeyboardAvoidingView
      style={st.fillShrink}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {!hideNavBar ? (
        <View style={st.navBar}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={st.cancelText}>Back</Text>
          </Pressable>
          <Text style={st.navTitle}>{title}</Text>
          <View style={{ width: 56 }} />
        </View>
      ) : null}

      <ScrollView
        style={st.fillShrink}
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
      >
          {hideNavBar && entryExplainer ? (
            <View style={st.entryExplainer}>
              <Ionicons name="warning-outline" size={20} color={colors.danger} style={st.entryExplainerIcon} />
              <View style={st.entryExplainerBody}>
                <Text style={st.entryExplainerText}>{entryExplainer}</Text>
              </View>
            </View>
          ) : null}
          {(productHint?.brand || productHint?.productName) && (
            <View style={st.hintCard}>
              <Ionicons name="pricetag-outline" size={20} color={colors.textSecondary} style={st.hintIcon} />
              <View style={{ flex: 1, minWidth: 0 }}>
                {productHint.brand ? (
                  <Text style={st.hintBrand} numberOfLines={1}>
                    {formatProductTitleText(productHint.brand)}
                  </Text>
                ) : null}
                <Text style={st.hintName} numberOfLines={2}>
                  {formatProductTitleText(productHint.productName ?? '')}
                </Text>
              </View>
            </View>
          )}

          <View style={st.typeSegment} accessibilityRole="tablist">
            <Pressable
              onPress={() => setProductForm('food')}
              style={[st.typeSegCell, productForm === 'food' && st.typeSegCellOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: productForm === 'food' }}
              accessibilityLabel="Food"
            >
              <Text style={[st.typeSegText, productForm === 'food' && st.typeSegTextOn]}>Food</Text>
            </Pressable>
            <Pressable
              onPress={() => setProductForm('treats')}
              style={[st.typeSegCell, productForm === 'treats' && st.typeSegCellOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: productForm === 'treats' }}
              accessibilityLabel="Treats"
            >
              <Text style={[st.typeSegText, productForm === 'treats' && st.typeSegTextOn]}>Treats</Text>
            </Pressable>
          </View>

          <View style={st.inputRow}>
            <TextInput
              style={st.inputFlex}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ingredient"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => addLine(draft)}
            />
            <Pressable
              style={[st.addIconBtn, !draft.trim() && st.addIconBtnDisabled]}
              disabled={!draft.trim()}
              onPress={() => addLine(draft)}
              accessibilityRole="button"
              accessibilityLabel="Add"
            >
              <Ionicons name="add" size={28} color={colors.white} />
            </Pressable>
          </View>

          {draft.trim().length > 0 && (suggestLoading || suggestions.length > 0) ? (
            <View style={st.suggestWrap}>
              {suggestLoading ? (
                <View style={st.suggestLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={suggestions}
                  keyExtractor={(item, i) => `${i}-${item}`}
                  scrollEnabled={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [st.suggestRow, pressed && { opacity: 0.85 }]}
                      onPress={() => addLine(item)}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.textSecondary} />
                      <Text style={st.suggestText}>{item}</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          ) : null}

          {lines.length > 0 ? (
            <View style={st.lineList}>
              {lines.map((line, index) => (
                <View key={`${index}-${line.slice(0, 24)}`} style={st.lineRow}>
                  <Text style={st.lineIndex}>{index + 1}</Text>
                  <Text style={st.lineText} numberOfLines={3}>
                    {line}
                  </Text>
                  <Pressable
                    onPress={() => moveLineToDraft(index)}
                    hitSlop={8}
                    accessibilityLabel="Edit line"
                  >
                    <Ionicons name="pencil" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeLine(index)}
                    hitSlop={8}
                    accessibilityLabel="Remove line"
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[st.analyzeBtn, !canAnalyze && st.analyzeBtnMuted]}
            disabled={!canAnalyze}
            onPress={onAnalyze}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="analytics"
                  size={22}
                  color={canAnalyze ? colors.white : colors.textSecondary}
                />
                <Text style={[st.analyzeBtnText, !canAnalyze && st.analyzeBtnTextMuted]}>Analyze</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
    </KeyboardAvoidingView>
  );

  return hideNavBar ? (
    <View style={[st.safe, st.fillShrink]}>{body}</View>
  ) : (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      {body}
    </SafeAreaView>
  );
}

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ManualIngredients'>;

export function ManualIngredientsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ManualIngredients'>>();
  const { selectedPet } = useApp();
  const hint = route.params?.productHint;

  if (!selectedPet) {
    return (
      <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
        <View style={st.navBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={st.cancelText}>Back</Text>
          </Pressable>
          <Text style={st.navTitle}>Ingredients</Text>
          <View style={{ width: 56 }} />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Text style={typography.bodyMedium}>Add a pet in the Pets tab to run analysis.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ManualIngredientsFlow
      mode="standalone"
      productHint={hint}
      pet={selectedPet}
      onSuccess={(result) =>
        navigation.replace('Result', { scanResult: result, suppressProductImage: true })
      }
      onCancel={() => navigation.goBack()}
    />
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  /** Lets ScrollView shrink inside a flex parent so content taller than the viewport scrolls. */
  fillShrink: { flex: 1, minHeight: 0 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: { fontSize: 16, color: colors.primary },
  navTitle: { ...typography.titleLarge, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  entryExplainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(231, 111, 81, 0.14)',
    borderRadius: radius.medium,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(231, 111, 81, 0.45)',
  },
  entryExplainerIcon: { marginTop: 0 },
  entryExplainerBody: { flex: 1 },
  entryExplainerText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    padding: 3,
    gap: 3,
  },
  typeSegCell: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.small,
  },
  typeSegCellOn: {
    backgroundColor: colors.card,
    ...shadows.cardSecondary,
  },
  typeSegText: { ...typography.labelLarge, color: colors.textSecondary, fontWeight: '600' },
  typeSegTextOn: { color: colors.textPrimary },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.md,
    ...shadows.card,
  },
  hintIcon: { marginTop: 2 },
  hintBrand: { ...typography.labelSmall, color: colors.textSecondary },
  hintName: { ...typography.bodyLarge, fontWeight: '600', color: colors.textPrimary },
  lineList: { gap: spacing.xs, marginTop: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.sm,
    ...shadows.card,
  },
  lineIndex: {
    ...typography.labelMedium,
    fontWeight: '800',
    color: colors.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  lineText: { flex: 1, ...typography.bodyMedium, color: colors.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputFlex: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  addIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  addIconBtnDisabled: { opacity: 0.38 },
  suggestWrap: {
    borderRadius: radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  suggestLoadingRow: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  suggestText: { flex: 1, ...typography.bodyMedium, color: colors.textPrimary },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  analyzeBtnMuted: {
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.divider,
    elevation: 0,
    shadowOpacity: 0,
  },
  analyzeBtnText: { ...typography.labelLarge, color: colors.white, fontWeight: '700' },
  analyzeBtnTextMuted: { color: colors.textSecondary },
});
