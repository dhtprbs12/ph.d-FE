import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import checkinService from '../services/checkinService';
import petFoodService from '../services/petFoodService';
import FoodSearchInput, { FoodSelection } from '../components/FoodSearchInput';
import { toTitleCase } from '../utils/helpers';

const STOOL_OPTIONS = [
  { score: 1, emoji: '😫', label: 'Very Bad' },
  { score: 2, emoji: '😕', label: 'Bad' },
  { score: 3, emoji: '😐', label: 'Normal' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😊', label: 'Great' },
];

const APPETITE_OPTIONS: Array<{ value: 'low' | 'normal' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { petId, petName, foodName: initialFoodName, foodImage, daysOnFood } = route.params || {};

  const [currentFoodName, setCurrentFoodName] = useState<string | undefined>(initialFoodName);
  const [currentFoodImage, setCurrentFoodImage] = useState<string | undefined>(foodImage);
  const [showFoodChange, setShowFoodChange] = useState(false);
  const [stoolScore, setStoolScore] = useState<number>(3);
  const [appetite, setAppetite] = useState<'low' | 'normal' | 'high'>('normal');
  const [vomiting, setVomiting] = useState(false);
  const [itching, setItching] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  useFocusEffect(useCallback(() => {
    if (petId) {
      petFoodService.getCurrentFood(petId).then(food => {
        if (food) {
          setCurrentFoodName(food.productName);
          setCurrentFoodImage(food.imageUrl || undefined);
        }
      }).catch(console.warn);

      const todayStr = new Date().toISOString().split('T')[0];
      checkinService.getCheckins(petId, todayStr, todayStr).then(result => {
        if (result.checkins && result.checkins.length > 0) {
          setAlreadyCheckedIn(true);
        }
      }).catch(console.warn);
    }
  }, [petId]));

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const localDate = today.toISOString().split('T')[0];

  const handleFoodChange = useCallback(async (food: FoodSelection) => {
    try {
      await petFoodService.changeFood(petId, {
        productId: food.productId,
        productName: food.productName,
        brand: food.brand,
      });
      setCurrentFoodName(food.productName);
      setCurrentFoodImage(food.imageUrl || undefined);
      setShowFoodChange(false);
      Alert.alert('✅ Food Changed!', `Switched to ${toTitleCase(food.productName)}`);
    } catch (e) {
      console.warn('Failed to change food:', e);
      Alert.alert('Error', 'Failed to change food');
    }
  }, [petId]);

  const handleSave = async () => {
    if (!petId) {
      Alert.alert('Error', 'No pet selected');
      return;
    }

    setIsLoading(true);
    try {
      const result = await checkinService.saveCheckin(petId, {
        stoolScore,
        appetite,
        vomiting,
        itching,
        notes: notes.trim() || undefined,
        localDate,
      });

      let message = `Check-in saved for ${petName || 'your pet'}!`;
      if (result.tokensAwarded > 0) {
        message += `\n🦴 +${result.tokensAwarded} tokens earned!`;
      }
      if (result.streakInfo.streakBonus > 0) {
        message += `\n🔥 Streak bonus: +${result.streakInfo.streakBonus} tokens!`;
      }
      if (result.streakInfo.currentStreak > 1) {
        message += `\n🔥 ${result.streakInfo.currentStreak}-day streak!`;
      }

      Alert.alert('✅ Check-in Complete!', message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      if (e.response?.status === 409 || e.status === 409) {
        Alert.alert('Already Done', 'You already checked in today! Come back tomorrow 🐾');
      } else {
        Alert.alert('Error', e.message || 'Failed to save check-in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Daily Check-in</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Date + Food info */}
        <View style={styles.card}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
            📝 {dateStr}{daysOnFood != null ? `  ·  Day ${daysOnFood}` : ''}
          </Text>
          {currentFoodName ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {currentFoodImage ? (
                  <Image source={{ uri: currentFoodImage }} style={{ width: 44, height: 44, borderRadius: 8 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.lightGray, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="nutrition" size={22} color={colors.textSecondary} />
                  </View>
                )}
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]}>
                  {toTitleCase(currentFoodName)}
                </Text>
                <Pressable onPress={() => setShowFoodChange(!showFoodChange)}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                    {showFoodChange ? 'Cancel' : 'Switch Food'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowFoodChange(true)}>
              <Text style={[typography.bodyMedium, { color: colors.primary, fontWeight: '600' }]}>+ Set current food</Text>
            </Pressable>
          )}
          {showFoodChange && (
            <View style={{ marginTop: spacing.sm }}>
              <FoodSearchInput
                petType="dog"
                onSelect={handleFoodChange}
                onScanBarcode={() => {
                  setShowFoodChange(false);
                  (navigation as any).navigate('QuickScan', { mode: 'selectFood', petId });
                }}
                placeholder="Search new food..."
              />
            </View>
          )}
        </View>

        {/* Stool Score */}
        <View style={styles.card}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>💩 Stool Quality</Text>
          <View style={styles.stoolRow}>
            {STOOL_OPTIONS.map(opt => {
              const isSelected = stoolScore === opt.score;
              return (
                <Pressable
                  key={opt.score}
                  onPress={() => setStoolScore(opt.score)}
                  style={[
                    styles.stoolBtn,
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                  <Text style={[
                    typography.labelSmall,
                    { color: isSelected ? colors.white : colors.textSecondary, fontSize: 10 },
                  ]}>{opt.score}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Appetite */}
        <View style={styles.card}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>🍽 Appetite</Text>
          <View style={styles.segmentedControl}>
            {APPETITE_OPTIONS.map(opt => {
              const isActive = appetite === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setAppetite(opt.value)}
                  style={[styles.segment, isActive && styles.segmentActive]}
                >
                  <Text style={[typography.labelMedium, { color: isActive ? colors.white : colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Vomiting */}
        <View style={styles.card}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>🤮 Vomiting today?</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {[false, true].map(val => {
              const isSelected = vomiting === val;
              return (
                <Pressable
                  key={String(val)}
                  onPress={() => setVomiting(val)}
                  style={[styles.toggleBtn, isSelected && (val ? styles.toggleYes : styles.toggleNo)]}
                >
                  <Text style={[typography.labelMedium, { color: isSelected ? colors.white : colors.textPrimary }]}>
                    {val ? 'Yes' : 'No'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Itching */}
        <View style={styles.card}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>🐾 Itching / Scratching?</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {[false, true].map(val => {
              const isSelected = itching === val;
              return (
                <Pressable
                  key={String(val)}
                  onPress={() => setItching(val)}
                  style={[styles.toggleBtn, isSelected && (val ? styles.toggleYes : styles.toggleNo)]}
                >
                  <Text style={[typography.labelMedium, { color: isSelected ? colors.white : colors.textPrimary }]}>
                    {val ? 'Yes' : 'No'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>💬 Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any observations today?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {alreadyCheckedIn ? (
          <View style={[styles.saveBtn, { opacity: 0.6 }]}>
            <Text style={[typography.labelLarge, { color: colors.white }]}>Already Checked In ✅</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Come back tomorrow!</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveBtn, isLoading && { opacity: 0.6 }]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={[typography.labelLarge, { color: colors.white }]}>Save Check-in</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>+🦴5</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.large,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stoolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  stoolBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
    borderWidth: 2,
    borderColor: colors.lightGray,
    backgroundColor: colors.lightGray,
    gap: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.medium,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
  },
  toggleNo: {
    backgroundColor: colors.primary,
  },
  toggleYes: {
    backgroundColor: '#E74C3C',
  },
  notesInput: {
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 80,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
});
