import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageLoadEventData,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, radius, spacing, typography } from '../theme';

const CROP_SIZE = Math.min(Dimensions.get('window').width - 48, 320);

type Props = {
  active: boolean;
  imageUri: string;
  imageWidth?: number;
  imageHeight?: number;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

function initTransform(w: number, h: number) {
  const bs = Math.max(CROP_SIZE / w, CROP_SIZE / h);
  const dw = w * bs;
  const dh = h * bs;
  const tx = (CROP_SIZE - dw) / 2;
  const ty = (CROP_SIZE - dh) / 2;
  return { w, h, baseScale: bs, tx, ty };
}

export function PetPhotoCropEditor({
  active,
  imageUri,
  imageWidth,
  imageHeight,
  onCancel,
  onDone,
}: Props) {
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const imgW = useSharedValue(0);
  const imgH = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const userScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedUserScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const transformRef = useRef({
    userScale: 1,
    translateX: 0,
    translateY: 0,
    imgW: 0,
    imgH: 0,
    baseScale: 1,
  });

  const applyTransform = useCallback((w: number, h: number) => {
    const t = initTransform(w, h);
    imgW.value = t.w;
    imgH.value = t.h;
    baseScale.value = t.baseScale;
    userScale.value = 1;
    savedUserScale.value = 1;
    translateX.value = t.tx;
    translateY.value = t.ty;
    savedTranslateX.value = t.tx;
    savedTranslateY.value = t.ty;
    transformRef.current = {
      userScale: 1,
      translateX: t.tx,
      translateY: t.ty,
      imgW: t.w,
      imgH: t.h,
      baseScale: t.baseScale,
    };
    setReady(true);
  }, [baseScale, imgH, imgW, savedTranslateX, savedTranslateY, savedUserScale, translateX, translateY, userScale]);

  const handleImageLoad = useCallback(
    (e: NativeSyntheticEvent<ImageLoadEventData>) => {
      if (ready) return;
      const { width, height } = e.nativeEvent.source;
      if (width > 0 && height > 0) {
        applyTransform(width, height);
      }
    },
    [applyTransform, ready],
  );

  const syncTransformRef = (s: number, tx: number, ty: number) => {
    transformRef.current.userScale = s;
    transformRef.current.translateX = tx;
    transformRef.current.translateY = ty;
  };

  useEffect(() => {
    if (!active || !imageUri) {
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);

    if (imageWidth && imageHeight) {
      applyTransform(imageWidth, imageHeight);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const size = await getImageSize(imageUri);
        if (cancelled) return;
        applyTransform(size.width, size.height);
      } catch (e) {
        console.warn('[PetPhotoCrop] load failed:', e);
        if (!cancelled) {
          Alert.alert('Error', 'Could not load the photo. Please try again.');
          onCancel();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, imageUri, imageWidth, imageHeight, applyTransform, onCancel]);

  const clampTranslation = (
    w: number,
    h: number,
    bs: number,
    s: number,
    tx: number,
    ty: number,
  ) => {
    'worklet';
    const dw = w * bs * s;
    const dh = h * bs * s;
    return {
      tx: Math.min(0, Math.max(CROP_SIZE - dw, tx)),
      ty: Math.min(0, Math.max(CROP_SIZE - dh, ty)),
    };
  };

  const composedGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .onBegin(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      })
      .onEnd(() => {
        const clamped = clampTranslation(
          imgW.value,
          imgH.value,
          baseScale.value,
          userScale.value,
          translateX.value,
          translateY.value,
        );
        translateX.value = clamped.tx;
        translateY.value = clamped.ty;
        savedTranslateX.value = clamped.tx;
        savedTranslateY.value = clamped.ty;
        runOnJS(syncTransformRef)(userScale.value, clamped.tx, clamped.ty);
      });

    const pinchGesture = Gesture.Pinch()
      .onBegin(() => {
        savedUserScale.value = userScale.value;
      })
      .onUpdate((e) => {
        userScale.value = Math.max(1, Math.min(savedUserScale.value * e.scale, 4));
      })
      .onEnd(() => {
        savedUserScale.value = userScale.value;
        const clamped = clampTranslation(
          imgW.value,
          imgH.value,
          baseScale.value,
          userScale.value,
          translateX.value,
          translateY.value,
        );
        translateX.value = clamped.tx;
        translateY.value = clamped.ty;
        savedTranslateX.value = clamped.tx;
        savedTranslateY.value = clamped.ty;
        runOnJS(syncTransformRef)(userScale.value, clamped.tx, clamped.ty);
      });

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [
    baseScale,
    imgH,
    imgW,
    savedTranslateX,
    savedTranslateY,
    savedUserScale,
    translateX,
    translateY,
    userScale,
  ]);

  const animatedImageWrapStyle = useAnimatedStyle(() => {
    const w = imgW.value;
    const h = imgH.value;
    const bs = baseScale.value;
    const s = userScale.value;
    return {
      width: w * bs * s,
      height: h * bs * s,
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    };
  });

  const handleDone = async () => {
    if (processing || !ready) return;
    setProcessing(true);
    try {
      const { userScale: s, translateX: tx, translateY: ty, imgW: w, imgH: h, baseScale: bs } =
        transformRef.current;
      const totalScale = bs * s;
      const cropW = CROP_SIZE / totalScale;
      const cropH = CROP_SIZE / totalScale;
      let originX = -tx / totalScale;
      let originY = -ty / totalScale;
      originX = Math.max(0, Math.min(originX, w - cropW));
      originY = Math.max(0, Math.min(originY, h - cropH));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: Math.round(originX),
            originY: Math.round(originY),
            width: Math.round(cropW),
            height: Math.round(cropH),
          },
        }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onDone(result.uri);
    } catch (e) {
      console.warn('[PetPhotoCrop] crop failed:', e);
      Alert.alert('Error', 'Could not crop the photo. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Text style={styles.title}>Adjust Pet Photo</Text>
      <Text style={styles.subtitle}>Pinch to zoom, drag to reposition</Text>

      <View style={styles.cropOuter}>
        <View style={styles.cropWindow}>
          {!ready && !!imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
              onLoad={handleImageLoad}
            />
          )}
          {ready && (
            <GestureDetector gesture={composedGesture}>
              <View style={styles.gestureSurface}>
                <Animated.View style={animatedImageWrapStyle} collapsable={false}>
                  <Image source={{ uri: imageUri }} style={styles.gestureImage} resizeMode="stretch" />
                </Animated.View>
              </View>
            </GestureDetector>
          )}
          {!ready && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <View style={styles.cropFrame} pointerEvents="none" />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={processing}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.doneBtn, (!ready || processing) && styles.doneBtnDisabled]}
          onPress={handleDone}
          disabled={!ready || processing}
        >
          {processing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.doneText}>Done</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.titleLarge,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.white + 'CC',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  cropOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropWindow: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gestureSurface: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gestureImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cropFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radius.small,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.white + '66',
    alignItems: 'center',
  },
  cancelText: {
    ...typography.titleMedium,
    color: colors.white,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  doneBtnDisabled: {
    opacity: 0.6,
  },
  doneText: {
    ...typography.titleMedium,
    color: colors.white,
  },
});
