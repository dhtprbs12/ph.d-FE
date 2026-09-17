import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import type { CommunityStats, Pet } from '../types';
import { formatCommunityScans } from '../types';
import { useApp } from '../context/AppContext';
import * as scanService from '../services/scanService';
import * as communityService from '../services/communityService';
import type { RecentActivity } from '../services/communityService';
import gamificationService, { GamificationSummary } from '../services/gamificationService';
import petFoodService, { CurrentFood } from '../services/petFoodService';
import api from '../services/api';
import { toTitleCase, buildThumbUrl } from '../utils/helpers';
import { getBaseCharacter, getItemLayer } from '../utils/characterAssets';
import shopService, { CharacterState } from '../services/shopService';
import ZoomableImageModal from '../components/ZoomableImageModal';
import NomNomNotesCard from '../components/NomNomNotesCard';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

function withOpacity(color: string, opacity: number): string {
  if (color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color;
}

/* ─── Staggered Appear ─────────────────────────────────────────── */

function StaggeredView({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ─── Pet Avatar ───────────────────────────────────────────────── */

function PetAvatar({ pet, size = 56 }: { pet: Pet; size?: number }) {
  const isDog = pet.pet_type === 'dog';
  const bgColor = isDog
    ? withOpacity(colors.accent, 0.2)
    : withOpacity(colors.primary, 0.2);
  const emoji = isDog ? '🐕' : '🐱';

  if (pet.photoData) {
    const uri = pet.photoData.startsWith('data:')
      ? pet.photoData
      : pet.photoData.startsWith('file://') || pet.photoData.startsWith('http')
        ? pet.photoData
        : `data:image/jpeg;base64,${pet.photoData}`;
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

/* ─── Gamification Header ──────────────────────────────────────── */

function GamificationHeader({ onCharacterPress, petName, petId }: { onCharacterPress: () => void; petName?: string; petId?: string }) {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [equipped, setEquipped] = useState<CharacterState['equipped'] | null>(null);

  useFocusEffect(useCallback(() => {
    gamificationService.getSummary().then(setSummary).catch(console.warn);
    if (petId) {
      shopService.getCharacter(petId).then(c => setEquipped(c.equipped)).catch(console.warn);
    }
    shopService.getItems('hat').catch(() => {});
  }, [petId]));

  if (!summary) return null;

  const baseImg = getBaseCharacter('dog');

  return (
    <Pressable onPress={onCharacterPress} style={styles.gamHeader}>
      <View style={styles.gamCharacterArea}>
        <View style={{ width: 200, height: 200, position: 'relative' }}>
          <Image source={baseImg} style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 200 }} resizeMode="contain" />
          {equipped && (['clothes', 'accessory', 'hat', 'glasses', 'effect'] as const).map(slot => {
            const item = equipped[slot];
            if (!item) return null;
            const layer = getItemLayer(item.assetKey);
            if (!layer) return null;
            return (
              <Image
                key={slot}
                source={layer}
                style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 200 }}
                resizeMode="contain"
              />
            );
          })}
        </View>
        <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: -4 }]}>Lil {petName || 'Buddy'}</Text>
        {summary.scanLevel.nextLevel && (
          <View style={styles.gamProgressBar}>
            <View style={[styles.gamProgressFill, {
              width: `${Math.min(100, (summary.scanLevel.nextLevel.progress.current / summary.scanLevel.nextLevel.progress.target) * 100)}%`,
            }]} />
          </View>
        )}
      </View>
      <View style={styles.gamBottomRow}>
        <View style={styles.gamLevelBadge}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Lv.{summary.scanLevel.currentLevel}</Text>
        </View>
        <View style={styles.gamTokenBadge}>
          <Text style={{ fontSize: 14 }}>🦴</Text>
          <Text style={[typography.labelLarge, { color: colors.accent }]}>
            {summary.tokens.balance}
          </Text>
        </View>
        {summary.streak.currentStreak > 0 && (
          <View style={styles.gamStreakBadge}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={[typography.labelMedium, { color: colors.danger }]}>
              {summary.streak.currentStreak}d
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ─── Quick Action Row ─────────────────────────────────────────── */

function QuickActionRow({
  isEnabled,
  navigation,
  selectedPet,
}: {
  isEnabled: boolean;
  navigation: Nav;
  selectedPet: Pet | null;
}) {
  const actions = [
    { icon: 'barcode-outline' as const, label: 'Barcode', color: colors.accent, onPress: () => navigation.navigate('QuickScan') },
    { icon: 'search' as const, label: 'Search', color: colors.safe, onPress: () => navigation.navigate('ProductSearch') },
    { icon: 'help-circle-outline' as const, label: 'Safe?', color: '#E67E22', onPress: () => navigation.navigate('FoodCheck') },
  ];

  return (
    <View style={styles.quickActionRow}>
      {actions.map(a => (
        <Pressable
          key={a.label}
          onPress={a.onPress}
          disabled={!isEnabled}
          style={[styles.quickActionBtn, { opacity: isEnabled ? 1 : 0.5 }]}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: a.color + '1A' }]}>
            <Ionicons name={a.icon} size={22} color={a.color} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ─── Current Food Card ────────────────────────────────────────── */

function CurrentFoodCard({ pet, navigation }: { pet: Pet; navigation: Nav }) {
  const [currentFood, setCurrentFood] = useState<CurrentFood | null>(null);
  const [showFoodInput, setShowFoodInput] = useState(false);
  const [foodNameInput, setFoodNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(useCallback(() => {
    if (pet?.id) {
      petFoodService.getCurrentFood(pet.id).then(setCurrentFood).catch(console.warn);
    }
  }, [pet?.id]));

  const handleSearchFood = (text: string) => {
    setFoodNameInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/products/search', { params: { q: text.trim(), petType: pet.pet_type, limit: 5 } });
        setSearchResults(data.products || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectProduct = async (product: any) => {
    if (currentFood) {
      setPendingProduct(product);
      return;
    }
    await doSetFood(product);
  };

  const doSetFood = async (product: any) => {
    setSaving(true);
    try {
      await petFoodService.setCurrentFood(pet.id, {
        productId: product.id,
        productName: product.name,
        brand: product.brand || undefined,
      });
      const updated = await petFoodService.getCurrentFood(pet.id);
      setCurrentFood(updated);
      setShowFoodInput(false);
      setFoodNameInput('');
      setSearchResults([]);
      setPendingProduct(null);
    } catch (e) {
      console.warn('Failed to save food:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFreeText = async () => {
    if (!foodNameInput.trim()) return;
    setSaving(true);
    try {
      await petFoodService.setCurrentFood(pet.id, { productName: foodNameInput.trim() });
      const updated = await petFoodService.getCurrentFood(pet.id);
      setCurrentFood(updated);
      setShowFoodInput(false);
      setFoodNameInput('');
      setSearchResults([]);
    } catch (e) {
      console.warn('Failed to save food:', e);
    } finally {
      setSaving(false);
    }
  };

  const hasProductId = currentFood?.productId != null;

  return (
    <View style={[styles.card, shadows.card]}>
      {currentFood ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {currentFood.imageUrl ? (
              <Pressable onPress={() => setZoomImageUri(currentFood.imageUrl)}>
                <Image source={{ uri: buildThumbUrl(currentFood.imageUrl) || currentFood.imageUrl }} style={styles.foodImage} />
              </Pressable>
            ) : (
              <View style={[styles.foodImage, { backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="nutrition-outline" size={24} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[typography.labelLarge, { color: colors.textPrimary }]} numberOfLines={1}>
                {toTitleCase(currentFood.productName)}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {pet.name} · Day {currentFood.daysOnFood}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('CheckIn', {
                petId: pet.id,
                petName: pet.name,
                foodName: currentFood.productName,
                foodImage: currentFood.imageUrl,
                daysOnFood: currentFood.daysOnFood,
              })}
              style={styles.checkinBtn}
            >
              <Text style={[typography.labelSmall, { color: colors.white }]}>Check-in</Text>
            </Pressable>
          </View>
          {/* Scan nudge for free-text food */}
          {!hasProductId && (
            <Pressable
              onPress={() => navigation.navigate('QuickScan', { mode: 'selectFood', petId: pet.id })}
              style={styles.scanNudge}
            >
              <Ionicons name="scan-outline" size={14} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600', flex: 1 }}>Scan to unlock full tracking & insights</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => setShowFoodInput(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}
        >
          <View style={[styles.foodImage, { backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>Add Current Food</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Track what {pet.name} eats</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
      {showFoodInput && (
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            <TextInput
              style={[styles.foodInput, { flex: 1 }]}
              value={foodNameInput}
              onChangeText={handleSearchFood}
              placeholder="Search food name..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
              autoFocus
            />
            <Pressable onPress={() => { setShowFoodInput(false); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.foodDropdown}>
              {searchResults.map((p: any) => (
                <Pressable key={p.id} onPress={() => handleSelectProduct(p)} style={styles.foodDropdownItem}>
                  <Ionicons name="nutrition-outline" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }} numberOfLines={1}>{p.name}</Text>
                    {p.brand && <Text style={{ fontSize: 11, color: colors.textSecondary }}>{p.brand}</Text>}
                  </View>
                  {p.base_dog_score && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{p.base_dog_score}pt</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
          {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 4 }} />}
          {/* Free text save + barcode option */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            {foodNameInput.trim().length > 0 && (
              <Pressable onPress={handleSaveFreeText} disabled={saving} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {saving ? 'Saving...' : `Save "${foodNameInput.trim()}" as-is`}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => { setShowFoodInput(false); setSearchResults([]); navigation.navigate('QuickScan', { mode: 'selectFood', petId: pet.id }); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="barcode-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Scan barcode</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Switch Food Confirmation Modal */}
      {pendingProduct && (
        <Modal transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 24, marginHorizontal: 32, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 32 }}>🔄</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>Switch Food?</Text>
              <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Current</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{toTitleCase(currentFood?.productName || '')}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Day {currentFood?.daysOnFood}</Text>
              </View>
              <Ionicons name="arrow-down" size={20} color={colors.textSecondary} />
              <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>New</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>{toTitleCase(pendingProduct.name)}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>This will end tracking for the current food and start a new period.</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, width: '100%' }}>
                <Pressable onPress={() => setPendingProduct(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.lightGray, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => doSetFood(pendingProduct)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Switch</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
      <ZoomableImageModal uri={zoomImageUri} visible={!!zoomImageUri} onClose={() => setZoomImageUri(null)} />
    </View>
  );
}

/* ─── Pet Selector Card ────────────────────────────────────────── */

function PetSelectorCard({
  pet,
  onPress,
}: {
  pet: Pet;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <PetAvatar pet={pet} size={56} />

        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[typography.labelMedium, { color: colors.textSecondary }]}
          >
            Analyzing for
          </Text>
          <Text
            style={[typography.displaySmall, { color: colors.textPrimary }]}
          >
            {pet.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary }]}
            >
              {pet.pet_type === 'dog' ? 'Dog' : 'Cat'}
            </Text>
            {pet.breed != null && (
              <>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary },
                  ]}
                >
                  •
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary },
                  ]}
                >
                  {pet.breed}
                </Text>
              </>
            )}
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Text style={[typography.labelSmall, { color: colors.primary }]}>
            Change
          </Text>
          <Ionicons name="chevron-down" size={12} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

/* ─── No Pet Card ──────────────────────────────────────────────── */

function NoPetCard({ onAddPet }: { onAddPet: () => void }) {
  return (
    <View
      style={[
        styles.cardBase,
        shadows.card,
        { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
      ]}
    >
      <Ionicons name="paw" size={40} color={colors.textSecondary} />
      <Text style={[typography.bodyLarge, { color: colors.textPrimary }]}>
        Add a Pet First
      </Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, textAlign: 'center' },
        ]}
      >
        Create a pet profile to get personalized food analysis
      </Text>
      <Pressable
        onPress={onAddPet}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={[typography.labelLarge, { color: colors.white }]}>
          Add Pet
        </Text>
      </Pressable>
    </View>
  );
}

/* ─── Community Trust Banner (scans only) ───────────────────── */

function CommunityTrustBanner({
  stats,
  activity,
}: {
  stats: CommunityStats | null;
  activity: RecentActivity[];
}) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (activity.length === 0) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCurrentIdx(prev => (prev + 1) % activity.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [activity.length, fadeAnim]);

  if (stats == null) {
    return null;
  }

  const current = activity[currentIdx];
  const petIcon = current?.petType === 'cat' ? '🐱' : '🐕';

  return (
    <View style={styles.communityBanner}>
      <View style={styles.communityScansRow}>
        <View style={styles.communityIconPlate}>
          <Ionicons name="people" size={14} color={colors.primary} />
        </View>
        <Text style={[styles.communityBannerText, { flex: 1, minWidth: 0 }]}>
          <Text style={styles.communityCount}>{formatCommunityScans(stats.totalScans)}</Text>
          {' scans by pet parents'}
        </Text>
      </View>
      {current && (
        <Animated.View style={[styles.liveFeedRow, { opacity: fadeAnim }]}>
          <Text style={styles.liveFeedText} numberOfLines={1}>
            {petIcon} A pet parent analyzed{' '}
            <Text style={styles.liveFeedProduct}>
              {current.brand ? `${current.brand} ` : ''}{current.productName}
            </Text>
            {current.score ? ` · ${current.score}` : ''}
          </Text>
          <Text style={styles.liveFeedTime}>{current.timeAgo}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* ─── AAFCO info (below Find Safe Food to reduce clutter up top) ─ */

function AafcoGuidelinesCallout() {
  return (
    <View style={styles.aafcoCallout}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Ionicons name="shield-checkmark" size={14} color={colors.safe} />
        <Text style={styles.communityLabel}>AAFCO Guidelines</Text>
      </View>
      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
        The U.S. standard for pet food nutrition & labeling
      </Text>
    </View>
  );
}

/* ─── Label Scan Prompt Card ───────────────────────────────────── */

function LabelScanPromptCard({
  isEnabled,
  onPress,
}: {
  isEnabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!isEnabled}
      style={({ pressed }) => [
        styles.cardBase,
        shadows.card,
        { opacity: isEnabled ? (pressed ? 0.92 : 1) : 0.6 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={[
            styles.iconPlate,
            { backgroundColor: withOpacity(colors.primary, 0.15) },
          ]}
        >
          <Ionicons name="camera" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[
              typography.bodyLarge,
              { fontWeight: '600', color: colors.textPrimary },
            ]}
          >
            Label Scan
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary }]}
          >
            Full ingredient analysis for your pet
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

/* ─── Quick Scan Card ──────────────────────────────────────────── */

function QuickScanCard({
  isEnabled,
  onPress,
}: {
  isEnabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!isEnabled}
      style={({ pressed }) => [
        styles.cardBase,
        shadows.card,
        { opacity: isEnabled ? (pressed ? 0.92 : 1) : 0.6 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={[
            styles.iconPlate,
            { backgroundColor: withOpacity(colors.accent, 0.15) },
          ]}
        >
          <Ionicons name="barcode-outline" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[
              typography.bodyLarge,
              { fontWeight: '600', color: colors.textPrimary },
            ]}
          >
            Quick Scan
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary }]}
          >
            Scan barcode for instant results
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

/** Enter ingredients manually (no label photo) — same flow as round packs from label scan. */
function IngredientManualCard({
  isEnabled,
  onPress,
}: {
  isEnabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!isEnabled}
      style={({ pressed }) => [
        styles.cardBase,
        shadows.card,
        { opacity: isEnabled ? (pressed ? 0.92 : 1) : 0.6 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={[
            styles.iconPlate,
            { backgroundColor: withOpacity(colors.accent, 0.18) },
          ]}
        >
          <Ionicons name="list-outline" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[
              typography.bodyLarge,
              { fontWeight: '600', color: colors.textPrimary },
            ]}
          >
            Type ingredients
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary }]}
          >
            One line at a time — no product photo in results
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

/* ─── Food Check Card (ScanModeCard) ───────────────────────────── */

function FoodCheckCard({
  isEnabled,
  onPress,
}: {
  isEnabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!isEnabled}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        { opacity: isEnabled ? (pressed ? 0.92 : 1) : 0.6 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View
          style={[
            styles.iconPlate,
            { backgroundColor: withOpacity(colors.accent, 0.15) },
          ]}
        >
          <Ionicons
            name="help-circle-outline"
            size={26}
            color={colors.accent}
          />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[
              typography.bodyLarge,
              { fontWeight: '600', color: colors.textPrimary },
            ]}
          >
            Food Check
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary }]}
          >
            Snap a photo of any food
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

/* ─── Find Safe Food Card ──────────────────────────────────────── */

function FindSafeFoodCard({
  pet,
  onPress,
}: {
  pet: Pet | null;
  onPress: () => void;
}) {
  const isEnabled = pet != null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!isEnabled}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        { opacity: isEnabled ? (pressed ? 0.92 : 1) : 0.6 },
      ]}
    >
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={[
              styles.iconPlate,
              { backgroundColor: withOpacity(colors.safe, 0.15) },
            ]}
          >
            <Ionicons name="search" size={26} color={colors.safe} />
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text
              style={[
                typography.bodyLarge,
                { fontWeight: '600', color: colors.textPrimary },
              ]}
            >
              Find Safe Food
            </Text>
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary }]}
            >
              Search and filter food
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>

      </View>
    </Pressable>
  );
}

/* ─── Pet Selector Modal ───────────────────────────────────────── */

function PetSelectorModal({
  visible,
  pets,
  selectedPetId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  pets: Pet[];
  selectedPetId?: string;
  onSelect: (pet: Pet) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = Dimensions.get('window');
  /** iOS .sheet: large detent (Swift PetSelectorSheet) — not wrap-content, so it matches native */
  const sheetH = winH * 0.88;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalDim}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalSheet,
            { height: sheetH, paddingBottom: Math.max(insets.bottom, spacing.md) },
            shadows.elevated,
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Bar + nav row like Swift: centered title, trailing Done pill */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderSpacer} />
            <View style={styles.modalTitleWrap}>
              <Text
                style={[
                  typography.titleLarge,
                  { color: colors.textPrimary, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                Select Pet
              </Text>
            </View>
            <View style={[styles.modalHeaderSpacer, { alignItems: 'flex-end' }]}>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text
                  style={[
                    typography.labelLarge,
                    { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.modalScroll}
            bounces={pets.length > 8}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={pets.length > 4}
          >
            {pets.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  styles.modalRow,
                  index === pets.length - 1 && styles.modalRowLast,
                ]}
                onPress={() => onSelect(item)}
              >
                <PetAvatar pet={item} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text
                    style={[
                      typography.bodyLarge,
                      { color: colors.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.pet_type === 'dog' ? 'Dog' : 'Cat'}
                  </Text>
                </View>
                {item.id === selectedPetId && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ═══ Home Screen ═══════════════════════════════════════════════ */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { pets, selectedPet, selectPet } = useApp();
  const [communityStats, setCommunityStats] =
    useState<CommunityStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [petModalVisible, setPetModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [comm, act] = await Promise.allSettled([
            scanService.getCommunityStats(),
            communityService.getRecentActivity(),
          ]);

          if (cancelled) return;
          if (comm.status === 'fulfilled') setCommunityStats(comm.value);
          if (act.status === 'fulfilled') setRecentActivity(act.value);
        } catch (e) {
          console.warn('[Home] loadStats error:', e);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const openPetPicker = useCallback(() => setPetModalVisible(true), []);
  const closePetPicker = useCallback(() => setPetModalVisible(false), []);
  const onSelectPet = useCallback(
    (pet: Pet) => {
      selectPet(pet);
      setPetModalVisible(false);
    },
    [selectPet],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <Image source={require('../../logo.png')} style={styles.appLogo} />
        <Text style={styles.navTitle}>PHD</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.vstack}>
          {/* Pet Selector / No Pet */}
          <StaggeredView index={0}>
            {selectedPet ? (
              <PetSelectorCard pet={selectedPet} onPress={openPetPicker} />
            ) : (
              <NoPetCard
                onAddPet={() => navigation.navigate('AddPet')}
              />
            )}
          </StaggeredView>

          {/* Gamification Header (Character) */}
          <StaggeredView index={1}>
            <GamificationHeader onCharacterPress={() => navigation.navigate('Character')} petName={selectedPet?.name} petId={selectedPet?.id} />
          </StaggeredView>

          {/* Quick Action Row */}
          <StaggeredView index={2}>
            <QuickActionRow
              isEnabled={selectedPet != null}
              navigation={navigation}
              selectedPet={selectedPet}
            />
          </StaggeredView>

          {/* Current Food Card */}
          {selectedPet && (
            <StaggeredView index={3}>
              <CurrentFoodCard pet={selectedPet} navigation={navigation} />
            </StaggeredView>
          )}

          {/* Nom Nom Notes */}
          {selectedPet && (
            <StaggeredView index={4}>
              <NomNomNotesCard
                petId={selectedPet.id}
                onViewDetail={(date) =>
                  navigation.navigate('NomNomDetail', {
                    petId: selectedPet.id,
                    date,
                    petName: selectedPet.name,
                  })
                }
              />
            </StaggeredView>
          )}

          {/* Community Trust Banner */}
          <StaggeredView index={5}>
            <CommunityTrustBanner stats={communityStats} activity={recentActivity} />
          </StaggeredView>

          {/* AAFCO Guidelines */}
          <StaggeredView index={6}>
            <AafcoGuidelinesCallout />
          </StaggeredView>
        </View>
      </ScrollView>

      {/* Pet Selector Modal */}
      <PetSelectorModal
        visible={petModalVisible}
        pets={pets}
        selectedPetId={selectedPet?.id}
        onSelect={onSelectPet}
        onClose={closePetPicker}
      />
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  vstack: {
    gap: spacing.lg,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 8,
  },
  appLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.md,
  },
  cardBase: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    overflow: 'hidden',
  },
  iconPlate: {
    width: 60,
    height: 60,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.medium,
    width: 150,
    alignItems: 'center',
  },
  communityBanner: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 6,
  },
  communityScansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  communityIconPlate: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '14',
  },
  communityBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 16,
  },
  communityCount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  communityLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  liveFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 34,
    gap: spacing.xs,
  },
  liveFeedText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  liveFeedProduct: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  liveFeedTime: {
    fontSize: 10,
    color: colors.textSecondary + '99',
  },
  aafcoCallout: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: withOpacity(colors.safe, 0.1),
    borderRadius: radius.medium,
    gap: 4,
  },
  /** Pet sheet: match iOS .sheet large detent (Swift PetSelectorSheet) */
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  modalHeaderSpacer: {
    width: 72,
  },
  modalTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xs,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  modalRowLast: {
    borderBottomWidth: 0,
  },
  gamHeader: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.large,
    gap: spacing.sm,
    ...shadows.card,
  },
  gamCharacterArea: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  gamLevelBadge: {
    backgroundColor: colors.primary + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  gamBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gamStatsArea: {
    flex: 1,
    gap: spacing.xs,
  },
  gamStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  gamTokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  gamStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  gamProgressBar: {
    height: 6,
    width: 120,
    borderRadius: 3,
    backgroundColor: colors.lightGray,
  },
  gamProgressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  foodImage: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    overflow: 'hidden',
  },
  scanNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.medium,
  },
  foodInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    backgroundColor: colors.card,
    color: colors.textPrimary,
  },
  foodDropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  foodDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
});
