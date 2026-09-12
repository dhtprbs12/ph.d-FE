import React, { useState, useRef } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { registerProduct } from '../services/productRegisterService';

type Step = 'front' | 'ingredients' | 'barcode' | 'review';

const STEPS: { key: Step; label: string; instruction: string; icon: string }[] = [
  { key: 'front', label: 'Front Label', instruction: 'Take a clear photo of the front of the package', icon: 'image-outline' },
  { key: 'ingredients', label: 'Ingredients', instruction: 'Take a clear photo of the ingredients list', icon: 'list-outline' },
  { key: 'barcode', label: 'Barcode', instruction: 'Take a photo of the barcode (optional)', icon: 'barcode-outline' },
];

export default function ProductRegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const barcode = route.params?.barcode;

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [currentStep, setCurrentStep] = useState<Step>('front');
  const [photos, setPhotos] = useState<{ front?: string; ingredients?: string; barcode?: string }>({});
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepIndex = currentStep === 'review' ? 3 : STEPS.findIndex(s => s.key === currentStep);
  const totalSteps = barcode ? 3 : 4;

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const usePhoto = () => {
    if (!capturedPhoto) return;
    setPhotos(prev => ({ ...prev, [currentStep]: capturedPhoto }));
    setCapturedPhoto(null);

    if (currentStep === 'front') {
      setCurrentStep('ingredients');
    } else if (currentStep === 'ingredients') {
      if (barcode) {
        setCurrentStep('review');
      } else {
        setCurrentStep('barcode');
      }
    } else if (currentStep === 'barcode') {
      setCurrentStep('review');
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  const skipBarcodePhoto = () => {
    setCurrentStep('review');
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

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
            Camera Access Needed
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            We need camera access to photograph the product labels.
          </Text>
          <Pressable onPress={requestPermission} style={styles.permissionBtn}>
            <Text style={[typography.labelLarge, { color: colors.white }]}>Allow Camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (currentStep === 'review') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setCurrentStep(barcode ? 'ingredients' : 'barcode')}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Review Photos</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: insets.bottom + 100 }}>
          {[
            { key: 'front', label: '📸 Front Label' },
            { key: 'ingredients', label: '📋 Ingredients' },
            ...(photos.barcode ? [{ key: 'barcode', label: '📱 Barcode' }] : []),
          ].map(item => (
            <View key={item.key} style={styles.reviewCard}>
              <Text style={[typography.labelLarge, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {item.label}
              </Text>
              <Image
                source={{ uri: photos[item.key as keyof typeof photos] }}
                style={styles.reviewImage}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => {
                  setPhotos(prev => ({ ...prev, [item.key]: undefined }));
                  setCapturedPhoto(null);
                  setCurrentStep(item.key as Step);
                }}
                style={styles.retakeSmallBtn}
              >
                <Ionicons name="camera-reverse-outline" size={16} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary }]}>Retake</Text>
              </Pressable>
            </View>
          ))}
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
                <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
                <Text style={[typography.labelLarge, { color: colors.white }]}>Submit Product</Text>
                <View style={styles.tokenBadge}>
                  <Text style={[typography.labelSmall, { color: colors.accent }]}>+🦴20</Text>
                </View>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  const stepInfo = STEPS.find(s => s.key === currentStep)!;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => {
          if (currentStep === 'front') navigation.goBack();
          else if (currentStep === 'ingredients') setCurrentStep('front');
          else if (currentStep === 'barcode') setCurrentStep('ingredients');
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{stepInfo.label}</Text>
        <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
          {stepIndex + 1}/{totalSteps}
        </Text>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressCapsule, { backgroundColor: i <= stepIndex ? colors.primary : colors.lightGray }]}
          />
        ))}
      </View>

      {capturedPhoto ? (
        <View style={{ flex: 1 }}>
          <Image source={{ uri: capturedPhoto }} style={styles.preview} resizeMode="contain" />
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable onPress={retakePhoto} style={styles.retakeBtn}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary }]}>Retake</Text>
            </Pressable>
            <Pressable onPress={usePhoto} style={styles.useBtn}>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={[typography.labelLarge, { color: colors.white }]}>Use This</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.cameraOverlay}>
              <View style={styles.guideBox}>
                <Ionicons name={stepInfo.icon as any} size={32} color="rgba(255,255,255,0.8)" />
                <Text style={styles.guideText}>{stepInfo.instruction}</Text>
              </View>
            </View>
          </CameraView>

          <View style={[styles.cameraControls, { paddingBottom: insets.bottom + spacing.md }]}>
            {currentStep === 'barcode' && (
              <Pressable onPress={skipBarcodePhoto} style={styles.skipBtn}>
                <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Skip</Text>
              </Pressable>
            )}
            <Pressable onPress={takePhoto} style={styles.shutterBtn}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={{ width: 60 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
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
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBox: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.large,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  guideText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: 'black',
    gap: spacing.xl,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },
  skipBtn: {
    width: 60,
    alignItems: 'center',
  },
  preview: { flex: 1, backgroundColor: 'black' },
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
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
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
  tokenBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  permissionBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
  },
});
