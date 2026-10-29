import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, typography } from '../theme';
import { AnalysisNotice } from './AnalysisNotice';

const SLOTS = [
  { key: 'front' as const, label: 'Front of the product', hint: 'The name and brand should be readable', icon: 'image-outline' as const },
  { key: 'ingredients' as const, label: 'Ingredient panel', hint: 'The full list, not the marketing side', icon: 'list-outline' as const },
];

export function BarcodeRegisterFields({
  barcode,
  petName,
  onBack,
  requested = false,
  onRequest,
  onChange,
}: {
  barcode: string;
  petName: string;
  onBack: () => void;
  requested?: boolean;
  onRequest: () => void;
  onChange: (photos: { front: string | null; ingredients: string | null; email?: string }) => void;
}) {
  const [front, setFront] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const shoot = async (slot: 'front' | 'ingredients') => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow the camera so we can read the product.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    const nextFront = slot === 'front' ? uri : front;
    const nextIngredients = slot === 'ingredients' ? uri : ingredients;
    if (slot === 'front') setFront(uri);
    if (slot === 'ingredients') setIngredients(uri);
    onChange({ front: nextFront, ingredients: nextIngredients, email: email.trim() || undefined });
  };

  const photoFor = (slot: 'front' | 'ingredients') => (slot === 'front' ? front : ingredients);
  const ready = Boolean(front && ingredients);

  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 6 }}>
        <Ionicons name="chevron-back" size={28} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '700' }}>Go Back</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="search" size={26} color={colors.textPrimary} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>No product found</Text>
      </View>
      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>We'll look this up for {petName}</Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
        Photograph the front and the ingredient panel. Barcode {barcode} is already attached.
      </Text>
      {SLOTS.map((slot) => {
        const uri = photoFor(slot.key);
        return (
          <Pressable key={slot.key} onPress={() => shoot(slot.key)} style={slotCard}>
            {uri ? (
              <Image source={{ uri }} style={{ width: '100%', height: 180 }} />
            ) : (
              <View style={emptyRow}>
                <View style={iconCircle}>
                  <Ionicons name={slot.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{slot.label}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{slot.hint}</Text>
                </View>
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
              </View>
            )}
          </Pressable>
        );
      })}
      <TextInput
        value={email}
        onChangeText={(v) => { setEmail(v); onChange({ front, ingredients, email: v.trim() || undefined }); }}
        placeholder="Email me too. Optional."
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: radius.medium,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          color: colors.textPrimary,
          backgroundColor: colors.card,
        }}
      />
      {requested ? (
        <AnalysisNotice />
      ) : (
        <>
          {!ready ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Front and ingredient photos are both required</Text>
          ) : null}
          <Pressable
            disabled={!ready}
            onPress={onRequest}
            style={{
              backgroundColor: colors.primary,
              opacity: ready ? 1 : 0.45,
              borderRadius: radius.medium,
              padding: spacing.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>Use this food</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const slotCard = {
  backgroundColor: colors.card,
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.divider,
  overflow: 'hidden' as const,
};

const emptyRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.md,
  padding: spacing.md,
};

const iconCircle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: colors.primary + '14',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
