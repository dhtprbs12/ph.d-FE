import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, typography } from '../theme';
import api from '../services/api';

export function LookupRequestCard({
  petName,
  searchQuery,
  submitting = false,
  scrollRef,
  onRequest,
  onUploadPhotos,
  onBack,
  actionLabel = 'Request analysis',
}: {
  petName: string;
  searchQuery: string;
  submitting?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
  onRequest: (input: { brand: string; queryName: string; pastedUrl: string; email: string }) => void;
  onUploadPhotos?: (email: string) => void;
  onBack?: () => void;
  actionLabel?: string;
}) {
  const [brand, setBrand] = useState('');
  const [queryName, setQueryName] = useState(searchQuery);
  const [pastedUrl, setPastedUrl] = useState('');
  const [email, setEmail] = useState('');
  const [linkOffer, setLinkOffer] = useState<string | null>(null);

  useEffect(() => {
    setQueryName(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    api.get<{ email?: string }>('/auth/me').then((res) => {
      const value = String(res.data?.email || '');
      if (value && !value.endsWith('@nickname.local')) setEmail(value);
    }).catch(() => {});
  }, []);

  const ready = brand.trim().length > 0 && queryName.trim().length > 0;

  const revealField = (target: number) => {
    setTimeout(() => {
      const scroller = scrollRef?.current as (ScrollView & {
        scrollResponderScrollNativeHandleToKeyboard?: (node: number, extraHeight: number, preventNegativeScrollOffset: boolean) => void;
      }) | null;
      scroller?.scrollResponderScrollNativeHandleToKeyboard?.(target, 140, true);
    }, 280);
  };

  const onLinkFocus = async (target: number) => {
    revealField(target);
    try {
      const text = await Clipboard.getStringAsync();
      if (/^https?:\/\//i.test(text.trim())) setLinkOffer(text.trim());
    } catch {
      setLinkOffer(null);
    }
  };

  return (
    <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.sm }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 6 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="search" size={26} color={colors.textPrimary} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>
          No product found
        </Text>
      </View>
      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
        We'll look this up for {petName}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
        Write every word you see for the brand and the product name.
      </Text>
      <TextInput
        value={brand}
        onChangeText={setBrand}
        onFocus={(event) => revealField(event.target)}
        placeholder="Brand"
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      <TextInput
        value={queryName}
        onChangeText={setQueryName}
        onFocus={(event) => revealField(event.target)}
        placeholder="Product name"
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      {!ready ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Brand and product name are both required</Text>
      ) : null}
      <TextInput
        value={pastedUrl}
        onChangeText={setPastedUrl}
        onFocus={(event) => onLinkFocus(event.target)}
        placeholder="Product page link (optional)"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        style={inputStyle}
      />
      {linkOffer && !pastedUrl ? (
        <Pressable onPress={() => { setPastedUrl(linkOffer); setLinkOffer(null); }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Use this link?</Text>
        </Pressable>
      ) : null}
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
        A product page link lets us open that exact food. We'll still look it up by name if you skip it.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onFocus={(event) => revealField(event.target)}
        placeholder="Email me too. Optional."
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        style={inputStyle}
      />
      <Pressable
        disabled={!ready || submitting}
        onPress={() => onRequest({ brand: brand.trim(), queryName: queryName.trim(), pastedUrl: pastedUrl.trim(), email: email.trim() })}
        style={{
          backgroundColor: colors.primary,
          opacity: ready && !submitting ? 1 : 0.45,
          borderRadius: radius.medium,
          padding: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '700' }}>{submitting ? 'Sending...' : actionLabel}</Text>
      </Pressable>
      {onUploadPhotos ? (
      <Pressable
        onPress={() => onUploadPhotos(email.trim())}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radius.medium,
          padding: spacing.md,
        }}
      >
        <Ionicons name="camera-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Photograph the product</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            Use the package for a more accurate report. You'll earn 🦴×20.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </Pressable>
      ) : null}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#E4E7E4',
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: colors.textPrimary,
  backgroundColor: colors.white,
};
