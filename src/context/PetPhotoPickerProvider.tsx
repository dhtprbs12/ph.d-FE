import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PetPhotoCropEditor } from '../components/PetPhotoCropEditor';
import { colors, radius, spacing, typography } from '../theme';

type FlowStep = 'camera' | 'crop';

type CropData = {
  uri: string;
  width?: number;
  height?: number;
};

type PickerOptions = {
  currentPhotoUri?: string | null;
  onPhotoSelected: (uri: string | null) => void;
  title?: string;
};

type PetPhotoPickerContextValue = {
  openPicker: (options: PickerOptions) => void;
  isBusy: boolean;
};

const PetPhotoPickerContext = createContext<PetPhotoPickerContextValue | null>(null);

export function PetPhotoPickerProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<FlowStep>('camera');
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const optionsRef = useRef<PickerOptions | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const setBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setIsBusy(value);
  }, []);

  const closeFlow = useCallback(() => {
    setVisible(false);
    setStep('camera');
    setCropData(null);
    setCapturing(false);
    setCameraReady(false);
    setBusy(false);
    optionsRef.current = null;
  }, [setBusy]);

  const openCrop = useCallback((uri: string, width?: number, height?: number) => {
    setCropData({ uri, width, height });
    setStep('crop');
    setVisible(true);
    setBusy(true);
  }, [setBusy]);

  const openCameraFlow = useCallback(() => {
    setCropData(null);
    setCameraReady(false);
    setStep('camera');
    setVisible(true);
    setBusy(true);
  }, [setBusy]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || !cameraReady) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return;
      setCropData({ uri: photo.uri, width: photo.width, height: photo.height });
      setStep('crop');
    } catch (e) {
      console.warn('[PetPhotoPicker] capture failed:', e);
      Alert.alert('Error', 'Could not take the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [cameraReady, capturing]);

  const launchLibrary = useCallback(async () => {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Photo library access is required to choose a photo.');
        setBusy(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        setBusy(false);
        return;
      }
      const asset = result.assets[0];
      openCrop(asset.uri, asset.width, asset.height);
    } catch (e) {
      console.warn('[PetPhotoPicker] library failed:', e);
      Alert.alert('Error', 'Could not open the photo library.');
      setBusy(false);
    }
  }, [setBusy, openCrop]);

  const openPicker = useCallback((options: PickerOptions) => {
    if (busyRef.current) return;
    optionsRef.current = options;

    const hasPhoto = !!options.currentPhotoUri;
    const title = options.title ?? 'Add Pet Photo';

    if (Platform.OS === 'ios') {
      const sheetOptions = ['Cancel', 'Take Pet photo', 'Choose from Library', ...(hasPhoto ? ['Remove Pet photo'] : [])];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: sheetOptions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: hasPhoto ? 3 : undefined,
        },
        async (idx) => {
          if (idx === 1) openCameraFlow();
          else if (idx === 2) await launchLibrary();
          else if (idx === 3) options.onPhotoSelected(null);
        },
      );
    } else {
      Alert.alert(title, 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Pet photo', onPress: openCameraFlow },
        { text: 'Choose from Library', onPress: launchLibrary },
        ...(hasPhoto
          ? [{ text: 'Remove Pet photo', style: 'destructive' as const, onPress: () => options.onPhotoSelected(null) }]
          : []),
      ]);
    }
  }, [launchLibrary, openCameraFlow]);

  const handleCropDone = useCallback((uri: string) => {
    optionsRef.current?.onPhotoSelected(uri);
    closeFlow();
  }, [closeFlow]);

  const contextValue = useMemo(
    () => ({ openPicker, isBusy }),
    [openPicker, isBusy],
  );

  return (
    <PetPhotoPickerContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeFlow}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          {step === 'camera' ? (
            <View style={styles.cameraScreen}>
              {permission?.granted ? (
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraFill}
                  facing="back"
                  mode="picture"
                  ratio="4:3"
                  onCameraReady={() => setCameraReady(true)}
                />
              ) : (
                <View style={[styles.permissionBox, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                  <Text style={styles.permissionText}>Camera access is required to take a pet photo.</Text>
                  <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Allow Camera</Text>
                  </Pressable>
                  <Pressable onPress={closeFlow} style={styles.permissionCancel}>
                    <Text style={styles.permissionCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

              {permission?.granted && (
                <>
                  <View style={[styles.cameraOverlayTop, { paddingTop: insets.top + spacing.sm }]}>
                    <Pressable onPress={closeFlow} style={styles.cameraCloseBtn} hitSlop={12}>
                      <Ionicons name="close" size={28} color={colors.white} />
                    </Pressable>
                  </View>

                  <View style={[styles.cameraOverlayBottom, { paddingBottom: insets.bottom + spacing.lg }]}>
                    <Pressable
                      style={[styles.shutterBtn, capturing && styles.shutterBtnDisabled]}
                      onPress={handleCapture}
                      disabled={capturing || !cameraReady}
                    >
                      {capturing ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <View style={styles.shutterInner} />
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : step === 'crop' && cropData ? (
            <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
              <PetPhotoCropEditor
                active={step === 'crop'}
                imageUri={cropData.uri}
                imageWidth={cropData.width}
                imageHeight={cropData.height}
                onCancel={closeFlow}
                onDone={handleCropDone}
              />
            </View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </PetPhotoPickerContext.Provider>
  );
}

export function usePetPhotoPickerContext() {
  const ctx = useContext(PetPhotoPickerContext);
  if (!ctx) {
    throw new Error('usePetPhotoPicker must be used within PetPhotoPickerProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  cameraFill: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  cameraCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  permissionText: {
    ...typography.bodyMedium,
    color: colors.white,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
  },
  permissionBtnText: {
    ...typography.titleMedium,
    color: colors.white,
  },
  permissionCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  permissionCancelText: {
    ...typography.bodyMedium,
    color: colors.white + 'CC',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnDisabled: {
    opacity: 0.6,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
  },
});
