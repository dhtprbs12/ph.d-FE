import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import * as productService from '../services/productService';
import { useApp } from '../context/AppContext';
import { colors, getGradeColor, radius, shadows, spacing, typography } from '../theme';
import type { CachedScore, Product, ProductFilterParams } from '../types';

import { buildImageUrl, formatProductTitleText } from '../utils/helpers';

const PAGE = 20;
const DEBOUNCE_MS = 600;

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1500): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (retries > 0 && e?.response?.status === 429) {
      await new Promise(r => setTimeout(r, delayMs));
      return fetchWithRetry(fn, retries - 1, delayMs * 1.5);
    }
    throw e;
  }
}

type PetTypeFilter = 'dog' | 'cat' | '';
type FoodType = '' | 'dry_food' | 'wet_food' | 'treats' | 'supplement';
type LifeStage = '' | 'puppy' | 'kitten' | 'adult' | 'senior';
type Diet = '' | 'grain_free' | 'with_grains';
type Protein = '' | 'chicken' | 'beef' | 'fish' | 'lamb' | 'turkey' | 'duck';

interface ChipDef<T> { value: T; label: string; emoji: string }

const PET_TYPE_CHIPS: ChipDef<PetTypeFilter>[] = [
  { value: 'dog', label: 'For Dogs', emoji: '🐕' },
  { value: 'cat', label: 'For Cats', emoji: '🐱' },
];

const FOOD_CHIPS: ChipDef<FoodType>[] = [
  { value: 'dry_food', label: 'Dry Food', emoji: '🥣' },
  { value: 'wet_food', label: 'Wet Food', emoji: '🥫' },
  { value: 'treats', label: 'Treats', emoji: '🦴' },
  { value: 'supplement', label: 'Supplement', emoji: '💊' },
];

function lifeStageChips(petType: PetTypeFilter): ChipDef<LifeStage>[] {
  if (petType === 'dog') {
    return [
      { value: 'puppy', label: 'Puppy', emoji: '🐶' },
      { value: 'adult', label: 'Adult', emoji: '🐾' },
      { value: 'senior', label: 'Senior', emoji: '🐾' },
    ];
  }
  if (petType === 'cat') {
    return [
      { value: 'kitten', label: 'Kitten', emoji: '🐱' },
      { value: 'adult', label: 'Adult', emoji: '🐾' },
      { value: 'senior', label: 'Senior', emoji: '🐾' },
    ];
  }
  return [
    { value: 'puppy', label: 'Puppy', emoji: '🐶' },
    { value: 'kitten', label: 'Kitten', emoji: '🐱' },
    { value: 'adult', label: 'Adult', emoji: '🐾' },
    { value: 'senior', label: 'Senior', emoji: '🐾' },
  ];
}

const DIET_CHIPS: ChipDef<Diet>[] = [
  { value: 'grain_free', label: 'Grain-Free', emoji: '🌾' },
  { value: 'with_grains', label: 'With Grains', emoji: '🌾' },
];

const PROTEIN_CHIPS: ChipDef<Protein>[] = [
  { value: 'chicken', label: 'Chicken', emoji: '🍗' },
  { value: 'beef', label: 'Beef', emoji: '🥩' },
  { value: 'fish', label: 'Fish', emoji: '🐟' },
  { value: 'lamb', label: 'Lamb', emoji: '🐑' },
  { value: 'turkey', label: 'Turkey', emoji: '🦃' },
  { value: 'duck', label: 'Duck', emoji: '🦆' },
];


function buildFilterParams(
  q: string, petType: PetTypeFilter, foodType: FoodType, life: LifeStage,
  diet: Diet, protein: Protein, offset: number, limit: number,
): ProductFilterParams {
  const params: ProductFilterParams = { q: q.trim() || undefined, limit, offset };
  if (petType) params.petType = petType;
  if (foodType) params.productType = foodType;
  if (life) params.lifeStage = life;
  if (diet === 'grain_free') { params.noGrains = true; params.withGrains = false; }
  else if (diet === 'with_grains') { params.withGrains = true; params.noGrains = false; }
  if (protein === 'chicken') params.withChicken = true;
  if (protein === 'beef') params.withBeef = true;
  if (protein === 'fish') params.withFish = true;
  if (protein === 'lamb') params.withLamb = true;
  if (protein === 'turkey') params.withTurkey = true;
  if (protein === 'duck') params.withDuck = true;
  return params;
}

function scoreFromMap(
  scores: Record<string, CachedScore | number> | undefined, id: string,
): { score: number; grade?: string } | null {
  if (!scores || !scores[id]) return null;
  const s = scores[id];
  if (typeof s === 'number') return { score: s };
  return { score: s.score, grade: s.grade };
}

/* ---------- Product type helpers ---------- */
function productTypeIcon(type?: string): string {
  switch (type) {
    case 'dry_food': return 'grid';
    case 'wet_food': return 'water';
    case 'treats': return 'star';
    case 'supplement': return 'medical';
    default: return 'help-circle';
  }
}
function productTypeLabel(type?: string): string {
  switch (type) {
    case 'dry_food': return 'Dry Food';
    case 'wet_food': return 'Wet Food';
    case 'treats': return 'Treats';
    case 'supplement': return 'Supplement';
    default: return 'Food';
  }
}
function textureLabel(t?: string): string {
  switch (t) {
    case 'dry': return 'Dry';
    case 'wet': return 'Wet';
    case 'semi_moist': return 'Semi-Moist';
    case 'freeze_dried': return 'Freeze-Dried';
    default: return '';
  }
}

/* ---------- ProductCard ---------- */
const ProductCard = React.memo(function ProductCard({
  product, score, onPress, index, cachedImageUrl, onImageLoaded,
}: {
  product: Product;
  score: { score: number; grade?: string } | null;
  onPress: () => void;
  index: number;
  cachedImageUrl?: string | null;
  onImageLoaded?: (productId: string, url: string) => void;
}) {
  const initial = cachedImageUrl ?? buildImageUrl(product.image_url);
  const [imgUrl, setImgUrl] = useState<string | null>(initial);

  useEffect(() => {
    const fresh = cachedImageUrl ?? buildImageUrl(product.image_url);
    if (fresh && fresh !== imgUrl) setImgUrl(fresh);
  }, [cachedImageUrl, product.image_url]);

  useEffect(() => {
    if (imgUrl || !product.id) return;
    let cancelled = false;
    const delay = index * 150;
    const timer = setTimeout(() => {
      productService.getProductImage(product.id).then(res => {
        if (!cancelled && res.imageUrl) {
          const url = buildImageUrl(res.imageUrl);
          if (url) {
            setImgUrl(url);
            onImageLoaded?.(product.id, url);
          }
        }
      }).catch(() => {});
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [product.id, imgUrl, index]);

  const [imgFailed, setImgFailed] = useState(false);
  const img = imgFailed ? null : imgUrl;

  useEffect(() => {
    setImgFailed(false);
  }, [cachedImageUrl, product.image_url]);

  const texture = textureLabel(product.texture);
  const typeStr = productTypeLabel(product.product_type);
  const fullType = texture ? `${texture} ${typeStr}` : typeStr;

  const placeholder = (
    <View style={[st.productImg, st.productImgPh]}>
      <Text style={{ fontSize: 26 }}>🐾</Text>
    </View>
  );

  const renderImage = (uri: string) => (
    <Image
      source={{ uri }}
      style={st.productImg}
      onError={() => setImgFailed(true)}
    />
  );

  return (
    <Pressable style={({ pressed }) => [st.productCard, pressed && { opacity: 0.92 }]} onPress={onPress}>
      <View style={{ width: 56, height: 56 }}>
        {img ? renderImage(img) : placeholder}
      </View>

      {/* Product info */}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        {product.brand && (
          <Text style={st.productBrand} numberOfLines={1}>{formatProductTitleText(product.brand)}</Text>
        )}
        <Text style={st.productName} numberOfLines={2}>{formatProductTitleText(product.name)}</Text>
        {product.product_type && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name={productTypeIcon(product.product_type) as any} size={10} color={colors.textSecondary} />
            <Text style={st.productType}>{fullType}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
    </Pressable>
  );
});

/* ---------- Filter chip row ---------- */
function ChipRow<T extends string>({
  title, items, selected, onSelect,
}: {
  title: string;
  items: ChipDef<T>[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={st.filterBlock}>
      <Text style={st.filterLabel}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipScroll}>
        {items.map(item => {
          const on = selected === item.value;
          return (
            <Pressable
              key={String(item.value)}
              style={[st.chip, on ? st.chipSelected : st.chipDefault]}
              onPress={() => onSelect(on ? ('' as T) : item.value)}
            >
              <Text style={{ fontSize: 12 }}>{item.emoji}</Text>
              <Text style={[st.chipText, on && st.chipTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ========== Main Screen ========== */
export function ProductSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'ProductSearch'>>();
  const { selectedPet } = useApp();

  const [query, setQuery] = useState('');
  const [petType, setPetType] = useState<PetTypeFilter>('');
  const [foodType, setFoodType] = useState<FoodType>('');
  const [lifeStage, setLifeStage] = useState<LifeStage>('');
  const [diet, setDiet] = useState<Diet>('');
  const [protein, setProtein] = useState<Protein>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [scores, setScores] = useState<Record<string, CachedScore | number>>({});
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [listOffset, setListOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const hasFilters = !!petType || !!foodType || !!lifeStage || !!diet || !!protein || query.length > 0;

  useEffect(() => {
    if (selectedPet?.pet_type) setPetType(selectedPet.pet_type);
  }, [selectedPet?.pet_type]);

  const productsRef = useRef(products);
  const scoresRef = useRef(scores);
  const hasBlurred = useRef(false);
  const lastOpenedProductIdRef = useRef<string | null>(null);
  productsRef.current = products;
  scoresRef.current = scores;

  /** When returning from Analysis Result, refresh the row’s image. useFocusEffect avoids missing updates when `blur` never set `hasBlurred`. */
  useFocusEffect(
    useCallback(() => {
      const openedId = lastOpenedProductIdRef.current;
      if (!openedId) return;
      lastOpenedProductIdRef.current = null;
      let cancelled = false;
      productService
        .getProductImage(openedId)
        .then((res) => {
          if (cancelled) return;
          const raw = res.imageUrl;
          if (!raw) return;
          const full = buildImageUrl(raw);
          if (full) {
            setImageCache((prev) => ({ ...prev, [openedId]: full }));
            setProducts((prev) =>
              prev.map((p) => (p.id === openedId ? { ...p, image_url: raw } : p))
            );
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      hasBlurred.current = true;
    });
    const unsubFocus = navigation.addListener('focus', () => {
      if (!hasBlurred.current) return;
      hasBlurred.current = false;
      const prods = productsRef.current;
      const sc = scoresRef.current;
      if (prods.length === 0) return;
      const missing = prods.filter(p => !sc[p.id]).map(p => p.id);
      if (missing.length === 0) return;
      const pt = petType || selectedPet?.pet_type || 'dog';
      productService.batchScores(missing, pt).then(fresh => {
        setScores(prev => ({ ...prev, ...fresh }));
      }).catch(() => {});
    });
    return () => { unsubBlur(); unsubFocus(); };
  }, [navigation, petType, selectedPet?.pet_type]);



  useEffect(() => {
    if (!hasFilters) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      const params = buildFilterParams(query, petType, foodType, lifeStage, diet, protein, 0, PAGE);
      params.healthConditions = [];
      try {
        const res = await fetchWithRetry(() => productService.filterProducts(params));
        const products = res.products ?? [];
        const sc = res.scores ?? {};
        const pag = res.pagination;
        setProducts(products);
        setScores(sc);
        setTotal(pag?.total ?? products.length);
        setListOffset(products.length);
      } catch (e) {
        console.warn('[Filter] error:', e);
      } finally {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, petType, foodType, lifeStage, diet, protein, hasFilters]);

  const onSearchPress = useCallback(async () => {
    setLoading(true);
    const params = buildFilterParams(query, petType, foodType, lifeStage, diet, protein, 0, PAGE);
    params.healthConditions = [];
    try {
      const res = await fetchWithRetry(() => productService.filterProducts(params));
      const products = res.products ?? [];
      const sc = res.scores ?? {};
      const pag = res.pagination;
      setProducts(products);
      setScores(sc);
      setTotal(pag?.total ?? products.length);
      setListOffset(products.length);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setHasLoadedOnce(true); }
  }, [query, petType, foodType, lifeStage, diet, protein]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || products.length >= total) return;
    setLoadingMore(true);
    const params = buildFilterParams(query, petType, foodType, lifeStage, diet, protein, listOffset, PAGE);
    params.healthConditions = [];
    try {
      const res = await fetchWithRetry(() => productService.filterProducts(params));
      const newProducts = res.products ?? [];
      const sc = res.scores ?? {};
      setProducts(prev => [...prev, ...newProducts]);
      setScores(prev => ({ ...prev, ...sc }));
      setListOffset(prev => prev + newProducts.length);
    } catch (e) { console.warn(e); }
    finally { setLoadingMore(false); }
  }, [loadingMore, loading, products.length, total, query, petType, foodType, lifeStage, diet, protein, listOffset]);

  const onProductPress = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    lastOpenedProductIdRef.current = productId;
    const s = scoreFromMap(scores, productId);
    navigation.navigate('Result', {
      productId,
      product,
      preloadedScore: {
        score: s?.score ?? 0,
        grade: s?.grade,
      },
    });
  }, [navigation, products, scores]);

  const onImageLoaded = useCallback((productId: string, url: string) => {
    setImageCache(prev => ({ ...prev, [productId]: url }));
  }, []);

  const resetAll = useCallback(() => {
    setPetType(''); setFoodType(''); setLifeStage('');
    setDiet(''); setProtein(''); setQuery('');
    setProducts([]); setScores({}); setImageCache({}); setTotal(0);
    setHasLoadedOnce(false); setListOffset(0);
  }, []);


  const showEmpty = hasLoadedOnce && !loading && products.length === 0;
  const showList = products.length > 0;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 300) {
      loadMore();
    }
  }, [loadMore]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Nav bar with "Find Safe Food" title and Reset button */}
      <View style={st.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={st.navTitle}>Find Safe Food</Text>
        {hasFilters ? (
          <Pressable onPress={resetAll} hitSlop={8}>
            <Text style={st.resetText}>Reset</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Search bar on lightGray bg, Search button in accent */}
      <View style={st.searchBar}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={st.searchInput}
          placeholder="Search products or brands..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={onSearchPress}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable style={st.searchBtn} onPress={onSearchPress}>
          <Text style={st.searchBtnText}>Search</Text>
        </Pressable>
      </View>


      {/* Filters + Results */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={{ paddingTop: spacing.sm }}>
          <ChipRow title="Pet Type" items={PET_TYPE_CHIPS} selected={petType} onSelect={setPetType} />
          <ChipRow title="Food Type" items={FOOD_CHIPS} selected={foodType} onSelect={setFoodType} />
          <ChipRow title="Life Stage" items={lifeStageChips(petType)} selected={lifeStage} onSelect={setLifeStage} />
          <ChipRow title="Diet Type" items={DIET_CHIPS} selected={diet} onSelect={setDiet} />
          <ChipRow title="Main Protein" items={PROTEIN_CHIPS} selected={protein} onSelect={setProtein} />
        </View>

        <View style={st.divider} />

        {/* Results */}
        {!hasLoadedOnce && !loading ? (
          <View style={st.emptyCenter}>
            <Ionicons name="search" size={40} color={'rgba(45,106,79,0.6)'} />
            <Text style={st.emptyTitle}>Search for pet food</Text>
            <Text style={st.emptyBody}>
              Enter a product name, brand, or use filters to find safe food for your pet
            </Text>
          </View>
        ) : loading && products.length === 0 ? (
          <View style={st.emptyCenter}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.emptyBody}>Searching...</Text>
          </View>
        ) : showEmpty ? (
          <View style={st.emptyCenter}>
            <Ionicons name="search" size={40} color={'rgba(92,107,102,0.5)'} />
            <Text style={st.emptyTitle}>No products found</Text>
            <Text style={st.emptyBody}>Try adjusting your filters or search terms</Text>
          </View>
        ) : showList ? (
          <View style={{ paddingHorizontal: spacing.md }}>
            <Text style={st.resultCount}>
              {products.length < total ? `${products.length} of ${total}` : `${products.length}`} products found
            </Text>
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                score={scoreFromMap(scores, product.id)}
                onPress={() => onProductPress(product.id)}
                index={index}
                cachedImageUrl={imageCache[product.id]}
                onImageLoaded={onImageLoaded}
              />
            ))}
            {loadingMore && (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            )}
            {!loadingMore && products.length >= total && products.length > 0 && (
              <Text style={st.allLoaded}>All products loaded</Text>
            )}
            <View style={{ height: spacing.xxl }} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  navTitle: { ...typography.titleLarge, color: colors.textPrimary },
  resetText: { ...typography.labelMedium, color: colors.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.lightGray, borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1, ...typography.bodyMedium, color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  searchBtn: {
    backgroundColor: colors.accent, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: radius.small,
  },
  searchBtnText: { ...typography.labelMedium, color: colors.white },
  filterBlock: { marginBottom: spacing.sm },
  filterLabel: {
    ...typography.labelSmall, color: colors.textSecondary,
    marginLeft: spacing.md, marginBottom: spacing.xs,
  },
  chipScroll: { paddingHorizontal: spacing.md, gap: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  chipDefault: { backgroundColor: colors.lightGray },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { ...typography.labelSmall, color: colors.textPrimary },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  divider: {
    height: 1, backgroundColor: colors.divider,
    marginVertical: spacing.sm, marginHorizontal: spacing.md,
  },
  emptyCenter: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl,
  },
  emptyTitle: { ...typography.bodyLarge, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: {
    ...typography.bodySmall, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.sm,
  },
  resultCount: {
    ...typography.labelMedium, color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.large,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.card,
  },
  productImg: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: colors.lightGray,
  },
  productImgPh: { alignItems: 'center', justifyContent: 'center' },
  scoreBadgeOverlay: {
    position: 'absolute', bottom: -4, right: -4,
    paddingHorizontal: 4, paddingVertical: 2,
    borderRadius: 6, minWidth: 22, alignItems: 'center',
  },
  scoreBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },
  scoreCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreCircleNum: { ...typography.numericMedium },
  scoreCircleGrade: { fontSize: 10, fontWeight: '700' },
  productBrand: { ...typography.labelSmall, color: colors.textSecondary },
  productName: { ...typography.bodyMedium, fontWeight: '500', color: colors.textPrimary },
  productType: { ...typography.labelSmall, color: colors.textSecondary },
  allLoaded: {
    ...typography.caption, color: 'rgba(92,107,102,0.6)',
    textAlign: 'center', marginVertical: spacing.md,
  },
});
