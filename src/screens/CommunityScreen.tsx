import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
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
import * as communityService from '../services/communityService';
import type { TrendingProduct, FeedCard } from '../services/communityService';
import type { CommunityStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80 ? colors.safe : score >= 60 ? colors.caution : colors.danger;
  return (
    <View style={[s.scoreBadge, { borderColor: color }]}>
      <Text style={[s.scoreText, { color }]}>{score}</Text>
    </View>
  );
}

function TrendingCard({ item, onPress }: { item: TrendingProduct; onPress: () => void }) {
  return (
    <Pressable style={[s.trendCard, shadows.card]} onPress={onPress}>
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
  );
}

function FeedCardItem({ item, onPress }: { item: FeedCard; onPress: () => void }) {
  return (
    <Pressable style={[s.feedCard, shadows.card]} onPress={onPress}>
      <View style={s.feedLeft}>
        {item.pet_photo ? (
          <Image source={{ uri: item.pet_photo }} style={s.feedAvatar} />
        ) : (
          <View style={[s.feedAvatar, s.feedAvatarPlaceholder]}>
            <Ionicons
              name={item.pet_type === 'cat' ? 'logo-octocat' : 'paw'}
              size={18}
              color={colors.textSecondary}
            />
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
  );
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { selectedPet } = useApp();

  const [trendType, setTrendType] = useState<'food' | 'treats'>('food');
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [feed, setFeed] = useState<FeedCard[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const petType = (selectedPet?.pet_type as 'dog' | 'cat') ?? undefined;

  const loadTrending = useCallback(async (type: 'food' | 'treats') => {
    setTrendLoading(true);
    try {
      const data = await communityService.getTrending(type, petType);
      setTrending(data);
    } catch {
      setTrending([]);
    } finally {
      setTrendLoading(false);
    }
  }, [petType]);

  const loadFeed = useCallback(async (reset = false) => {
    const off = reset ? 0 : feedOffset;
    if (!reset && !hasMore) return;
    setFeedLoading(true);
    try {
      const data = await communityService.getFeed(off, 20);
      if (reset) {
        setFeed(data.feed);
      } else {
        setFeed(prev => [...prev, ...data.feed]);
      }
      setHasMore(data.hasMore);
      setFeedOffset(off + data.feed.length);
    } catch {
      if (reset) setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  }, [feedOffset, hasMore]);

  useFocusEffect(
    useCallback(() => {
      loadTrending(trendType);
      loadFeed(true);
    }, [trendType, petType])
  );

  const onTrendTypeChange = (type: 'food' | 'treats') => {
    setTrendType(type);
    loadTrending(type);
  };

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
      >
        {/* Trending section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="flame" size={18} color={colors.accent} />
            <Text style={s.sectionTitle}>Trending This Week</Text>
            <View style={s.segmentRow}>
              <Pressable
                style={[s.segment, trendType === 'food' && s.segmentActive]}
                onPress={() => onTrendTypeChange('food')}
              >
                <Text style={[s.segmentText, trendType === 'food' && s.segmentTextActive]}>
                  Top Foods
                </Text>
              </Pressable>
              <Pressable
                style={[s.segment, trendType === 'treats' && s.segmentActive]}
                onPress={() => onTrendTypeChange('treats')}
              >
                <Text style={[s.segmentText, trendType === 'treats' && s.segmentTextActive]}>
                  Top Treats
                </Text>
              </Pressable>
            </View>
          </View>

          {trendLoading ? (
            <ActivityIndicator style={{ paddingVertical: 30 }} color={colors.primary} />
          ) : trending.length === 0 ? (
            <View style={s.emptyTrend}>
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
                <TrendingCard
                  item={item}
                  onPress={() => navigateToProduct(item.id, item.name, item.brand, item.score, item.image_url)}
                />
              )}
            />
          )}
        </View>

        {/* Feed section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="heart" size={18} color={colors.danger} />
            <Text style={s.sectionTitle}>Saved by Pet Parents</Text>
          </View>

          {feed.length === 0 && !feedLoading ? (
            <View style={s.emptyFeed}>
              <Ionicons name="bookmark-outline" size={40} color={colors.divider} />
              <Text style={s.emptyText}>No saved products yet</Text>
              <Text style={s.emptySubtext}>
                Save products from your scan results to share with the community
              </Text>
            </View>
          ) : (
            <>
              {feed.map((item) => (
                <FeedCardItem
                  key={item.save_id}
                  item={item}
                  onPress={() => navigateToProduct(item.product_id, item.product_name, item.product_brand, item.score, item.product_image)}
                />
              ))}
              {hasMore && (
                <Pressable
                  style={s.loadMoreBtn}
                  onPress={() => loadFeed(false)}
                  disabled={feedLoading}
                >
                  {feedLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={s.loadMoreText}>Load more</Text>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  segmentTextActive: {
    color: colors.white,
  },
  trendList: {
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  trendCard: {
    width: 130,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: 8,
  },
  trendImage: {
    width: '100%',
    height: 70,
    borderRadius: radius.small,
    resizeMode: 'contain',
    backgroundColor: colors.lightGray,
    marginBottom: 6,
  },
  trendImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendName: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  trendBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  trendFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendScans: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyTrend: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.xl,
  },
  emptyFeed: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: 12,
    marginHorizontal: spacing.lg,
    marginBottom: 8,
  },
  feedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  feedAvatarPlaceholder: {
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedUserInfo: {
    flex: 1,
  },
  feedNickname: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  feedPetInfo: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '45%',
  },
  feedProductImage: {
    width: 34,
    height: 34,
    borderRadius: radius.small,
    resizeMode: 'contain',
    backgroundColor: colors.lightGray,
  },
  feedProductPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedProductName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  scoreBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    ...typography.labelLarge,
    color: colors.primary,
  },
});
