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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import type { CommunityStats, Pet, UserStats } from '../types';
import { formatCommunityScans } from '../types';
import { useApp } from '../context/AppContext';
import * as scanService from '../services/scanService';
import { getDeviceId } from '../services/authService';

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

/* ─── User Badge Card ──────────────────────────────────────────── */

function UserBadgeCard({ stats }: { stats: UserStats }) {
  const { badge, scanCount } = stats;
  const badgeColor = badge.color || colors.primary;
  const progress =
    badge.progress != null
      ? badge.progress <= 1
        ? badge.progress
        : badge.progress / 100
      : 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.large,
        backgroundColor: withOpacity(badgeColor, 0.08),
        borderWidth: 1,
        borderColor: withOpacity(badgeColor, 0.3),
        gap: spacing.md,
      }}
    >
      <Text style={{ fontSize: 36 }}>{badge.icon}</Text>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: badgeColor }}>
          {badge.title}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {scanCount} scans completed
        </Text>
      </View>

      {badge.nextAt != null && badge.progress != null ? (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '500',
              color: colors.textSecondary,
            }}
          >
            Level {badge.level}
          </Text>
          <View
            style={{
              width: 60,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.lightGray,
            }}
          >
            <View
              style={{
                width: 60 * Math.min(1, progress),
                height: 8,
                borderRadius: 4,
                backgroundColor: badgeColor,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>
            {badge.nextAt - scanCount} to next
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 20 }}>👑</Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: colors.textSecondary,
            }}
          >
            MAX
          </Text>
        </View>
      )}
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

/* ─── Community Trust Banner ───────────────────────────────────── */

function CommunityTrustBanner({
  stats,
}: {
  stats: CommunityStats | null;
}) {
  return (
    <View style={styles.communityBanner}>
      {stats != null && stats.totalScans >= 100 && (
        <View style={styles.communityScansRow}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={styles.communityLabel}>
            {formatCommunityScans(stats.totalScans)} community scans
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
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

/** Dev / QA: cylindrical can interval OCR (Cloud Vision). */
function RealtimeCanScanCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        { opacity: pressed ? 0.92 : 1 },
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
            { backgroundColor: withOpacity(colors.primaryLight, 0.2) },
          ]}
        >
          <Ionicons name="scan-outline" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            style={[
              typography.bodyLarge,
              { fontWeight: '600', color: colors.textPrimary },
            ]}
          >
            통 캔 실시간 OCR
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary }]}
          >
            Cloud Vision · 1.5초 간격 3프레임 (테스트)
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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [petModalVisible, setPetModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deviceId = await getDeviceId();

        const [comm, u] = await Promise.allSettled([
          scanService.getCommunityStats(),
          scanService.getUserStats(deviceId),
        ]);

        if (cancelled) return;
        if (comm.status === 'fulfilled') setCommunityStats(comm.value);

        if (u.status === 'fulfilled') {
          setUserStats(u.value);
        }
      } catch (e) {
        console.warn('[Home] loadStats error:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          {/* User Badge */}
          {userStats && (
            <StaggeredView index={0}>
              <UserBadgeCard stats={userStats} />
            </StaggeredView>
          )}

          {/* Pet Selector / No Pet */}
          <StaggeredView index={1}>
            {selectedPet ? (
              <PetSelectorCard pet={selectedPet} onPress={openPetPicker} />
            ) : (
              <NoPetCard
                onAddPet={() => navigation.navigate('AddPet')}
              />
            )}
          </StaggeredView>

          {/* Community Trust Banner */}
          <StaggeredView index={2}>
            <CommunityTrustBanner stats={communityStats} />
          </StaggeredView>

          {/* Section Header */}
          <StaggeredView index={3}>
            <View style={{ gap: spacing.xs }}>
              <Text
                style={[
                  typography.displaySmall,
                  { color: colors.textPrimary },
                ]}
              >
                Analyze Food
              </Text>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: colors.textSecondary },
                ]}
              >
                Check ingredients or find safe options
              </Text>
            </View>
          </StaggeredView>

          {/* Action Cards */}
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <StaggeredView index={4}>
              <LabelScanPromptCard
                isEnabled={selectedPet != null}
                onPress={() => navigation.navigate('TwoStepScan')}
              />
            </StaggeredView>

            <StaggeredView index={5}>
              <FoodCheckCard
                isEnabled={selectedPet != null}
                onPress={() => navigation.navigate('FoodCheck')}
              />
            </StaggeredView>

            <StaggeredView index={6}>
              <FindSafeFoodCard
                pet={selectedPet}
                onPress={() => navigation.navigate('ProductSearch')}
              />
            </StaggeredView>

            <StaggeredView index={7}>
              <RealtimeCanScanCard
                onPress={() => navigation.navigate('RealtimeIngredientScan')}
              />
            </StaggeredView>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: withOpacity(colors.primary, 0.08),
    borderRadius: radius.medium,
    gap: spacing.lg,
  },
  communityScansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  communityLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
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
});
