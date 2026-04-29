import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  InteractionManager,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HistoryStackParamList, HomeStackParamList } from '../navigation/types';
import * as productService from '../services/productService';
import * as scanService from '../services/scanService';
import { useApp } from '../context/AppContext';
import {
  colors,
  getGradeColor,
  getGradeDescription,
  getPetTypeIcon,
  getRiskColor,
  radius,
  shadows,
  spacing,
  typography,
} from '../theme';
import type { AlternativeProduct, ConditionWarning, IngredientAnalysis, ScanResult } from '../types';
import { formatCommunityScans } from '../types';
import { buildImageUrl, productTypeLabel } from '../utils/helpers';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RING_SIZE = 140;
const RING_STROKE = 12;
const R = (RING_SIZE - RING_STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type ResultNav = NativeStackNavigationProp<HomeStackParamList, 'Result'>;

const APP_BRAND = 'Pet Health Director';
/** R2 public URL — same `https` path as product images so view-shot captures the logo reliably. */
const SHARE_LOGO_URL = 'https://pub-0347a0ad0d884e88b6927852b80505c5.r2.dev/products/logo.png';

/* ---------- Product type helpers ---------- */
function productTypePillLabel(type?: string): string {
  switch (type) {
    case 'dry_food': return '🥣 Dry Food';
    case 'wet_food': return '🥫 Wet Food';
    case 'treats': return '🦴 Treat';
    case 'supplement': return '💊 Supplement';
    default: return '🍽️ Food';
  }
}
function productTypePillColor(type?: string): string {
  switch (type) {
    case 'supplement': return '#9C27B0';
    case 'treats': return '#FF9800';
    case 'wet_food': return '#2196F3';
    case 'dry_food': return '#795548';
    default: return '#9E9E9E';
  }
}

/** Off-screen share card width (taller share story feel via content + padding; height is intrinsic). */
const SHARE_PNG_W = 400;

/** Collapse whitespace for share PNG; no "…" character cap — card grows in height. */
function pngShareText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const ResultSharePngCard = React.forwardRef<
  View,
  { scanResult: ScanResult }
>(function ResultSharePngCard({ scanResult }, ref) {
    const logoSource = { uri: SHARE_LOGO_URL };
    const p = scanResult.product;
    const a = scanResult.analysis;
    const pet = scanResult.pet;
    const ai = scanResult.aiInsights;
    const name = p?.name ?? scanResult.extracted?.productName ?? 'Product';
    const brand = p?.brand ?? scanResult.extracted?.brand;
    const score = Math.round(a?.finalScore ?? 0);
    const grade = (a?.grade ?? '—').toString().toUpperCase();
    const gDesc = getGradeDescription(grade);
    const gColor = getGradeColor(grade);
    const benefits = (ai?.topBenefits?.length ? ai.topBenefits : a?.positives) ?? [];
    const concerns = (ai?.topConcerns?.length ? ai.topConcerns : a?.keyIssues) ?? [];
    const goodLines = benefits
      .map(x => pngShareText(String(x)))
      .filter(line => line.length > 0);
    const watchLines = concerns
      .map(x => pngShareText(String(x)))
      .filter(line => line.length > 0);
    const summaryBlurb =
      (typeof a?.summary === 'string' && a.summary.trim()) || ai?.personalizedSummary?.trim() || '';
    const summaryLine = summaryBlurb ? pngShareText(summaryBlurb) : '';
    const hasListQuick = goodLines.length > 0 || watchLines.length > 0;
    const hasQuick = hasListQuick || !!summaryLine;
    const condRaw = ai?.conditionWarnings ?? [];
    const healthLines = condRaw
      .map((w) => {
        if (w.message?.trim()) return pngShareText(w.message.trim());
        return pngShareText(
          [w.conditionLabel || w.condition, w.ingredient].filter(Boolean).join(' · ') || String(w.condition ?? '')
        );
      })
      .filter(line => line.length > 0);
    const hasHealth = healthLines.length > 0;
    const thumbUri = buildImageUrl(p?.imageUrl ?? p?.image_url) ?? null;
    const rawProductType = p?.productType ?? p?.product_type;
    const pType = rawProductType ? productTypeLabel(rawProductType) : '';

    return (
      <View ref={ref} collapsable={false} style={sharePngStyles.wrap}>
        <View style={sharePngStyles.card}>
          <LinearGradient
            colors={[gColor, `${gColor}E6`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={sharePngStyles.hero}
          >
            <View style={sharePngStyles.heroBrandRow}>
              <View style={sharePngStyles.heroLogoMat} collapsable={false}>
                <Image
                  key="share-logo-hero"
                  source={logoSource}
                  style={sharePngStyles.heroLogoImg}
                  resizeMode="cover"
                  fadeDuration={Platform.OS === 'android' ? 0 : 300}
                  accessibilityLabel={APP_BRAND}
                />
              </View>
              <View style={sharePngStyles.heroBrandText}>
                <Text style={sharePngStyles.heroKicker} allowFontScaling={false}>
                  {APP_BRAND}
                </Text>
                <Text style={sharePngStyles.heroTitle} allowFontScaling={false}>
                  Pet food check
                </Text>
              </View>
            </View>
            <View style={sharePngStyles.heroStatRow}>
              <Text style={sharePngStyles.heroScore} allowFontScaling={false}>
                {score}
              </Text>
              <View style={sharePngStyles.heroStatMid}>
                <Text style={sharePngStyles.heroOutOf} allowFontScaling={false}>/ 100</Text>
                <View style={sharePngStyles.gradePillLight}>
                  <Text style={sharePngStyles.gradePillTxt} allowFontScaling={false}>
                    Grade {grade}
                  </Text>
                </View>
              </View>
            </View>
            {gDesc ? (
              <Text style={sharePngStyles.heroGDesc} allowFontScaling={false}>
                {gDesc}
              </Text>
            ) : null}
          </LinearGradient>

          <View style={sharePngStyles.sheet}>
            <View style={sharePngStyles.block}>
              <Text style={sharePngStyles.blockLabel} allowFontScaling={false}>
                PRODUCT
              </Text>
              <View style={sharePngStyles.productBox}>
                <View style={sharePngStyles.productRow}>
                  {thumbUri ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={sharePngStyles.productThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={sharePngStyles.productThumbPlaceholder}>
                      <Text style={sharePngStyles.productThumbPhTxt} allowFontScaling={false}>
                        🍽
                      </Text>
                    </View>
                  )}
                  <View style={sharePngStyles.productTextCol}>
                    {brand ? (
                      <Text style={sharePngStyles.pBrand} allowFontScaling={false} numberOfLines={1}>
                        {brand.toUpperCase()}
                      </Text>
                    ) : null}
                    <Text style={sharePngStyles.pNameFieldLabel} allowFontScaling={false}>
                      Product name
                    </Text>
                    <Text style={sharePngStyles.pName} allowFontScaling={false}>
                      {name}
                    </Text>
                    {pType ? (
                      <Text style={sharePngStyles.pType} allowFontScaling={false} numberOfLines={1}>
                        {pType}
                      </Text>
                    ) : null}
                    {pet?.name ? (
                      <Text style={sharePngStyles.pPet} allowFontScaling={false}>
                        {pet.name}  ·  {pet.petType === 'cat' ? 'cat' : 'dog'}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            {hasQuick ? (
              <View style={sharePngStyles.block}>
                <Text style={sharePngStyles.blockLabel} allowFontScaling={false}>
                  QUICK VERDICT
                </Text>
                {!hasListQuick && summaryLine ? (
                  <View style={sharePngStyles.neutralBox}>
                    <Text style={sharePngStyles.subLabel} allowFontScaling={false}>Summary</Text>
                    <Text style={sharePngStyles.bulletOk} allowFontScaling={false}>
                      {summaryLine}
                    </Text>
                  </View>
                ) : null}
                {goodLines.length > 0 ? (
                  <View style={sharePngStyles.goodBox}>
                    <Text style={sharePngStyles.subLabel} allowFontScaling={false}>Pluses</Text>
                    {goodLines.map((line, i) => (
                      <Text
                        key={`g${i}`}
                        style={sharePngStyles.bulletOk}
                        allowFontScaling={false}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {watchLines.length > 0 ? (
                  <View style={sharePngStyles.warnBox}>
                    <Text style={sharePngStyles.subLabel} allowFontScaling={false}>Watch</Text>
                    {watchLines.map((line, i) => (
                      <Text
                        key={`w${i}`}
                        style={sharePngStyles.bulletWarn}
                        allowFontScaling={false}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {hasHealth ? (
              <View style={sharePngStyles.block}>
                <Text style={sharePngStyles.blockLabel} allowFontScaling={false}>
                  HEALTH (YOUR PET)
                </Text>
                <View style={sharePngStyles.alertBox}>
                  {healthLines.map((line, i) => (
                    <Text
                      key={`h${i}`}
                      style={sharePngStyles.bulletAlert}
                      allowFontScaling={false}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <View style={sharePngStyles.footBar}>
            <View style={sharePngStyles.footLogoMat} collapsable={false}>
              <Image
                key="share-logo-foot"
                source={logoSource}
                style={sharePngStyles.footLogoImg}
                resizeMode="cover"
                fadeDuration={Platform.OS === 'android' ? 0 : 300}
                accessibilityLabel={APP_BRAND}
              />
            </View>
            <Text style={sharePngStyles.footText} allowFontScaling={false}>
              {APP_BRAND}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

const sharePngStyles = StyleSheet.create({
  wrap: { width: SHARE_PNG_W, alignSelf: 'flex-start' as const },
  card: {
    width: SHARE_PNG_W,
    backgroundColor: colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  heroBrandRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  /** No white mat — R2 logo is full-bleed; let it fill the clip on the gradient. */
  heroLogoMat: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'transparent',
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroLogoImg: { width: 48, height: 48 },
  heroBrandText: { flex: 1, minWidth: 0, justifyContent: 'center' as const },
  heroKicker: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.4 },
  heroTitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  heroScore: { fontSize: 48, fontWeight: '800', color: colors.white, letterSpacing: -1, lineHeight: 52 },
  heroStatMid: { justifyContent: 'center', gap: 6, paddingTop: 4 },
  heroOutOf: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  gradePillLight: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'flex-start',
  },
  gradePillTxt: { fontSize: 12, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  heroGDesc: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.95)', marginTop: 6 },
  sheet: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 14 },
  productBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  productRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 14 },
  productThumb: {
    width: 128,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
  },
  productThumbPlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  productThumbPhTxt: { fontSize: 36, lineHeight: 40 },
  productTextCol: { flex: 1, minWidth: 0 },
  pBrand: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 6 },
  pNameFieldLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  pName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  pType: { fontSize: 9, color: colors.textSecondary, fontWeight: '600', marginTop: 4 },
  pPet: { fontSize: 10, color: colors.textSecondary, marginTop: 6, fontWeight: '500' },
  block: { gap: 8 },
  blockLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  subLabel: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, marginBottom: 4, opacity: 0.95 },
  neutralBox: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(0,0,0,0.18)',
    padding: 10,
    paddingLeft: 12,
    gap: 2,
  },
  goodBox: {
    backgroundColor: 'rgba(64,145,108,0.1)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.safe,
    padding: 10,
    paddingLeft: 12,
    gap: 8,
  },
  warnBox: {
    backgroundColor: 'rgba(233,196,106,0.12)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.caution,
    padding: 10,
    paddingLeft: 12,
    gap: 8,
    marginTop: 2,
  },
  bulletOk: { fontSize: 12, lineHeight: 17, color: colors.textPrimary, fontWeight: '500' },
  bulletWarn: { fontSize: 12, lineHeight: 17, color: colors.textPrimary, fontWeight: '500' },
  alertBox: {
    backgroundColor: 'rgba(231,111,81,0.1)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: 10,
    paddingLeft: 12,
    gap: 8,
  },
  bulletAlert: { fontSize: 12, lineHeight: 17, color: colors.textPrimary, fontWeight: '500' },
  footBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.lightGray,
  },
  footLogoMat: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'transparent',
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  footLogoImg: { width: 24, height: 24 },
  footText: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.2 },
});

async function getShareableProductImageUrl(scanResult: ScanResult): Promise<string | null> {
  const p = scanResult.product;
  const fromProduct = buildImageUrl(p?.imageUrl ?? p?.image_url);
  if (fromProduct) return fromProduct;
  if (!p?.id) return null;
  try {
    const r = await productService.getProductImage(p.id);
    return buildImageUrl(r.imageUrl);
  } catch {
    return null;
  }
}

/* ---------- Simplicity helper ---------- */
function simplicityRating(count: number): string {
  if (count <= 5) return 'Very Simple';
  if (count <= 10) return 'Simple';
  if (count <= 20) return 'Moderate';
  return 'Complex';
}

/* ---------- Ingredient display text ---------- */
function ingredientDisplayText(ing: IngredientAnalysis): string {
  if (ing.positiveBenefit) return ing.positiveBenefit;
  if (ing.explanation && !ing.explanation.toLowerCase().includes('unknown')) return ing.explanation;
  switch (ing.riskLevel?.toLowerCase()) {
    case 'safe': return 'Safe ingredient';
    case 'low': return 'Generally safe, low risk';
    case 'moderate': return 'Use with moderation';
    case 'high': return 'May cause issues for some pets';
    case 'danger': return 'Avoid';
    default: return 'Assessment pending';
  }
}

/* ---------- Score ring ---------- */
function ScoreRing({ score, grade, animatedScore }: { score: number; grade: string; animatedScore: number }) {
  const pct = Math.min(100, Math.max(0, animatedScore)) / 100;
  const offset = CIRC * (1 - pct);
  const gradeColor = getGradeColor(grade);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <SvgCircle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
            stroke={gradeColor + '33'}
            strokeWidth={RING_STROKE} fill="none"
          />
          <SvgCircle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
            stroke={gradeColor}
            strokeWidth={RING_STROKE} fill="none"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ ...typography.scoreDisplay, color: colors.textPrimary }}>{Math.round(animatedScore)}</Text>
          <Text style={{ ...typography.labelSmall, color: colors.textSecondary }}>out of 100</Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- Score Header Card (VERTICAL centered) ---------- */
const ScoreHeaderCard = React.memo(function ScoreHeaderCard({
  scanResult, animatedScore, historyImageUrlRaw,
}: {
  scanResult: ScanResult;
  animatedScore: number;
  /** Same path as list `product_image` — fills gaps when `analyze` omits or lies about `image_url`. */
  historyImageUrlRaw?: string;
}) {
  const analysis = scanResult.analysis;
  const grade = analysis.grade ?? 'C';
  const product = scanResult.product;
  const extractedImg =
    scanResult.extracted && typeof scanResult.extracted === 'object' && 'imageUrl' in scanResult.extracted
      ? (scanResult.extracted as { imageUrl?: string }).imageUrl : undefined;
  const fromResult =
    buildImageUrl(product?.imageUrl ?? product?.image_url) ??
    buildImageUrl(extractedImg) ??
    buildImageUrl(historyImageUrlRaw);
  const [headerImg, setHeaderImg] = useState<string | null>(fromResult);
  const [imgFailed, setImgFailed] = useState(false);
  const [hideRemoteImage, setHideRemoteImage] = useState(false);
  const recoverInFlight = useRef(false);

  useEffect(() => {
    setHideRemoteImage(false);
  }, [headerImg]);

  useEffect(() => {
    const next =
      buildImageUrl(product?.imageUrl ?? product?.image_url) ??
      buildImageUrl(extractedImg) ??
      buildImageUrl(historyImageUrlRaw);
    if (next) {
      setHeaderImg(next);
      setImgFailed(false);
      return;
    }
    if (!product?.id) {
      setHeaderImg(null);
      return;
    }
    let cancelled = false;
    productService
      .getProductImage(product.id)
      .then((res) => {
        if (cancelled) return;
        const u = buildImageUrl(res.imageUrl ?? undefined);
        if (u) setHeaderImg(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.imageUrl, product?.image_url, extractedImg, historyImageUrlRaw]);

  const img = imgFailed ? null : headerImg;
  const pType = product?.productType ?? product?.product_type;
  const petName = scanResult.pet?.name ?? 'Pet';
  const petIcon = getPetTypeIcon(scanResult.pet?.petType ?? 'dog');
  const pillColor = productTypePillColor(pType);

  const recoverFromError = useCallback(() => {
    if (recoverInFlight.current) return;
    recoverInFlight.current = true;
    (async () => {
      try {
        if (product?.id) {
          try {
            const res = await productService.getProductImage(product.id);
            const u = buildImageUrl(res.imageUrl ?? undefined);
            if (u) {
              setHeaderImg(u);
              setImgFailed(false);
              return;
            }
          } catch { /* */ }
        }
        const h = buildImageUrl(historyImageUrlRaw);
        if (h) {
          setHeaderImg(h);
          setImgFailed(false);
          return;
        }
        setHeaderImg(null);
        setImgFailed(true);
      } finally {
        recoverInFlight.current = false;
      }
    })();
  }, [product?.id, historyImageUrlRaw]);

  const showRemote = Boolean(img) && !hideRemoteImage;

  return (
    <View style={st.card}>
      {/* “No image” is always in the stack; remote image is drawn on top when it loads */}
      <View style={st.headerImageSlot} accessibilityLabel="No product image" accessibilityRole="image">
        <View style={st.headerProductImgFallbackInner} pointerEvents="none">
          <Text style={st.headerProductImgNoImageLabel} allowFontScaling={false}>
            No image
          </Text>
          <Text style={st.headerProductImgNoImageKicker} allowFontScaling={false}>
            🐾
          </Text>
        </View>
        {showRemote && img ? (
          <Image
            key={img}
            source={{ uri: img }}
            style={st.headerProductImgOverlay}
            resizeMode="cover"
            onError={() => {
              setHideRemoteImage(true);
              recoverFromError();
            }}
          />
        ) : null}
      </View>

      {/* Brand */}
      {product?.brand && (
        <Text style={st.headerBrand}>{product.brand.toUpperCase()}</Text>
      )}

      {/* Name */}
      <Text style={st.headerName}>
        {product?.name ?? scanResult.extracted?.productName ?? 'Product'}
      </Text>

      {/* Product type pill */}
      {pType && (
        <View style={[st.typePill, { backgroundColor: pillColor + '1F' }]}>
          <Text style={[st.typePillText, { color: pillColor }]}>{productTypePillLabel(pType)}</Text>
        </View>
      )}

      {/* Score ring */}
      <View style={{ marginTop: spacing.md }}>
        <ScoreRing score={analysis.finalScore ?? 0} grade={grade} animatedScore={animatedScore} />
      </View>

      {/* Grade badge */}
      <View style={st.gradeRow}>
        <Text style={{ ...typography.labelMedium, color: colors.textSecondary }}>Grade</Text>
        <Text style={{ ...typography.gradeDisplay, color: getGradeColor(grade) }}>{grade}</Text>
        <Text style={{ ...typography.bodyMedium, color: colors.textSecondary }}>
          - {getGradeDescription(grade)}
        </Text>
      </View>

      {/* Pet context pill */}
      <View style={st.petPill}>
        <Text style={st.petPillText}>
          {petIcon} Scored for a healthy {scanResult.pet?.petType ?? 'pet'}
        </Text>
      </View>
    </View>
  );
});

/* ---------- Stats Strip (3-column, no duplicate score) ---------- */
const StatsStrip = React.memo(function StatsStrip({ scanResult }: { scanResult: ScanResult }) {
  const ingredients = scanResult.analysis.ingredients ?? [];

  const concernCount = ingredients.filter(
    i => i.isToxic || i.isAllergenMatch || i.isHealthConcern || i.riskLevel === 'high' || i.riskLevel === 'danger'
  ).length;
  const cautionCount = ingredients.filter(i => i.riskLevel === 'moderate').length;

  const issueLabel = concernCount > 0
    ? `${concernCount}`
    : cautionCount > 0 ? `${cautionCount}` : 'None';
  const issueColor = concernCount > 0
    ? colors.danger
    : cautionCount > 0 ? colors.caution : colors.safe;
  const issueIcon = concernCount > 0
    ? 'warning'
    : cautionCount > 0 ? 'alert-circle' : 'checkmark-circle';

  return (
    <View style={st.statsStrip}>
      <StatColumn icon="leaf" label="Ingredients" value={`${ingredients.length}`} color={colors.primary} />
      <View style={st.statsStripDivider} />
      <StatColumn
        icon="sparkles-outline"
        label="Complexity"
        value={simplicityRating(ingredients.length)}
        color={ingredients.length <= 10 ? colors.safe : colors.caution}
      />
      <View style={st.statsStripDivider} />
      <StatColumn icon={issueIcon} label="Concerns" value={issueLabel} color={issueColor} />
    </View>
  );
});

function StatColumn({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={st.statCol}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={st.statColValue}>{value}</Text>
      <Text style={st.statColLabel}>{label}</Text>
    </View>
  );
}

/* ---------- Quick Verdict Card ---------- */
const QuickVerdictCard = React.memo(function QuickVerdictCard({ scanResult }: { scanResult: ScanResult }) {
  const ai = scanResult.aiInsights;
  const benefits = ai?.topBenefits ?? scanResult.analysis.positives ?? [];
  const concerns = ai?.topConcerns ?? scanResult.analysis.keyIssues ?? [];
  return (
    <View style={st.card}>
      {/* Header inside card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Text style={{ fontSize: 16 }}>✨</Text>
        <Text style={{ ...typography.labelLarge, color: colors.textPrimary }}>Quick Verdict</Text>
      </View>

      {/* Benefits */}
      {benefits.length > 0 && (
        <View style={[st.verdictBlock, { backgroundColor: '#E8F5E9' }]}>
          <View style={st.verdictBlockHeader}>
            <Ionicons name="checkmark-circle" size={14} color={colors.safe} />
            <Text style={st.verdictBlockTitle}>Benefits</Text>
          </View>
          {benefits.map((b, i) => (
            <View key={i} style={st.bulletRow}>
              <View style={[st.bulletDot, { backgroundColor: colors.safe }]} />
              <Text style={st.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <View style={[st.verdictBlock, { backgroundColor: '#FFF8E6', marginTop: spacing.md }]}>
          <View style={st.verdictBlockHeader}>
            <Ionicons name="warning" size={14} color={colors.caution} />
            <Text style={st.verdictBlockTitle}>Concerns</Text>
          </View>
          {concerns.map((c, i) => (
            <View key={i} style={st.bulletRow}>
              <View style={[st.bulletDot, { backgroundColor: colors.caution }]} />
              <Text style={st.bulletText}>{c}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

/* ---------- Condition Warnings Card ---------- */
const ConditionWarningsCard = React.memo(function ConditionWarningsCard({
  warnings,
  petName,
}: { warnings: ConditionWarning[]; petName: string }) {
  if (!warnings || warnings.length === 0) return null;

  const grouped = warnings.reduce<Record<string, ConditionWarning[]>>((acc, w) => {
    const key = w.conditionLabel || w.condition;
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {});

  const hasHighSeverity = (items: ConditionWarning[]) => items.some(w => w.severity === 'high');

  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
        <Text style={{ fontSize: 16, marginTop: 1 }}>🩺</Text>
        <Text
          style={{ ...typography.labelLarge, color: colors.textPrimary, flex: 1, flexWrap: 'wrap' }}
        >
          {`Health Condition Alerts for ${petName}`}
        </Text>
      </View>

      {Object.entries(grouped).map(([label, items]) => {
        const isAllergy = items[0]?.type === 'allergy';
        const isHigh = hasHighSeverity(items);
        const bg = isAllergy ? '#FFEBEE' : isHigh ? '#FFF3E0' : '#FFF8E1';
        const iconColor = isAllergy ? colors.danger : isHigh ? '#E65100' : '#F57C00';
        const icon = isAllergy ? 'alert-circle' : isHigh ? 'warning' : 'information-circle';

        return (
          <View key={label} style={[st.verdictBlock, { backgroundColor: bg, marginBottom: spacing.sm }]}>
            <View style={st.verdictBlockHeader}>
              <Ionicons name={icon as any} size={14} color={iconColor} />
              <Text style={[st.verdictBlockTitle, { color: iconColor }]}>
                {isAllergy ? `${label} Allergy` : label}
              </Text>
              {isHigh && (
                <View style={{ backgroundColor: iconColor, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginLeft: 'auto' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>
                    {isAllergy ? 'ALLERGEN' : 'HIGH RISK'}
                  </Text>
                </View>
              )}
            </View>
            {items.map((w, i) => {
              const bulletColor = w.severity === 'high' ? iconColor : '#FFA726';
              return (
                <View key={i} style={st.bulletRow}>
                  <View style={[st.bulletDot, { backgroundColor: bulletColor }]} />
                  <Text style={st.bulletText}>{w.message}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
});

/* ---------- Ingredient Pills Card ---------- */
const IngredientPillsCard = React.memo(function IngredientPillsCard({
  ingredients,
}: { ingredients: IngredientAnalysis[] }) {
  const [expanded, setExpanded] = useState(true);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  return (
    <View style={st.card}>
      {/* Header */}
      <View style={st.ingHeader}>
        <Text style={{ ...typography.labelLarge, color: colors.textPrimary }}>
          Ingredients ({ingredients.length})
        </Text>
        <Pressable onPress={toggle} hitSlop={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ ...typography.labelSmall, color: colors.primary }}>
              {expanded ? 'Collapse' : 'Expand'}
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
          </View>
        </Pressable>
      </View>

      {/* Detail rows */}
      {expanded && ingredients.map(ing => (
        <IngredientDetailRow key={`${ing.position}-${ing.name}`} ing={ing} />
      ))}
    </View>
  );
});

function IngredientDetailRow({ ing }: { ing: IngredientAnalysis }) {
  const riskColor = getRiskColor(ing.riskLevel);
  return (
    <View style={st.ingDetailRow}>
      <View style={[st.posBadge, { backgroundColor: riskColor }]}>
        <Text style={st.posBadgeText}>#{ing.position}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.ingDetailName}>{ing.name}</Text>
        <Text style={st.ingDetailExpl}>{ingredientDisplayText(ing)}</Text>
      </View>
      <View style={[st.riskBadge, { backgroundColor: riskColor + '1A' }]}>
        <Text style={[st.riskBadgeText, { color: riskColor }]}>
          {(ing.riskLevel ?? '').charAt(0).toUpperCase() + (ing.riskLevel ?? '').slice(1)}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Alternatives Section ---------- */
function AlternativesSection({
  alternatives, isLoading, onTap,
}: { alternatives: AlternativeProduct[]; isLoading: boolean; onTap: (id: string) => void }) {
  return (
    <View style={st.altSection}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name="refresh" size={16} color={colors.primary} />
        <Text style={{ ...typography.labelLarge, color: colors.textSecondary }}>Safer Alternatives</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : alternatives.length === 0 ? (
        <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>
          No alternatives found in our database yet.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {alternatives.map(alt => (
              <AltCard key={alt.product.id} alt={alt} onPress={() => onTap(alt.product.id)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function AltCard({ alt, onPress }: { alt: AlternativeProduct; onPress: () => void }) {
  const p = alt.product;
  const [lazyImg, setLazyImg] = useState<string | null>(buildImageUrl(p.image_url));
  const [imgFailed, setImgFailed] = useState(false);
  const gradeColor = getGradeColor(alt.grade);

  useEffect(() => {
    if (lazyImg || imgFailed) return;
    let cancelled = false;
    productService.getProductImage(p.id).then(res => {
      if (cancelled) return;
      if (res.imageUrl) {
        setLazyImg(buildImageUrl(res.imageUrl));
      } else {
        setImgFailed(true);
      }
    }).catch(() => { if (!cancelled) setImgFailed(true); });
    return () => { cancelled = true; };
  }, [p.id, lazyImg, imgFailed]);

  const displayImg = imgFailed ? null : lazyImg;

  return (
    <Pressable style={st.altCard} onPress={onPress}>
      {displayImg ? (
        <Image
          source={{ uri: displayImg }}
          style={st.altImg}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <View style={[st.altImg, { backgroundColor: gradeColor + '1F', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: gradeColor }}>{Math.round(alt.score)}</Text>
        </View>
      )}
      <Text style={st.altName} numberOfLines={2}>{p.name}</Text>
      {p.brand && <Text style={st.altBrand} numberOfLines={1}>{p.brand}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: gradeColor }}>{Math.round(alt.score)}</Text>
        <View style={{ backgroundColor: gradeColor, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.white }}>{alt.grade}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ---------- Share Button ---------- */
function ShareResultButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: radius.large, overflow: 'hidden' }}>
      <LinearGradient
        colors={[colors.primary, colors.primary + 'CC']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={st.shareGrad}
      >
        <Ionicons name="share-outline" size={18} color={colors.white} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.shareTitle}>Share This Result</Text>
          <Text style={st.shareSub}>Saves a shareable image card + full summary text</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.white} style={{ opacity: 0.7 }} />
      </LinearGradient>
    </Pressable>
  );
}

/* ---------- Trust Footer ---------- */
function TrustDisclaimerFooter({
  community,
}: {
  community: { totalScans: number; totalProducts: number } | null;
}) {
  return (
    <View style={st.footer}>
      {/* Trust badges */}
      <View style={st.trustRow}>
        {community && community.totalScans >= 100 && (
          <View style={st.trustBadge}>
            <Ionicons name="people" size={16} color={colors.primary} />
            <Text style={st.trustValue}>{formatCommunityScans(community.totalScans)}</Text>
            <Text style={st.trustLabel}>Community</Text>
          </View>
        )}
        <View style={st.trustBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={st.trustValue}>AAFCO</Text>
          <Text style={st.trustLabel}>Compliant</Text>
        </View>
        <View style={st.trustBadge}>
          <Ionicons name="ribbon" size={16} color={colors.primary} />
          <Text style={st.trustValue}>Expert</Text>
          <Text style={st.trustLabel}>Reviewed</Text>
        </View>
      </View>

      {/* How we score */}
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>ƒ</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>HOW WE SCORE</Text>
        </View>
        <Text style={st.methodText}>
          Per AAFCO guidelines, ingredients are listed in descending order by weight. Our score reflects this — ingredients making up more of the product have a greater impact on your pet's safety rating.
        </Text>
      </View>

      {/* Disclaimer */}
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="information-circle-outline" size={11} color={colors.textSecondary} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>DISCLAIMER</Text>
        </View>
        <Text style={st.methodText}>
          Analysis based on AAFCO guidelines. For informational purposes only — not veterinary advice. Always consult your veterinarian before making dietary changes.
        </Text>
      </View>
    </View>
  );
}

/* ========== Skeleton placeholders (pulse animation) ========== */
function usePulse() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

function SkeletonBlock({ width, height, opacity, style }: {
  width: number | string; height: number; opacity: Animated.Value; style?: any;
}) {
  return (
    <Animated.View style={[{
      width, height, borderRadius: radius.medium,
      backgroundColor: colors.lightGray, opacity,
    }, style]} />
  );
}

function LoadingCard({ opacity }: { opacity: Animated.Value }) {
  return (
    <View style={[st.card, { gap: spacing.md }]}>
      <SkeletonBlock width="60%" height={14} opacity={opacity} />
      <SkeletonBlock width="100%" height={40} opacity={opacity} />
      <SkeletonBlock width="80%" height={14} opacity={opacity} />
      <SkeletonBlock width="100%" height={40} opacity={opacity} />
    </View>
  );
}

/* ========== Main Screen ========== */
export function ResultScreen() {
  const navigation = useNavigation<ResultNav>();
  const route = useRoute<RouteProp<HomeStackParamList | HistoryStackParamList, 'Result'>>();
  const { selectedPet } = useApp();

  const paramScanResult = route.params?.scanResult;
  const paramProductId = route.params && 'productId' in route.params ? route.params.productId : undefined;
  const paramProduct = route.params && 'product' in route.params ? route.params.product : undefined;
  const paramPreloaded = route.params && 'preloadedScore' in route.params ? route.params.preloadedScore : undefined;
  const historyImageParam =
    route.params && 'historyImageUrl' in route.params && route.params.historyImageUrl
      ? String(route.params.historyImageUrl)
      : undefined;

  const isPreloadMode = !paramScanResult && !!paramProductId;

  const [scanResult, setScanResult] = useState<ScanResult | null>(paramScanResult ?? null);
  const [analysisLoading, setAnalysisLoading] = useState(isPreloadMode);
  const [analysisError, setAnalysisError] = useState(false);
  const pulseOpacity = usePulse();

  const [animatedScore, setAnimatedScore] = useState(0);
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [altLoading, setAltLoading] = useState(true);
  const [community, setCommunity] = useState<{ totalScans: number; totalProducts: number } | null>(null);
  const shareCardRef = useRef<View>(null);

  const displayScore = scanResult?.analysis.finalScore ?? paramPreloaded?.score ?? 0;
  const displayGrade = scanResult?.analysis.grade ?? paramPreloaded?.grade ?? 'C';
  const displayProduct = scanResult?.product ?? (paramProduct ? {
    id: paramProduct.id,
    name: paramProduct.name,
    brand: paramProduct.brand,
    image_url: paramProduct.image_url,
    productType: paramProduct.product_type,
    product_type: paramProduct.product_type,
  } : undefined);

  const petParams = useMemo((): productService.AnalyzeProductParams | undefined => {
    if (!selectedPet) return undefined;
    const healthConditions = (selectedPet.healthConditions ?? []).map((c) => ({
      id: c.id,
      condition_type: c.condition_type,
      severity: c.severity,
      ...(c.notes ? { notes: c.notes } : {}),
    }));
    return {
      petName: selectedPet.name,
      petType: selectedPet.pet_type,
      petBreed: selectedPet.breed,
      petAgeMonths: selectedPet.age_months,
      petWeight: selectedPet.weight_kg,
      ...(healthConditions.length > 0 ? { healthConditions } : {}),
    };
  }, [selectedPet]);

  useEffect(() => {
    if (!isPreloadMode || !paramProductId) return;
    let cancelled = false;
    (async () => {
      setAnalysisLoading(true);
      setAnalysisError(false);
      try {
        const result = await productService.analyzeProduct(paramProductId, petParams);
        if (!cancelled) setScanResult(result);
      } catch {
        if (!cancelled) setAnalysisError(true);
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPreloadMode, paramProductId, petParams]);

  const finalScore = displayScore;
  const productId = scanResult?.product?.id ?? paramProductId;

  useEffect(() => {
    setAnimatedScore(0);
    const duration = 1200;
    const steps = 30;
    const stepDuration = duration / steps;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i <= steps; i++) {
      timers.push(
        setTimeout(() => {
          const progress = i / steps;
          const eased = 1 - Math.pow(1 - progress, 3);
          setAnimatedScore(Math.round(finalScore * eased));
        }, stepDuration * i)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [finalScore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await scanService.getCommunityStats();
        if (!cancelled) setCommunity(stats);
      } catch {
        if (!cancelled) setCommunity(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!productId || !selectedPet) { setAlternatives([]); setAltLoading(false); return; }
    let cancelled = false;
    (async () => {
      setAltLoading(true);
      try {
        const alts = await productService.getAlternatives(productId, {
          petType: selectedPet.pet_type,
          petName: selectedPet.name,
          limit: 12,
        });
        if (!cancelled) setAlternatives(alts);
      } catch {
        if (!cancelled) setAlternatives([]);
      } finally {
        if (!cancelled) setAltLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, selectedPet]);

  const onAlternativeTap = useCallback(async (pid: string) => {
    try {
      const res = await productService.analyzeProduct(pid, petParams);
      navigation.replace('Result', { scanResult: res });
    } catch (e) { console.warn(e); }
  }, [navigation, petParams]);

  const preloadedScanResult = useMemo((): ScanResult => {
    const withHistoryImage = (r: ScanResult): ScanResult => {
      if (!historyImageParam) return r;
      const p = r.product;
      const hasAnyUrl = p ? buildImageUrl(p.imageUrl ?? p.image_url) != null : false;
      if (hasAnyUrl) return r;
      if (p) {
        return {
          ...r,
          product: { ...p, image_url: p.imageUrl ?? p.image_url ?? historyImageParam },
        };
      }
      return { ...r, product: { image_url: historyImageParam } as NonNullable<ScanResult['product']> };
    };

    if (scanResult) {
      return withHistoryImage(scanResult);
    }
    let productForSkeleton: ScanResult['product'] = displayProduct;
    if (displayProduct && historyImageParam) {
      const hasUrl = buildImageUrl(displayProduct.imageUrl ?? displayProduct.image_url) != null;
      if (!hasUrl) {
        productForSkeleton = { ...displayProduct, image_url: displayProduct.image_url ?? historyImageParam };
      }
    }
    return {
      scanId: '',
      scanType: 'search',
      product: productForSkeleton,
      analysis: {
        finalScore: displayScore,
        grade: displayGrade,
        recommendation: paramPreloaded?.recommendation ?? '',
        ingredients: [],
      },
      pet: {
        name: selectedPet?.name ?? 'Pet',
        petType: selectedPet?.pet_type ?? 'dog',
      },
    };
  }, [scanResult, displayProduct, displayScore, displayGrade, paramPreloaded, selectedPet, historyImageParam]);

  const onShare = useCallback(async () => {
    if (!preloadedScanResult?.analysis) return;

    try {
      try {
        await Image.prefetch(SHARE_LOGO_URL);
      } catch { /* ignore */ }
      await new Promise<void>((r) => { InteractionManager.runAfterInteractions(() => r()); });
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      await new Promise<void>(r => setTimeout(r, 200));
      const node = shareCardRef.current;
      if (node) {
        const pngUri = await captureRef(node, {
          format: 'png',
          quality: 0.95,
          result: 'tmpfile',
          ...(Platform.OS === 'ios' ? { useRenderInContext: true as const } : {}),
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pngUri, { mimeType: 'image/png', UTI: 'public.png' });
          return;
        }
        await Share.share({ url: pngUri });
        return;
      }
    } catch (e) {
      console.warn('[Share] PNG card:', e);
    }

    try {
      const imageUrl = await getShareableProductImageUrl(preloadedScanResult);
      const base = FileSystem.cacheDirectory;
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) && base) {
        const path = `${base}phd-share-${Date.now()}.jpg`;
        const { uri: localFileUri } = await FileSystem.downloadAsync(imageUrl, path);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localFileUri, { mimeType: 'image/jpeg' });
        } else {
          await Share.share({ url: localFileUri });
        }
      }
    } catch {
      /* ignore */
    }
  }, [preloadedScanResult]);

  const ingredients = scanResult?.analysis.ingredients ?? [];

  if (!paramScanResult && !paramProductId) {
    return (
      <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
        <View style={st.centerFallback}>
          <Text style={{ ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center' }}>
            No result data.
          </Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={{ ...typography.titleMedium, color: colors.primary, marginTop: spacing.md }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      {/* Off-screen: never stack behind the real UI (would show hero score / gradient in the header). Logo = https (R2) like product thumb. */}
      <View
        pointerEvents="none"
        collapsable={false}
        style={st.sharePngHost}
      >
        <View style={{ width: SHARE_PNG_W }} collapsable={false}>
          <ResultSharePngCard
            ref={shareCardRef}
            scanResult={preloadedScanResult}
          />
        </View>
      </View>
      {/* Custom navigation bar */}
      <View style={st.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
          <Ionicons name="chevron-back" size={14} color={colors.primary} />
          <Text style={{ fontSize: 16, color: colors.primary }}>Back</Text>
        </Pressable>
        <Text style={st.navTitle}>Analysis Result</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Score + product header always renders immediately */}
        <ScoreHeaderCard
          scanResult={preloadedScanResult}
          animatedScore={animatedScore}
          historyImageUrlRaw={historyImageParam}
        />

        {/* Detail sections: show skeletons while loading */}
        {analysisLoading ? (
          <>
            <Animated.View style={[st.statsStrip, { opacity: pulseOpacity }]}>
              <StatColumn icon="leaf" label="Ingredients" value="—" color={colors.textSecondary} />
              <View style={st.statsStripDivider} />
              <StatColumn icon="sparkles-outline" label="Complexity" value="—" color={colors.textSecondary} />
              <View style={st.statsStripDivider} />
              <StatColumn icon="checkmark-circle" label="Concerns" value="—" color={colors.textSecondary} />
            </Animated.View>
            <LoadingCard opacity={pulseOpacity} />
            <LoadingCard opacity={pulseOpacity} />
          </>
        ) : analysisError ? (
          <View style={[st.card, { alignItems: 'center', gap: spacing.sm }]}>
            <Ionicons name="alert-circle" size={32} color={colors.danger} />
            <Text style={{ ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center' }}>
              Failed to load full analysis.
            </Text>
            <Pressable
              onPress={() => {
                setAnalysisError(false);
                setAnalysisLoading(true);
                productService.analyzeProduct(paramProductId!, petParams)
                  .then(res => { setScanResult(res); setAnalysisLoading(false); })
                  .catch(() => { setAnalysisError(true); setAnalysisLoading(false); });
              }}
              style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}
            >
              <Text style={{ ...typography.labelMedium, color: colors.primary }}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <StatsStrip scanResult={preloadedScanResult} />
            <QuickVerdictCard scanResult={preloadedScanResult} />
            <ConditionWarningsCard
              warnings={preloadedScanResult.aiInsights?.conditionWarnings ?? []}
              petName={selectedPet?.name ?? preloadedScanResult.pet?.name ?? 'your pet'}
            />
            <IngredientPillsCard ingredients={ingredients} />
          </>
        )}

        <AlternativesSection alternatives={alternatives} isLoading={altLoading} onTap={onAlternativeTap} />

        {!analysisLoading && !analysisError && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ShareResultButton onPress={onShare} />
          </View>
        )}

        <TrustDisclaimerFooter community={community} />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ========== Styles ========== */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' as const },
  sharePngHost: {
    position: 'absolute' as const,
    left: -10000,
    top: 0,
    width: SHARE_PNG_W,
  },
  centerFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, backgroundColor: colors.background,
  },
  navBar: {
    zIndex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  navTitle: { ...typography.titleLarge, color: colors.textPrimary },
  scroll: { paddingTop: spacing.sm, gap: spacing.lg, flexGrow: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card, borderRadius: radius.large, padding: spacing.md,
    marginHorizontal: spacing.md, ...shadows.card,
  },
  headerImageSlot: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    position: 'relative' as const,
  },
  headerProductImgFallbackInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProductImgOverlay: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: 80,
    height: 80,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
    zIndex: 1,
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
  },
  headerProductImgNoImageLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  headerProductImgNoImageKicker: {
    fontSize: 14,
    marginTop: 2,
    opacity: 0.9,
  },
  headerBrand: {
    ...typography.labelSmall, color: colors.textSecondary,
    textAlign: 'center',
  },
  headerName: {
    ...typography.bodyLarge, fontWeight: '600', color: colors.textPrimary,
    textAlign: 'center', marginTop: spacing.xxs,
  },
  typePill: {
    alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, marginTop: spacing.xs,
  },
  typePillText: { ...typography.labelSmall },
  gradeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginTop: spacing.sm,
  },
  petPill: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.lightGray, borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  petPillText: { ...typography.labelMedium, color: colors.textSecondary },
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.large,
    paddingVertical: spacing.md, ...shadows.card,
  },
  statsStripDivider: {
    width: 1, height: 36, backgroundColor: colors.divider,
  },
  statCol: {
    flex: 1, alignItems: 'center', gap: spacing.xxs,
  },
  statColValue: {
    fontSize: 15, fontWeight: '700' as const, color: colors.textPrimary,
  },
  statColLabel: {
    fontSize: 11, fontWeight: '500' as const, color: colors.textSecondary,
  },
  verdictBlock: {
    borderRadius: radius.medium, padding: spacing.md, gap: spacing.sm,
  },
  verdictBlockHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  verdictBlockTitle: { ...typography.labelMedium, fontWeight: '600', color: colors.textPrimary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  ingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  ingDetailRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  posBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  posBadgeText: { fontSize: 10, fontWeight: '500', color: colors.white },
  ingDetailName: { ...typography.bodySmall, fontWeight: '500', color: colors.textPrimary },
  ingDetailExpl: { ...typography.labelSmall, color: colors.textSecondary },
  riskBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.small,
  },
  riskBadgeText: { ...typography.labelSmall, fontWeight: '500' },
  altSection: {
    marginHorizontal: spacing.md, padding: spacing.md,
    backgroundColor: 'rgba(45,106,79,0.08)', borderRadius: radius.large,
  },
  altCard: {
    width: 120, padding: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.medium,
  },
  altImg: {
    width: '100%', height: 64, borderRadius: radius.medium,
    backgroundColor: colors.lightGray, marginBottom: spacing.xs,
  },
  altName: { ...typography.labelSmall, color: colors.textPrimary, minHeight: 34 },
  altBrand: { fontSize: 10, color: colors.textSecondary },
  shareGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md,
  },
  shareTitle: { ...typography.bodyMedium, fontWeight: '600', color: colors.white },
  shareSub: { ...typography.labelSmall, color: 'rgba(255,255,255,0.8)' },
  footer: {
    marginHorizontal: spacing.md, padding: spacing.md,
    backgroundColor: 'rgba(92,107,102,0.05)', borderRadius: radius.large,
    gap: spacing.md,
  },
  trustRow: {
    flexDirection: 'row', justifyContent: 'space-around',
  },
  trustBadge: { alignItems: 'center', gap: 4, minWidth: 60 },
  trustValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  trustLabel: { fontSize: 10, color: colors.textSecondary },
  methodText: {
    fontSize: 11, color: 'rgba(92,107,102,0.8)',
    textAlign: 'center', lineHeight: 16,
    paddingHorizontal: spacing.md,
  },
});
