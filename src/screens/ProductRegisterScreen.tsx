import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { registerProduct } from '../services/productRegisterService';

type Step = 'front' | 'ingredients' | 'barcode' | 'review';

const STEPS: { key: Step; label: string; instruction: string; icon: string }[] = [
  { key: 'front', label: 'Front Label', instruction: 'Take a clear photo of the front of the package', icon: 'image-outline' },
  { key: 'ingredients', label: 'Ingredients', instruction: 'Take a clear photo of the ingredients list', icon: 'list-outline' },
  { key: 'barcode', label: 'Barcode', instruction: 'Take a photo of the barcode', icon: 'barcode-outline' },
];

const NEXT_STEP: Record<string, Step> = { front: 'ingredients', ingredients: 'barcode', barcode: 'review' };
const PREV_STEP: Record<string, Step | null> = { front: null, ingredients: 'front', barcode: 'ingredients' };

export default function ProductRegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const barcode = route.params?.barcode;

  const [currentStep, setCurrentStep] = useState<Step>('front');
  const [photos, setPhotos] = useState<{ front?: string; ingredients?: string; barcode?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepIndex = currentStep === 'review' ? 3 : STEPS.findIndex(s => s.key === currentStep);

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Access Needed', 'Please allow camera access in Settings to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => ({ ...prev, [currentStep]: result.assets[0].uri }));
    }
  };

  const goNext = () => {
    const next = NEXT_STEP[currentStep];
    if (next) setCurrentStep(next);
  };

  const goBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('barcode');
    } else {
      const prev = PREV_STEP[currentStep];
      if (prev) setCurrentStep(prev);
      else navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!photos.front || !photos.ingredients) {
      Alert.alert('Missing Photos', 'Please take photos of the front label and ingredients list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerProduct({
        frontImageUri: photos.front,
        ingredientImageUri: photos.ingredients,
        barcodeImageUri: photos.barcode,
        barcode: barcode || undefined,
        petType: 'dog',
      });

      Alert.alert(
        '🎉 Product Registered!',
        `Thank you for contributing! You earned 🦴×${result.tokensAwarded} tokens!\n\nNew balance: 🦴 ${result.tokenBalance}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to register product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Review Step ── */
  if (currentStep === 'review') {
    const reviewItems = [
      { key: 'front', label: 'Front Label' },
      { key: 'ingredients', label: 'Ingredients' },
      { key: 'barcode', label: `Barcode${barcode ? ` (${barcode})` : ''}` },
    ];

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Review Photos</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.reviewScroll}>
          {reviewItems.map(item => {
            const photoUri = photos[item.key as keyof typeof photos];
            return (
              <View key={item.key} style={styles.reviewCard}>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {item.label}
                </Text>
                {photoUri ? (
                  <>
                    <Image source={{ uri: photoUri }} style={styles.reviewImage} resizeMode="cover" />
                    <Pressable
                      onPress={() => {
                        setPhotos(prev => ({ ...prev, [item.key]: undefined }));
                        setCurrentStep(item.key as Step);
                      }}
                      style={styles.retakeSmallBtn}
                    >
                      <Ionicons name="camera-reverse-outline" size={16} color={colors.primary} />
                      <Text style={[typography.labelSmall, { color: colors.primary }]}>Retake</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.skippedBox}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.textSecondary} />
                    <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>Skipped</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Submit Product</Text>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenBadgeText}>+🦴20</Text>
                </View>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Camera Steps (front / ingredients / barcode) ── */
  const stepInfo = STEPS.find(s => s.key === currentStep)!;
  const existingPhoto = photos[currentStep];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{stepInfo.label}</Text>
        <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
          {stepIndex + 1}/4
        </Text>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressCapsule, { backgroundColor: i <= stepIndex ? colors.primary : colors.lightGray }]}
          />
        ))}
      </View>

      {existingPhoto ? (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: existingPhoto }} style={styles.previewImage} resizeMode="contain" />
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable onPress={openCamera} style={styles.retakeBtn}>
              <Ionicons name="camera-reverse-outline" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary }]}>Retake</Text>
            </Pressable>
            <Pressable onPress={goNext} style={styles.nextBtn}>
              <Text style={[typography.labelLarge, { color: colors.white }]}>
                {currentStep === 'barcode' ? 'Review' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name={stepInfo.icon as any} size={48} color={colors.primary} />
          </View>
          <Text style={[typography.titleMedium, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
            {stepInfo.instruction}
          </Text>
          {currentStep === 'barcode' && barcode && (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              Barcode number: {barcode}
            </Text>
          )}

          <Pressable onPress={openCamera} style={styles.takePhotoBtn}>
            <Ionicons name="camera-outline" size={24} color={colors.white} />
            <Text style={[typography.labelLarge, { color: colors.white }]}>Take Photo</Text>
          </Pressable>

          {currentStep === 'barcode' && (
            <Pressable onPress={() => setCurrentStep('review')} style={styles.skipTextBtn}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Skip this step</Text>
            </Pressable>
          )}
        </View>
      )}
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
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressCapsule: { flex: 1, height: 4, borderRadius: 2 },

  /* Empty / instruction state */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
  skipTextBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },

  /* Photo preview */
  photoPreviewContainer: { flex: 1 },
  previewImage: { flex: 1, backgroundColor: '#f5f5f5' },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '4D',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },

  /* Review */
  reviewScroll: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: 120,
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.large,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.medium,
  },
  retakeSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skippedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
  },

  /* Bottom bar + submit */
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
  submitBtnText: {
    ...typography.labelLarge,
    color: colors.white,
  },
  tokenBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tokenBadgeText: {
    ...typography.labelSmall,
    color: colors.white,
    fontWeight: '700',
  },
});
