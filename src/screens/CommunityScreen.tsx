import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows, typography } from '../theme';
import { getGradeColor, getPetTypeIcon } from '../theme';
import * as communityService from '../services/communityService';
import type { TrendingProduct, FeedCard, PetOfTheWeekItem, TopScanner, RecentActivity, BreedPopularResult } from '../services/communityService';
import type { CommunityStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import MiniCharacter from '../components/MiniCharacter';
import ZoomableImageModal from '../components/ZoomableImageModal';
import type { CharacterState } from '../services/shopService';
import { buildImageUrl, buildThumbUrl } from '../utils/helpers';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

/* ───────── Score Badge ───────── */
function ScoreBadge({ score, size = 28 }: { score: number | null; size?: number }) {
  if (score == null) return null;
  const color = score >= 80 ? colors.safe : score >= 60 ? colors.caution : colors.danger;
  return (
    <View style={[s.scoreBadge, { borderColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.scoreText, { color, fontSize: size * 0.4 }]}>{score}</Text>
    </View>
  );
}

/* ───────── Section Header ───────── */
function SectionHeader({ icon, iconColor, title, trailing }: { icon: string; iconColor: string; title: string; trailing?: React.ReactNode }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderLeft}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

/* ═══════════ 1. PET OF THE WEEK (Podium) ═══════════ */
function toCharacterData(pet: PetOfTheWeekItem): CharacterState {
  return {
    characterType: (pet.characterType as 'dog' | 'cat') || 'dog',
    equipped: {
      hat: pet.equipped.hat ? { ...pet.equipped.hat, nameKo: pet.equipped.hat.name } : null,
      glasses: pet.equipped.glasses ? { ...pet.equipped.glasses, nameKo: pet.equipped.glasses.name } : null,
      accessory: pet.equipped.accessory ? { ...pet.equipped.accessory, nameKo: pet.equipped.accessory.name } : null,
      clothes: pet.equipped.clothes ? { ...pet.equipped.clothes, nameKo: pet.equipped.clothes.name } : null,
      background: pet.equipped.background ? { ...pet.equipped.background, nameKo: pet.equipped.background.name } : null,
      effect: pet.equipped.effect ? { ...pet.equipped.effect, nameKo: pet.equipped.effect.name } : null,
    },
    ownedItems: [],
  };
}

function PetOfTheWeekSection({ pets, loading, onCharacterPress }: { pets: PetOfTheWeekItem[]; loading: boolean; onCharacterPress: (data: CharacterState) => void }) {
  if (loading) return <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />;
  if (pets.length === 0) return (
    <View style={s.emptySmall}>
      <Ionicons name="paw" size={28} color={colors.divider} />
      <Text style={s.emptyText}>No featured pets yet</Text>
    </View>
  );

  // Always show 3 slots — fill missing with placeholder
  const defaultPet: PetOfTheWeekItem = {
    rank: 0, petId: '', petName: '???', petType: 'dog', breed: null,
    nickname: '', characterType: 'dog', equipped: { hat: null, glasses: null, accessory: null, clothes: null, background: null, effect: null }, itemCount: 0,
  };
  const filled = [
    pets[0] || { ...defaultPet, rank: 1 },
    pets[1] || { ...defaultPet, rank: 2, petId: '_2' },
    pets[2] || { ...defaultPet, rank: 3, petId: '_3' },
  ];
  // Podium order: 2nd - 1st - 3rd
  const podiumOrder = [filled[1], filled[0], filled[2]];
  const blockHeights = [72, 100, 56];
  const charSizes = [48, 64, 44];
  const blockColors = [colors.primaryLight, colors.primary, colors.accent];

  return (
    <View>
      {/* Each column: character on top + block below, aligned at bottom */}
      <View style={s.podiumBlockRow}>
        {podiumOrder.map((pet, i) => {
          const isFirst = i === 1;
          return (
            <View key={pet.petId || `slot-${i}`} style={{ flex: 1, alignItems: 'center' }}>
              {isFirst && <Text style={{ fontSize: 18, marginBottom: 2 }}>👑</Text>}
              <Pressable onPress={() => (pet.petId && !pet.petId.startsWith('_')) ? onCharacterPress(toCharacterData(pet)) : undefined}>
                <MiniCharacter size={charSizes[i]} characterData={toCharacterData(pet)} />
              </Pressable>
              <View style={[s.podiumBlock, { height: blockHeights[i], backgroundColor: blockColors[i], marginTop: -2 }]}>
                <Text style={s.podiumBlockNumber}>{pet.rank}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {/* Names below podium */}
      <View style={s.podiumInfoRow}>
        {podiumOrder.map((pet, i) => (
          <View key={pet.petId || `name-${i}`} style={[s.podiumInfoCol, { flex: 1 }]}>
            <Text style={s.podiumPetName} numberOfLines={1}>{pet.petName}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ═══════════ 2. WHAT ARE OTHERS FEEDING? ═══════════ */
function BreedPopularSection({ data, loading, onProductPress }: { data: BreedPopularResult | null; loading: boolean; onProductPress: (productId: string, name: string, brand?: string, score?: number | null, imageUrl?: string | null) => void }) {
  if (loading) return <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />;
  if (!data || data.foods.length === 0) return (
    <View style={s.emptySmall}>
      <Ionicons name="nutrition-outline" size={28} color={colors.divider} />
      <Text style={s.emptyText}>Not enough data yet</Text>
    </View>
  );

  return (
    <View style={s.breedSection}>
      <View style={s.breedHeader}>
        <Text style={s.breedLabel}>{data.breed}</Text>
        <Text style={s.breedParents}>{data.parentCount} pet parents</Text>
      </View>
      {data.foods.map((food, i) => {
        const scoreColor = (food.score ?? 0) >= 80 ? colors.safe : (food.score ?? 0) >= 60 ? colors.caution : colors.danger;
        const barWidth = Math.max(((food.score ?? 0) / 100) * 100, 10);
        return (
          <Pressable key={food.productId} style={s.breedFoodRow} onPress={() => onProductPress(food.productId, food.name, food.brand, food.score, food.imageUrl)}>
            <Text style={s.breedFoodRank}>#{i + 1}</Text>
            {food.imageUrl ? (
              <Image source={{ uri: buildThumbUrl(food.imageUrl) || '' }} style={s.breedFoodImage} />
            ) : (
              <View style={[s.breedFoodImage, s.breedFoodImagePlaceholder]}>
                <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
              </View>
            )}
            <View style={s.breedFoodInfo}>
              <Text style={s.breedFoodName} numberOfLines={1}>{food.name}</Text>
              {food.brand ? <Text style={s.breedFoodBrand} numberOfLines={1}>{food.brand}</Text> : null}
              <View style={s.breedScoreBar}>
                <View style={[s.breedScoreBarFill, { width: `${barWidth}%`, backgroundColor: scoreColor }]} />
              </View>
            </View>
            <View style={s.breedFoodRight}>
              <ScoreBadge score={food.score} size={32} />
              <Text style={s.breedFoodUsers}>{food.userCount} users</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ═══════════ 3. TRENDING THIS WEEK (existing, refined) ═══════════ */
function TrendingSection({ trending, loading, trendType, onTypeChange, onProductPress }: {
  trending: TrendingProduct[];
  loading: boolean;
  trendType: 'food' | 'treats';
  onTypeChange: (t: 'food' | 'treats') => void;
  onProductPress: (productId: string, name: string, brand?: string, score?: number | null, imageUrl?: string | null) => void;
}) {
  return (
    <>
      <View style={s.segmentRow}>
        <Pressable style={[s.segment, trendType === 'food' && s.segmentActive]} onPress={() => onTypeChange('food')}>
          <Text style={[s.segmentText, trendType === 'food' && s.segmentTextActive]}>Top Foods</Text>
        </Pressable>
        <Pressable style={[s.segment, trendType === 'treats' && s.segmentActive]} onPress={() => onTypeChange('treats')}>
          <Text style={[s.segmentText, trendType === 'treats' && s.segmentTextActive]}>Top Treats</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />
      ) : trending.length === 0 ? (
        <View style={s.emptySmall}>
          <Text style={s.emptyText}>No trending products yet</Text>
        </View>
      ) : (
        <FlatList
          data={trending}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.trendList}
          renderItem={({ item }) => (
            <Pressable style={[s.trendCard, shadows.card]} onPress={() => onProductPress(item.id, item.name, item.brand, item.score, item.image_url)}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={s.trendImage} />
              ) : (
                <View style={[s.trendImage, s.trendImagePlaceholder]}>
                  <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
                </View>
              )}
              <Text style={s.trendName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.trendBrand} numberOfLines={1}>{item.brand}</Text>
              <View style={s.trendFooter}>
                <ScoreBadge score={item.score} />
                <Text style={s.trendScans}>{item.weekly_scans} scans</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </>
  );
}

/* ═══════════ 4. RECENT ACTIVITY ═══════════ */
function RecentActivitySection({ activity, loading }: { activity: RecentActivity[]; loading: boolean }) {
  if (loading) return <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />;
  if (activity.length === 0) return (
    <View style={s.emptySmall}>
      <Text style={s.emptyText}>No recent activity</Text>
    </View>
  );

  return (
    <View style={s.activityList}>
      {activity.map((a, i) => {
        const gradeColor = getGradeColor(a.grade);
        return (
          <View key={i} style={s.activityRow}>
            <View style={s.activityTimeline}>
              <View style={[s.activityDot, { backgroundColor: gradeColor }]} />
              {i < activity.length - 1 && <View style={s.activityLine} />}
            </View>
            <View style={s.activityContent}>
              <View style={s.activityTopRow}>
                <Text style={s.activityText} numberOfLines={1}>
                  <Text style={s.activityNickname}>{a.nickname}</Text>
                  {' scanned '}
                  <Text style={s.activityProduct}>{a.productName}</Text>
                </Text>
              </View>
              <View style={s.activityBottomRow}>
                <View style={[s.activityScorePill, { backgroundColor: gradeColor + '1A' }]}>
                  <Text style={[s.activityScoreText, { color: gradeColor }]}>{a.score} {a.grade}</Text>
                </View>
                <Text style={s.activityTime}>{a.timeAgo}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ═══════════ 5. TOP SCANNERS (Podium) ═══════════ */
function TopScannersSection({ scanners, loading, onPhotoPress }: { scanners: TopScanner[]; loading: boolean; onPhotoPress: (uri: string) => void }) {
  if (loading) return <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />;
  if (scanners.length === 0) return (
    <View style={s.emptySmall}>
      <Ionicons name="trophy-outline" size={28} color={colors.divider} />
      <Text style={s.emptyText}>No scanners yet</Text>
    </View>
  );

  const top3 = scanners.slice(0, 3);
  const rest = scanners.slice(3);

  const defaultScanner: TopScanner = { rank: 0, nickname: '???', weeklyScans: 0, streak: 0, level: 1, totalScans: 0, badge: 'Beginner', petPhotoUrl: null };
  const filled = [
    top3[0] || { ...defaultScanner, rank: 1 },
    top3[1] || { ...defaultScanner, rank: 2, nickname: '???' },
    top3[2] || { ...defaultScanner, rank: 3, nickname: '???' },
  ];
  // Podium order: 2nd - 1st - 3rd
  const podiumOrder = [filled[1], filled[0], filled[2]];
  const podiumHeights = [70, 95, 55];
  const podiumColors = [colors.primaryLight, colors.primary, colors.accent];

  return (
    <View>
      {/* Each column: avatar + block, aligned at bottom */}
      <View style={s.podiumBlockRow}>
        {podiumOrder.map((scanner, i) => {
          const isFirst = i === 1;
          const avatarSize = isFirst ? 48 : 38;
          const avatarW = avatarSize;
          const avatarH = avatarSize * 1.15;
          const photoUri = scanner.petPhotoUrl ? (buildThumbUrl(scanner.petPhotoUrl) ?? null) : null;
          const fullPhotoUri = scanner.petPhotoUrl ? (buildImageUrl(scanner.petPhotoUrl) ?? null) : null;
          return (
            <View key={`scanner-${scanner.rank}`} style={{ flex: 1, alignItems: 'center' }}>
              {isFirst && <Text style={{ fontSize: 18, marginBottom: 2 }}>🏆</Text>}
              <Pressable onPress={() => fullPhotoUri ? onPhotoPress(fullPhotoUri) : undefined}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={[s.scannerAvatar, { width: avatarW, height: avatarH, borderRadius: 10 }]} />
                ) : (
                  <View style={[s.scannerAvatar, { width: avatarW, height: avatarH, borderRadius: 10, backgroundColor: podiumColors[i] + '20' }]}>
                    <Ionicons name="person" size={avatarSize * 0.45} color={podiumColors[i]} />
                  </View>
                )}
              </Pressable>
              <View style={[s.podiumBlock, { height: podiumHeights[i], backgroundColor: podiumColors[i], marginTop: 6 }]}>
                <Text style={s.podiumBlockNumber}>{scanner.rank}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {/* Name + scans below podium */}
      <View style={s.podiumInfoRow}>
        {podiumOrder.map((scanner) => (
          <View key={`info-${scanner.rank}`} style={[s.podiumInfoCol, { flex: 1 }]}>
            <Text style={s.podiumPetName} numberOfLines={1}>{scanner.nickname}</Text>
            {scanner.weeklyScans > 0 && <Text style={s.podiumInfoText}>{scanner.weeklyScans} scans</Text>}
          </View>
        ))}
      </View>

      {rest.length > 0 && (
        <View style={s.restList}>
          {rest.map((scanner) => (
            <View key={scanner.nickname} style={s.restRow}>
              <Text style={s.restRank}>#{scanner.rank}</Text>
              <Text style={s.restNickname}>{scanner.nickname}</Text>
              <View style={s.restRight}>
                <Text style={s.restScans}>{scanner.weeklyScans} scans</Text>
                <View style={[s.restBadge, { backgroundColor: colors.primary + '14' }]}>
                  <Text style={s.restBadgeText}>{scanner.badge}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ═══════════ 6. SAVED BY PET PARENTS (existing, refined) ═══════════ */
function SavedFeedSection({ feed, loading, hasMore, onLoadMore, onProductPress }: {
  feed: FeedCard[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onProductPress: (productId: string, name: string, brand?: string, score?: number | null, imageUrl?: string | null) => void;
}) {
  if (feed.length === 0 && !loading) return (
    <View style={s.emptySmall}>
      <Ionicons name="bookmark-outline" size={28} color={colors.divider} />
      <Text style={s.emptyText}>No saved products yet</Text>
    </View>
  );

  return (
    <>
      {feed.map((item) => (
        <Pressable key={item.save_id} style={[s.feedCard, shadows.card]} onPress={() => onProductPress(item.product_id, item.product_name, item.product_brand, item.score, item.product_image)}>
          <View style={s.feedLeft}>
            {item.pet_photo ? (
              <Image source={{ uri: item.pet_photo }} style={s.feedAvatar} />
            ) : (
              <View style={[s.feedAvatar, s.feedAvatarPlaceholder]}>
                <Ionicons name={item.pet_type === 'cat' ? 'logo-octocat' : 'paw'} size={18} color={colors.textSecondary} />
              </View>
            )}
            <View style={s.feedUserInfo}>
              <Text style={s.feedNickname} numberOfLines={1}>{item.nickname}</Text>
              <Text style={s.feedPetInfo} numberOfLines={1}>
                {item.pet_type === 'cat' ? 'Cat' : 'Dog'}
                {item.breed ? ` · ${item.breed}` : ''}
              </Text>
            </View>
          </View>
          <View style={s.feedRight}>
            {item.product_image ? (
              <Image source={{ uri: item.product_image }} style={s.feedProductImage} />
            ) : (
              <View style={[s.feedProductImage, s.feedProductPlaceholder]}>
                <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
              </View>
            )}
            <Text style={s.feedProductName} numberOfLines={1}>{item.product_name}</Text>
            <ScoreBadge score={item.score} />
          </View>
        </Pressable>
      ))}
      {hasMore && (
        <Pressable style={s.loadMoreBtn} onPress={onLoadMore} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={s.loadMoreText}>Load more</Text>}
        </Pressable>
      )}
    </>
  );
}

/* ═══════════ MAIN SCREEN ═══════════ */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { selectedPet } = useApp();

  const petType = (selectedPet?.pet_type as 'dog' | 'cat') ?? 'dog';
  const breed = selectedPet?.breed ?? undefined;

  const [refreshing, setRefreshing] = useState(false);
  const [zoomChar, setZoomChar] = useState<CharacterState | null>(null);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  // Pet of the Week
  const [potw, setPotw] = useState<PetOfTheWeekItem[]>([]);
  const [potwLoading, setPotwLoading] = useState(true);

  // Breed Popular
  const [breedData, setBreedData] = useState<BreedPopularResult | null>(null);
  const [breedLoading, setBreedLoading] = useState(true);

  // Trending
  const [trendType, setTrendType] = useState<'food' | 'treats'>('food');
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  // Recent Activity
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Top Scanners
  const [scanners, setScanners] = useState<TopScanner[]>([]);
  const [scannersLoading, setScannersLoading] = useState(true);

  // Saved Feed
  const [feed, setFeed] = useState<FeedCard[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadAll = useCallback(async (type?: 'food' | 'treats') => {
    const tt = type ?? trendType;
    try {
      const [potwRes, breedRes, trendRes, actRes, scanRes, feedRes] = await Promise.allSettled([
        communityService.getPetOfTheWeek(petType),
        communityService.getBreedPopular(petType, breed),
        communityService.getTrending(tt, petType),
        communityService.getRecentActivity(petType),
        communityService.getTopScanners(petType),
        communityService.getFeed(0, 20),
      ]);

      if (potwRes.status === 'fulfilled') setPotw(potwRes.value);
      if (breedRes.status === 'fulfilled') setBreedData(breedRes.value);
      if (trendRes.status === 'fulfilled') setTrending(trendRes.value);
      if (actRes.status === 'fulfilled') setActivity(actRes.value);
      if (scanRes.status === 'fulfilled') setScanners(scanRes.value);
      if (feedRes.status === 'fulfilled') {
        setFeed(feedRes.value.feed);
        setHasMore(feedRes.value.hasMore);
        setFeedOffset(feedRes.value.feed.length);
      }
    } catch (e) {
      console.warn('Community load error:', e);
    } finally {
      setPotwLoading(false);
      setBreedLoading(false);
      setTrendLoading(false);
      setActivityLoading(false);
      setScannersLoading(false);
      setFeedLoading(false);
    }
  }, [petType, breed, trendType]);

  useFocusEffect(
    useCallback(() => {
      setPotwLoading(true);
      setBreedLoading(true);
      setTrendLoading(true);
      setActivityLoading(true);
      setScannersLoading(true);
      setFeedLoading(true);
      loadAll();
    }, [petType, breed])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const onTrendTypeChange = (type: 'food' | 'treats') => {
    setTrendType(type);
    setTrendLoading(true);
    communityService.getTrending(type, petType).then(setTrending).catch(() => {}).finally(() => setTrendLoading(false));
  };

  const loadMoreFeed = useCallback(async () => {
    if (!hasMore || feedLoading) return;
    setFeedLoading(true);
    try {
      const data = await communityService.getFeed(feedOffset, 20);
      setFeed(prev => [...prev, ...data.feed]);
      setHasMore(data.hasMore);
      setFeedOffset(feedOffset + data.feed.length);
    } catch {} finally {
      setFeedLoading(false);
    }
  }, [feedOffset, hasMore, feedLoading]);

  const navigateToProduct = (productId: string, name: string, brand?: string, score?: number | null, imageUrl?: string | null) => {
    navigation.navigate('Result', {
      productId,
      product: { id: productId, name, brand: brand ?? '', image_url: imageUrl ?? undefined } as any,
      preloadedScore: { score: score ?? 0 },
      historyImageUrl: imageUrl ?? undefined,
    });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Text style={s.title}>Community</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* 1. Pet of the Week */}
        <View style={s.section}>
          <SectionHeader icon="paw" iconColor={colors.primary} title="Pet of the Week" />
          <PetOfTheWeekSection pets={potw} loading={potwLoading} onCharacterPress={setZoomChar} />
        </View>

        {/* 2. What Are Others Feeding? */}
        <View style={s.section}>
          <SectionHeader icon="nutrition-outline" iconColor={colors.safe} title="What Are Others Feeding?" />
          <BreedPopularSection data={breedData} loading={breedLoading} onProductPress={navigateToProduct} />
        </View>

        {/* 3. Trending This Week */}
        <View style={s.section}>
          <SectionHeader icon="flame" iconColor={colors.accent} title="Trending This Week" />
          <TrendingSection trending={trending} loading={trendLoading} trendType={trendType} onTypeChange={onTrendTypeChange} onProductPress={navigateToProduct} />
        </View>

        {/* 4. Recent Activity */}
        <View style={s.section}>
          <SectionHeader icon="time-outline" iconColor={colors.primaryLight} title="Recent Activity" />
          <RecentActivitySection activity={activity} loading={activityLoading} />
        </View>

        {/* 5. Top Scanners */}
        <View style={s.section}>
          <SectionHeader icon="trophy" iconColor={colors.accent} title="Top Scanners"
            trailing={<View style={s.weekPill}><Text style={s.weekPillText}>This Week</Text></View>}
          />
          <TopScannersSection scanners={scanners} loading={scannersLoading} onPhotoPress={setZoomUri} />
        </View>

        {/* 6. Saved by Pet Parents */}
        <View style={s.section}>
          <SectionHeader icon="heart" iconColor={colors.danger} title="Saved by Pet Parents" />
          <SavedFeedSection feed={feed} loading={feedLoading} hasMore={hasMore} onLoadMore={loadMoreFeed} onProductPress={navigateToProduct} />
        </View>
      </ScrollView>
      <ZoomableImageModal visible={!!zoomChar} onClose={() => setZoomChar(null)}>
        <MiniCharacter size={Dimensions.get('window').width * 0.7} characterData={zoomChar} square />
      </ZoomableImageModal>
      <ZoomableImageModal uri={zoomUri} visible={!!zoomUri} onClose={() => setZoomUri(null)} />
    </View>
  );
}

/* ═══════════ STYLES ═══════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  section: { marginBottom: spacing.xl, paddingHorizontal: spacing.lg },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { ...typography.titleMedium, color: colors.textPrimary },

  /* Score Badge */
  scoreBadge: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontWeight: '700' },

  /* Week Pill */
  weekPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.accent + '20' },
  weekPillText: { ...typography.labelSmall, color: colors.accent, fontWeight: '600' },

  /* Empty */
  emptySmall: { paddingVertical: 30, alignItems: 'center', gap: 6 },
  emptyText: { ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center' },

  /* ─── Podium (shared by Pet of the Week & Top Scanners) ─── */
  podiumPetName: { ...typography.labelLarge, color: colors.textPrimary, textAlign: 'center', fontSize: 12 },
  podiumBlockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  podiumBlock: {
    width: '90%',
    borderTopLeftRadius: radius.medium,
    borderTopRightRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBlockNumber: { fontSize: 24, fontWeight: '800', color: colors.white },
  podiumInfoRow: { flexDirection: 'row', marginTop: 6 },
  podiumInfoCol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  podiumInfoText: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  crownBadge: { marginBottom: 2 },

  /* ─── Scanner Podium extras ─── */
  scannerAvatar: { alignItems: 'center', justifyContent: 'center' },
  restList: { marginTop: spacing.sm, gap: 4 },
  restRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, gap: 8 },
  restRank: { ...typography.labelLarge, color: colors.textSecondary, width: 28, textAlign: 'center' },
  restNickname: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  restRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restScans: { ...typography.bodySmall, color: colors.textSecondary },
  restBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  restBadgeText: { ...typography.labelSmall, color: colors.primary },

  /* ─── Breed Popular ─── */
  breedSection: { gap: 8 },
  breedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  breedLabel: { ...typography.labelLarge, color: colors.textPrimary },
  breedParents: { ...typography.caption, color: colors.textSecondary },
  breedFoodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.medium, padding: 10,
    ...shadows.card,
  },
  breedFoodRank: { ...typography.labelLarge, color: colors.textSecondary, width: 24, textAlign: 'center' },
  breedFoodImage: { width: 40, height: 40, borderRadius: radius.small, backgroundColor: colors.lightGray },
  breedFoodImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  breedFoodInfo: { flex: 1, minWidth: 0, gap: 2 },
  breedFoodName: { ...typography.labelLarge, color: colors.textPrimary },
  breedFoodBrand: { ...typography.caption, color: colors.textSecondary },
  breedScoreBar: { height: 4, borderRadius: 2, backgroundColor: colors.lightGray, marginTop: 3 },
  breedScoreBarFill: { height: 4, borderRadius: 2 },
  breedFoodRight: { alignItems: 'center', gap: 2 },
  breedFoodUsers: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },

  /* ─── Trending ─── */
  segmentRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  segment: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.labelMedium, color: colors.primary },
  segmentTextActive: { color: colors.white },
  trendList: { gap: 10 },
  trendCard: { width: 130, backgroundColor: colors.card, borderRadius: radius.medium, padding: 8 },
  trendImage: { width: '100%', height: 70, borderRadius: radius.small, resizeMode: 'contain', backgroundColor: colors.lightGray, marginBottom: 6 },
  trendImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  trendName: { ...typography.labelLarge, color: colors.textPrimary, marginBottom: 2 },
  trendBrand: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  trendFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendScans: { ...typography.caption, color: colors.textSecondary },

  /* ─── Recent Activity ─── */
  activityList: { gap: 0 },
  activityRow: { flexDirection: 'row', gap: 10 },
  activityTimeline: { alignItems: 'center', width: 16 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityLine: { width: 1, flex: 1, backgroundColor: colors.divider, marginTop: 4 },
  activityContent: { flex: 1, paddingBottom: 14, gap: 4 },
  activityTopRow: { flexDirection: 'row', alignItems: 'center' },
  activityText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  activityNickname: { fontWeight: '600' },
  activityProduct: { fontWeight: '600' },
  activityBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityScorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  activityScoreText: { ...typography.labelSmall, fontWeight: '700' },
  activityTime: { ...typography.caption, color: colors.textSecondary },

  /* ─── Saved Feed ─── */
  feedCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.medium, padding: 12, marginBottom: 8,
  },
  feedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: { width: 38, height: 38, borderRadius: 19 },
  feedAvatarPlaceholder: { backgroundColor: colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  feedUserInfo: { flex: 1 },
  feedNickname: { ...typography.labelLarge, color: colors.textPrimary },
  feedPetInfo: { ...typography.caption, color: colors.textSecondary },
  feedRight: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '45%' },
  feedProductImage: { width: 34, height: 34, borderRadius: radius.small, resizeMode: 'contain', backgroundColor: colors.lightGray },
  feedProductPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  feedProductName: { ...typography.bodySmall, color: colors.textPrimary, flexShrink: 1 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: { ...typography.labelLarge, color: colors.primary },
});
