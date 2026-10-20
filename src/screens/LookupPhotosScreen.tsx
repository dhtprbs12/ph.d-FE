import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { HomeStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';
import { createPhotoLookup, openAnalysisRequests } from '../services/lookupService';
import { PushOptInModal, registerPushToken } from '../components/PushOptInModal';

type Slot = 'front' | 'ingredients' | 'barcode';

export function LookupPhotosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<any>();
  const { selectedPet } = useApp();
  const mode: 'search' | 'barcode' = route.params?.mode === 'barcode' ? 'barcode' : 'search';
  const [front, setFront] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string | null>(null);
  const barcodeUri: string | null = route.params?.barcodePhotoUri || null;
  const [barcodeShot, setBarcodeShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askPush, setAskPush] = useState(false);

  const slots: { key: Slot; label: string; uri: string | null }[] = mode === 'barcode'
    ? [
        { key: 'front', label: 'Front of the bag', uri: front },
        { key: 'ingredients', label: 'Ingredient panel', uri: ingredients },
      ]
    : [
        { key: 'front', label: 'Front of the bag', uri: front },
        { key: 'ingredients', label: 'Ingredient panel', uri: ingredients },
        { key: 'barcode', label: 'Barcode', uri: barcodeShot },
      ];

  const ready = mode === 'barcode'
    ? Boolean(front && ingredients && barcodeUri && route.params?.barcode)
    : Boolean(front && ingredients && barcodeShot);

  const shoot = async (slot: Slot) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow the camera to photograph the bag.');
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
        email: route.params?.email,
      });
      openAnalysisRequests(navigation);
    } catch (error: any) {
      Alert.alert('Could not send photos', error?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleMedium, { marginLeft: spacing.sm, color: colors.textPrimary }]}>
          Photograph the bag
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
          {mode === 'barcode'
            ? 'Photograph the front and the ingredient panel. The barcode from this scan is attached automatically.'
            : 'Front, ingredient panel, and barcode are all required.'}
        </Text>
        {mode === 'barcode' && !barcodeUri ? (
          <Text style={[typography.bodySmall, { color: colors.danger }]}>
            The barcode photo didn't save. Go back and scan it again.
          </Text>
        ) : null}
        {slots.map((slot) => (
          <Pressable
            key={slot.key}
            onPress={() => shoot(slot.key)}
            style={{
              backgroundColor: colors.white,
              borderRadius: radius.large,
              padding: spacing.md,
              minHeight: 120,
              justifyContent: 'center',
            }}
          >
            {slot.uri ? (
              <Image source={{ uri: slot.uri }} style={{ width: '100%', height: 160, borderRadius: radius.medium }} />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{slot.label}</Text>
            )}
          </Pressable>
        ))}
        <Pressable
          disabled={!ready || busy}
          onPress={() => setAskPush(true)}
          style={{
            backgroundColor: ready && !busy ? colors.primary : colors.textSecondary,
            borderRadius: radius.medium,
            padding: spacing.md,
            alignItems: 'center',
          }}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontWeight: '700' }}>Send photos</Text>}
        </Pressable>
      </ScrollView>
      <PushOptInModal visible={askPush} onAllow={() => submit(true)} onSkip={() => submit(false)} />
    </SafeAreaView>
  );
}
