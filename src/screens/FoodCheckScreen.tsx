import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import * as scanService from '../services/scanService';
import { useApp } from '../context/AppContext';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { FoodCheckResult } from '../types';

type Phase = 'initial' | 'analyzing' | 'result' | 'error';

const EXAMPLES: { emoji: string; name: string }[] = [
  { emoji: '🍎', name: 'Apple' },
  { emoji: '🥚', name: 'Egg' },
  { emoji: '🍫', name: 'Chocolate' },
  { emoji: '🧀', name: 'Cheese' },
];

function safetyTheme(level: string) {
  const l = level?.toLowerCase() ?? '';
  if (l === 'safe')
    return { color: colors.safe, label: 'SAFE', emoji: '✅', icon: 'checkmark-circle' as const };
  if (l === 'caution' || l === 'moderate')
    return { color: colors.caution, label: 'CAUTION', emoji: '⚠️', icon: 'warning' as const };
  if (l === 'danger' || l === 'toxic')
    return { color: colors.danger, label: 'DANGER', emoji: '🚫', icon: 'close-circle' as const };
  return { color: colors.textSecondary, label: 'UNKNOWN', emoji: '❓', icon: 'help-circle' as const };
}

export function FoodCheckScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'FoodCheck'>>();
  const { selectedPet } = useApp();
  const petType = selectedPet?.pet_type ?? 'dog';
  const petName = selectedPet?.name ?? 'your pet';

  const [phase, setPhase] = useState<Phase>('initial');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<FoodCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== 'analyzing') return;
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.02,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    p.start();
    const s = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true }
    );
    s.start();
    return () => { p.stop(); s.stop(); };
  }, [phase, pulse, spin]);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const res = fromCamera
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

    if (res.canceled || !res.assets?.[0]?.uri) return null;
    return res.assets[0].uri;
  }, []);

  const runCheck = useCallback(
    async (uri: string) => {
      setImageUri(uri);
      setPhase('analyzing');
      setErrorMessage(null);
      try {
        const healthJson =
          selectedPet?.healthConditions?.length
            ? JSON.stringify(
                selectedPet.healthConditions.map(c => ({
                  conditionType: c.condition_type,
                  severity: c.severity,
                  notes: c.notes,
                }))
              )
            : undefined;
        const data = await scanService.foodCheck(uri, petType, {
          petName: selectedPet?.name,
          petHealthConditions: healthJson,
        });
        setResult(data);
        setPhase('result');
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Something went wrong.');
        setPhase('error');
      }
    },
    [petType, selectedPet]
  );

  const onCamera = useCallback(async () => {
    const uri = await pickImage(true);
    if (uri) await runCheck(uri);
  }, [pickImage, runCheck]);

  const onLibrary = useCallback(async () => {
    const uri = await pickImage(false);
    if (uri) await runCheck(uri);
  }, [pickImage, runCheck]);

  const reset = useCallback(() => {
    setPhase('initial');
    setImageUri(null);
    setResult(null);
    setErrorMessage(null);
  }, []);

  const theme = result ? safetyTheme(result.safetyLevel) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Nav bar */}
      <View style={s.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={s.navTitle}>Food Check</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* Initial state */}
      {phase === 'initial' && (
        <View style={s.centerBlock}>
          <View style={s.spacer} />

          {/* Hero icon */}
          <View style={s.heroCircle}>
            <Ionicons name="help-circle-outline" size={60} color={colors.accent} />
          </View>

          {/* Instructions */}
          <Text style={s.title}>Check Any Food</Text>
          <Text style={s.subtitle}>
            Take a photo of any food to see if it's safe for your pet
          </Text>

          {/* Example badges */}
          <View style={s.exampleRow}>
            {EXAMPLES.map(ex => (
              <View key={ex.name} style={s.exampleBadge}>
                <Text style={{ fontSize: 28 }}>{ex.emoji}</Text>
                <Text style={s.exampleLabel}>{ex.name}</Text>
              </View>
            ))}
          </View>

          <View style={s.spacer} />

          {/* Action buttons */}
          <View style={s.buttonGroup}>
            <Pressable style={s.primaryBtn} onPress={onCamera}>
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={s.primaryBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={onLibrary}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={s.secondaryBtnText}>Choose from Library</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Analyzing state */}
      {phase === 'analyzing' && imageUri && (
        <View style={s.centerBlock}>
          <View style={s.spacer} />

          {/* Image preview */}
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Image source={{ uri: imageUri }} style={s.analyzeImg} />
          </Animated.View>

          {/* Spinning icon */}
          <Animated.View style={{ transform: [{ rotate: spinInterpolate }], marginTop: spacing.lg }}>
            <Ionicons name="search" size={44} color={colors.primary} />
          </Animated.View>

          <Text style={s.analyzeTitle}>Identifying food...</Text>
          <Text style={s.analyzeSub}>Checking if it's safe for your pet</Text>

          <View style={s.spacer} />
        </View>
      )}

      {/* Result state */}
      {phase === 'result' && result && theme && (
        <ScrollView contentContainerStyle={s.resultScroll}>
          {/* Image + name + category */}
          <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={[s.resultImg, { borderColor: theme.color + '80' }]} />
            )}
            <Text style={s.foodName}>{result.foodName}</Text>
            {result.category && (
              <View style={s.categoryPill}>
                <Text style={s.categoryText}>{result.category}</Text>
              </View>
            )}
          </View>

          {/* Safety badge (HStack with emoji + text + icon, tinted bg + border) */}
          <View style={[s.safetyBadge, { backgroundColor: theme.color + '1A', borderColor: theme.color + '4D' }]}>
            <Text style={{ fontSize: 40 }}>{theme.emoji}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.safetyLevel, { color: theme.color }]}>{theme.label}</Text>
              <Text style={s.safetyPet}>for {petName}</Text>
            </View>
            <Ionicons name={theme.icon} size={36} color={theme.color} />
          </View>

          {/* Details card */}
          <View style={s.detailsCard}>
            <Text style={s.detailsTitle}>Details</Text>
            <Text style={s.detailsBody}>{result.explanation}</Text>
            {result.tip && (
              <View style={s.tipBlock}>
                <Ionicons name="bulb" size={16} color={colors.primary} />
                <Text style={s.tipText}>{result.tip}</Text>
              </View>
            )}
          </View>

          {/* Action buttons: primary "Check Another Food" first, then "Done" text */}
          <View style={s.resultActions}>
            <Pressable style={s.primaryBtn} onPress={reset}>
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={s.primaryBtnText}>Check Another Food</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={{ ...typography.bodyMedium, color: colors.primary }}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <View style={s.centerBlock}>
          <View style={s.spacer} />

          <Ionicons name="warning" size={60} color={colors.caution} />
          <Text style={s.errorTitle}>Couldn't Identify Food</Text>
          <Text style={s.errorBody}>{errorMessage ?? 'Please try again.'}</Text>

          <View style={s.spacer} />

          <View style={s.buttonGroup}>
            <Pressable style={s.primaryBtn} onPress={reset}>
              <Text style={s.primaryBtnText}>Try Again</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ alignItems: 'center', paddingVertical: spacing.md }}
            >
              <Text style={{ ...typography.bodyMedium, color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
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
  cancelText: { fontSize: 16, color: colors.primary },
  navTitle: { ...typography.titleLarge, color: colors.textPrimary },
  centerBlock: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  spacer: { flex: 1 },
  heroCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(244,162,97,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  exampleBadge: {
    width: 70,
    height: 70,
    borderRadius: radius.medium,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.card,
  },
  exampleLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
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
  analyzeImg: {
    width: 160,
    height: 160,
    borderRadius: radius.large,
    borderWidth: 3,
    borderColor: 'rgba(45,106,79,0.3)',
  },
  analyzeTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  analyzeSub: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  resultScroll: {
    paddingBottom: spacing.xxl,
  },
  resultImg: {
    width: 120,
    height: 120,
    borderRadius: radius.large,
    borderWidth: 3,
    marginBottom: spacing.md,
  },
  foodName: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  categoryPill: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.small,
    marginTop: spacing.xs,
  },
  categoryText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.large,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  safetyLevel: {
    fontSize: 22,
    fontWeight: '700',
  },
  safetyPet: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  detailsTitle: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailsBody: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tipBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: radius.medium,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  resultActions: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  errorBody: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
