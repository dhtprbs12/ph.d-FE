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
  Alert,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { PetPhotoCropEditor } from '../components/PetPhotoCropEditor';
import { colors, spacing } from '../theme';

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
  const [cropVisible, setCropVisible] = useState(false);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const optionsRef = useRef<PickerOptions | null>(null);

  const setBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setIsBusy(value);
  }, []);

  const closeFlow = useCallback(() => {
    setCropVisible(false);
    setCropData(null);
    setBusy(false);
    optionsRef.current = null;
  }, [setBusy]);

  const openCrop = useCallback((uri: string, width?: number, height?: number) => {
    setCropData({ uri, width, height });
    setCropVisible(true);
    setBusy(true);
  }, [setBusy]);

  const launchCamera = useCallback(async () => {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Camera access is required to take a photo.');
        setBusy(false);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
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
      console.warn('[PetPhotoPicker] camera failed:', e);
      Alert.alert('Error', 'Could not open the camera.');
      setBusy(false);
    }
  }, [setBusy, openCrop]);

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
      const sheetOptions = ['Cancel', 'Take Photo', 'Choose from Library', ...(hasPhoto ? ['Remove Photo'] : [])];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: sheetOptions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: hasPhoto ? 3 : undefined,
        },
        async (idx) => {
          if (idx === 1) await launchCamera();
          else if (idx === 2) await launchLibrary();
          else if (idx === 3) options.onPhotoSelected(null);
        },
      );
    } else {
      Alert.alert(title, 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
        ...(hasPhoto
          ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => options.onPhotoSelected(null) }]
          : []),
      ]);
    }
  }, [launchCamera, launchLibrary]);

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
        visible={cropVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeFlow}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          {cropData ? (
            <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
              <PetPhotoCropEditor
                active={cropVisible}
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
});
