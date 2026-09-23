import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import shopService, { ShopItem, SlotName, CharacterState, EquippedItem } from '../services/shopService';
import gamificationService from '../services/gamificationService';
import { getBaseCharacter, getItemLayer, getItemThumb } from '../utils/characterAssets';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import TokenEarnSheet from '../components/TokenEarnSheet';

const CATEGORIES: { key: SlotName; label: string; emoji: string }[] = [
  { key: 'hat', label: 'Hats', emoji: '🎩' },
  { key: 'glasses', label: 'Glasses', emoji: '👓' },
  { key: 'accessory', label: 'Acc', emoji: '🎀' },
  { key: 'clothes', label: 'Clothes', emoji: '👔' },
  { key: 'background', label: 'BG', emoji: '🖼' },
  { key: 'effect', label: 'Effects', emoji: '✨' },
];

export default function CharacterScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation();
  const { selectedPet } = useApp();
  const petName = selectedPet?.name;
  const toast = useToast();

  const petId = selectedPet?.id;

  const cachedChar = petId ? shopService.getCachedCharacter(petId) : null;
  const cachedItems = shopService.getCachedItems('hat');

  const [isLoading, setIsLoading] = useState(!cachedChar);
  const [character, setCharacter] = useState<CharacterState | null>(cachedChar);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [earnSheet, setEarnSheet] = useState<'how' | 'short' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SlotName>('hat');
  const [items, setItems] = useState<ShopItem[]>(shopService.getCachedItems('hat') || []);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [localEquipped, setLocalEquipped] = useState<Record<SlotName, EquippedItem | null>>(
    cachedChar?.equipped ?? { hat: null, glasses: null, accessory: null, clothes: null, background: null, effect: null },
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!petId) return;
    try {
      if (!cachedChar) setIsLoading(true);
      const charData = await shopService.getCharacter(petId);
      setCharacter(charData);
      setLocalEquipped(charData.equipped);
    } catch (e) {
      console.warn('Failed to load character data:', e);
    } finally {
      setIsLoading(false);
    }
    gamificationService.getTokens()
      .then(t => setTokenBalance(t.balance))
      .catch(console.warn);
  }, [petId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    shopService.getItems(selectedCategory).then(setItems).catch(console.warn);
  }, [selectedCategory]);

  const handleItemPress = (item: ShopItem) => {
    const isCurrentlyEquipped = localEquipped[item.category]?.id === item.id;

    if (isCurrentlyEquipped) {
      setLocalEquipped(prev => ({ ...prev, [item.category]: null }));
      setSelectedItem(null);
      return;
    }

    setSelectedItem(item);
    setLocalEquipped(prev => ({
      ...prev,
      [item.category]: {
        id: item.id,
        assetKey: item.assetKey,
        layerType: item.layerType,
        positionX: item.positionX,
        positionY: item.positionY,
        name: item.name,
        nameKo: item.nameKo,
      },
    }));
  };

  const handlePurchase = async () => {
    if (!selectedItem) return;
    setIsPurchasing(true);
    try {
      const result = await shopService.purchaseItem(selectedItem.id);
      setTokenBalance(result.newBalance);
      setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, isOwned: true } : i));
      setCharacter(prev => prev ? { ...prev, ownedItems: [...prev.ownedItems, selectedItem.id] } : prev);
      setLocalEquipped(prev => ({
        ...prev,
        [selectedItem.category]: {
          id: selectedItem.id,
          assetKey: selectedItem.assetKey,
          layerType: selectedItem.layerType,
          positionX: selectedItem.positionX,
          positionY: selectedItem.positionY,
          name: selectedItem.name,
          nameKo: selectedItem.nameKo,
        },
      }));
      toast.show({ message: selectedItem.name + ' is now yours!', type: 'reward' });
    } catch (e: any) {
      if (e.response?.data?.error === 'insufficient_tokens') {
        setEarnSheet('short');
      } else {
        toast.show({ message: e.message || 'Purchase failed', type: 'error' });
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleSave = async () => {
    if (!petId || !character) return;
    setIsSaving(true);
    try {
      const slots: SlotName[] = ['hat', 'glasses', 'accessory', 'clothes', 'background', 'effect'];
      const ownedIds = new Set(character.ownedItems);
      const nextEquipped = { ...character.equipped };
      for (const slot of slots) {
        const localItem = localEquipped[slot];
        const persistable = !localItem || ownedIds.has(localItem.id) ? localItem : character.equipped[slot];
        if (persistable?.id !== character.equipped[slot]?.id) {
          await shopService.equipItem(petId, slot, persistable?.id || null);
        }
        nextEquipped[slot] = persistable;
      }
      setCharacter(prev => prev ? { ...prev, equipped: nextEquipped } : prev);
      shopService.invalidateCharacterCache();
      navigation.goBack();
    } catch (e: any) {
      toast.show({ message: e.message || 'Failed to save', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnequip = () => {
    setLocalEquipped(prev => ({ ...prev, [selectedCategory]: null }));
    setSelectedItem(null);
  };

  const isItemOwned = (item: ShopItem) => item.isOwned || character?.ownedItems.includes(item.id);
  const ownedIdSet = new Set(character?.ownedItems ?? []);
  const persistableEquipped = character
    ? (['hat', 'glasses', 'accessory', 'clothes', 'background', 'effect'] as SlotName[]).reduce((acc, slot) => {
        const local = localEquipped[slot];
        acc[slot] = local && !ownedIdSet.has(local.id) ? character.equipped[slot] : local;
        return acc;
      }, { ...character.equipped })
    : localEquipped;
  const hasUnsavedChanges = character && JSON.stringify(persistableEquipped) !== JSON.stringify(character.equipped);

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const characterEmoji = character?.characterType === 'cat' ? '🐱' : '🐕';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Character</Text>
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
          <Pressable
            onPress={() => setEarnSheet('how')}
            style={styles.tokenDisplay}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How to earn tokens"
          >
            <Text style={{ fontSize: 14 }}>🦴</Text>
            <Text style={[typography.labelLarge, { color: colors.accent }]}>{tokenBalance}</Text>
          </Pressable>
        </View>
      </View>

      {/* Character Preview */}
      <View style={styles.previewArea}>
        {(() => {
          const bgLayer = localEquipped.background ? getItemLayer(localEquipped.background.assetKey) : null;
          const hasBg = !!bgLayer;
          const sceneW = hasBg ? windowWidth - spacing.md * 4 : 220;
          const sceneH = hasBg ? 240 : 220;
          const charSize = hasBg ? Math.round(sceneH * 0.58) : 220;
          return (
            <View style={[styles.characterContainer, { width: sceneW, height: sceneH, borderRadius: hasBg ? radius.large : 0 }]}>
              {bgLayer && (
                <Image
                  source={bgLayer}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: sceneW, height: sceneW }}
                  resizeMode="cover"
                />
              )}
              <View style={{
                position: 'absolute',
                left: (sceneW - charSize) / 2,
                bottom: hasBg ? 2 : 0,
                width: charSize,
                height: charSize,
              }}>
                <Image
                  source={getBaseCharacter(character?.characterType || 'dog')}
                  style={{ width: charSize, height: charSize }}
                  resizeMode="contain"
                />
                {(['clothes', 'accessory', 'hat', 'glasses', 'effect'] as SlotName[]).map(slot => {
                  const equipped = localEquipped[slot];
                  if (!equipped) return null;
                  const layer = getItemLayer(equipped.assetKey);
                  if (!layer) return null;
                  return (
                    <Image
                      key={slot}
                      source={layer}
                      style={{ position: 'absolute', top: 0, left: 0, width: charSize, height: charSize }}
                      resizeMode="contain"
                    />
                  );
                })}
              </View>
            </View>
          );
        })()}
        <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: spacing.sm }]}>
          Lil {petName || 'Buddy'}
        </Text>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}>
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => { setSelectedCategory(cat.key); setSelectedItem(null); }}
              style={[styles.categoryTab, isActive && styles.categoryTabActive]}
            >
              <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Selected Category Label */}
      <Text style={styles.categoryLabel}>
        {CATEGORIES.find(c => c.key === selectedCategory)?.label || ''}
      </Text>

      {/* Item Grid */}
      <FlatList
        style={{ flex: 1 }}
        data={[{ id: '__none__', category: selectedCategory, name: 'None', nameKo: '', price: 0, assetKey: '', asset_key: '', isOwned: true, layerType: '', positionX: 0, positionY: 0 } as ShopItem, ...items]}
        numColumns={4}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 100 }}
        columnWrapperStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          if (item.id === '__none__') {
            const isNoneActive = !localEquipped[selectedCategory];
            return (
              <Pressable
                onPress={handleUnequip}
                style={[
                  styles.itemCard,
                  isNoneActive && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Ionicons name="close-circle-outline" size={28} color={isNoneActive ? colors.primary : colors.textSecondary} />
                <Text style={[typography.labelSmall, { color: isNoneActive ? colors.primary : colors.textSecondary, textAlign: 'center' }]}>
                  None
                </Text>
              </Pressable>
            );
          }

          const owned = isItemOwned(item);
          const isSelected = selectedItem?.id === item.id;
          const isEquipped = localEquipped[item.category]?.id === item.id;

          return (
            <Pressable
              onPress={() => handleItemPress(item)}
              style={[
                styles.itemCard,
                isSelected && { borderColor: colors.primary, borderWidth: 2 },
                isEquipped && { borderColor: colors.accent, borderWidth: 2 },
              ]}
            >
              {(() => {
                const thumb = getItemThumb(item.assetKey || item.asset_key);
                if (thumb) {
                  return <Image source={thumb} style={{ width: 40, height: 40 }} resizeMode="contain" />;
                }
                const emoji = item.category === 'hat' ? '🎩' :
                  item.category === 'glasses' ? '👓' :
                  item.category === 'accessory' ? '🎀' :
                  item.category === 'clothes' ? '👔' :
                  item.category === 'background' ? '🖼' : '✨';
                return <Text style={{ fontSize: 28 }}>{emoji}</Text>;
              })()}
              <Text style={[typography.labelSmall, { color: colors.textPrimary, textAlign: 'center' }]} numberOfLines={1}>
                {item.name || item.nameKo}
              </Text>
              {owned ? (
                <Text style={[typography.labelSmall, { color: colors.primary, fontSize: 9 }]}>
                  {isEquipped ? '✓ ON' : 'Owned'}
                </Text>
              ) : (
                <Text style={[typography.labelSmall, { color: colors.accent, fontSize: 10 }]}>🦴{item.price}</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              No items in this category yet
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              Items coming soon! 🎉
            </Text>
          </View>
        }
      />

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {selectedItem && !isItemOwned(selectedItem) && (
          <Pressable
            onPress={handlePurchase}
            disabled={isPurchasing}
            style={[styles.purchaseBtn, isPurchasing && { opacity: 0.6 }]}
          >
            {isPurchasing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.labelLarge, { color: colors.white }]}>
                Purchase for 🦴{selectedItem.price}
              </Text>
            )}
          </Pressable>
        )}
        {hasUnsavedChanges && (
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.labelLarge, { color: colors.white }]}>Save Changes</Text>
            )}
          </Pressable>
        )}
      </View>
      <TokenEarnSheet
        visible={earnSheet != null}
        onClose={() => setEarnSheet(null)}
        title={earnSheet === 'short' ? 'Not enough tokens' : 'How to earn tokens'}
        subtitle={earnSheet === 'short' ? "You don't have enough for this item." : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tokenDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  previewArea: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    borderRadius: radius.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  characterContainer: {
    width: 220,
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundLayerImg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.large,
  },
  equippedBadges: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 2,
  },
  equippedEmoji: { fontSize: 20 },
  categoryLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  baseCharacterImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 220,
    height: 220,
  },
  itemLayerImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 220,
    height: 220,
  },
  categoryBar: {
    flexGrow: 0,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  categoryTab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.lightGray,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  itemCard: {
    flex: 1,
    maxWidth: '23%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 2,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  purchaseBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
});
