import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { HomeStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';
import api from '../services/api';
import petFoodService from '../services/petFoodService';
import { createPhotoLookup, openAnalysisRequests } from '../services/lookupService';
import { PushOptInModal, notificationPermissionStatus, registerPushToken } from '../components/PushOptInModal';
import { calendarDaysOnFood } from '../utils/foodTime';
import { SwitchFoodDialog } from '../components/SwitchFoodDialog';

type Slot = 'front' | 'ingredients' | 'barcode';

const SLOT_COPY: Record<Slot, { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }> = {
  front: { label: 'Front of the product', hint: 'The name and brand should be readable', icon: 'image-outline' },
  ingredients: { label: 'Ingredient panel', hint: 'The full list, not the marketing side', icon: 'list-outline' },
  barcode: { label: 'Barcode', hint: 'The printed bars, in focus', icon: 'barcode-outline' },
};

export function LookupPhotosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { selectedPet } = useApp();
  const mode: 'search' | 'barcode' = route.params?.mode === 'barcode' ? 'barcode' : 'search';
  const petName = selectedPet?.name || 'your pet';
  const [front, setFront] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string | null>(null);
  const barcodeUri: string | null = route.params?.barcodePhotoUri || null;
  const [barcodeShot, setBarcodeShot] = useState<string | null>(null);
  const [email, setEmail] = useState(route.params?.email || '');
  const [busy, setBusy] = useState(false);
  const [askPush, setAskPush] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [currentFoodName, setCurrentFoodName] = useState('');
  const [foodDays, setFoodDays] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const replacing = route.params?.replaceCurrentFood === true;

  useEffect(() => {
    if (!replacing || !selectedPet?.id) return;
    petFoodService.getCurrentFood(selectedPet.id).then((food) => {
      if (!food) return;
      setCurrentFoodName(food.productName || '');
      setFoodDays(calendarDaysOnFood(food.startedAt, null, true));
    }).catch(() => {});
  }, [replacing, selectedPet?.id]);

  useEffect(() => {
    if (route.params?.email) return;
    api.get<{ email?: string }>('/auth/me').then((res) => {
      const value = String(res.data?.email || '');
      if (value && !value.endsWith('@nickname.local')) setEmail(value);
    }).catch(() => {});
  }, [route.params?.email]);

  const slots: Slot[] = mode === 'barcode' ? ['front', 'ingredients'] : ['front', 'ingredients', 'barcode'];
  const photoFor = (slot: Slot) => (slot === 'front' ? front : slot === 'ingredients' ? ingredients : barcodeShot);
  const ready = mode === 'barcode'
    ? Boolean(front && ingredients && barcodeUri && route.params?.barcode)
    : Boolean(front && ingredients && barcodeShot);

  const shoot = async (slot: Slot) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow the camera so we can read the product.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    if (slot === 'front') setFront(uri);
    if (slot === 'ingredients') setIngredients(uri);
    if (slot === 'barcode') setBarcodeShot(uri);
  };

  const submit = async (allowPush: boolean) => {
    if (!ready || !front || !ingredients || !selectedPet) return;
    setAskPush(false);
    setBusy(true);
    try {
      if (allowPush) await registerPushToken();
      await createPhotoLookup({
        frontImageUri: front,
        ingredientImageUri: ingredients,
        barcodeImageUri: mode === 'barcode' ? barcodeUri! : barcodeShot!,
        barcode: route.params?.barcode,
        petId: selectedPet.id,
        petName: selectedPet.name,
        petType: selectedPet.pet_type,
        email: email.trim() || undefined,
        setAsCurrentFood: route.params?.setAsCurrentFood === true,
        replaceCurrentFood: route.params?.replaceCurrentFood === true,
        productName: route.params?.productName,
      });
      openAnalysisRequests(navigation);
    } catch (error: any) {
      Alert.alert('Could not send photos', error?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const askThenSubmit = async () => {
    const status = await notificationPermissionStatus();
    if (status === 'granted') {
      await submit(true);
      return;
    }
    if (status === 'denied') {
      Alert.alert(
        'Notifications are off',
        'Turn on notifications in Settings so we can ping you when the report is ready.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => submit(false) },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    setAskPush(true);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
          {mode === 'barcode' ? 'Read this product' : 'Upload photos'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS !== 'ios'}
      >
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
          {mode === 'barcode' ? `We'll read this product for ${petName}` : 'Read the bag itself'}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
          {mode === 'barcode'
            ? "This product isn't in the app yet. Photograph the front and the ingredient panel."
            : "Read the bag itself for a more accurate report. You'll earn 🦴×20."}
        </Text>

        {mode === 'barcode' && !barcodeUri ? (
          <Text style={[typography.bodySmall, { color: colors.danger }]}>
            The barcode photo didn't save. Go back and scan it again.
          </Text>
        ) : null}

        {slots.map((slot) => {
          const copy = SLOT_COPY[slot];
          const uri = photoFor(slot);
          return (
            <Pressable key={slot} onPress={() => shoot(slot)} style={styles.slot}>
              {uri ? (
                <Image source={{ uri }} style={styles.preview} />
              ) : (
                <View style={styles.slotEmpty}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={copy.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{copy.label}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{copy.hint}</Text>
                  </View>
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                </View>
              )}
            </Pressable>
          );
        })}

        <TextInput
          value={email}
          onChangeText={setEmail}
          onFocus={() => {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
          }}
          placeholder="Email me too. Optional."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          disabled={!ready || busy}
          onPress={() => {
            if (replacing) {
              setConfirmSwitch(true);
              return;
            }
            askThenSubmit();
          }}
          style={[styles.submit, (!ready || busy) && styles.submitOff]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[typography.labelLarge, { color: colors.white }]}>Request analysis</Text>
          )}
        </Pressable>
      </View>
      <PushOptInModal
        visible={askPush}
        onClose={() => setAskPush(false)}
        onAllow={() => submit(true)}
        onSkip={() => submit(false)}
      />
      <SwitchFoodDialog
        visible={confirmSwitch}
        currentName={currentFoodName}
        dayCount={foodDays}
        newName={route.params?.barcode || 'Scanned food'}
        onCancel={() => setConfirmSwitch(false)}
        onConfirm={() => {
          setConfirmSwitch(false);
          askThenSubmit();
        }}
      />
    </KeyboardAvoidingView>
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
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  slot: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  slotEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: 180 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: { backgroundColor: colors.textSecondary },
});
