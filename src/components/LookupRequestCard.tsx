import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, typography } from '../theme';
import api from '../services/api';

export function LookupRequestCard({
  petName,
  searchQuery,
  submitting,
  onRequest,
  onUploadPhotos,
}: {
  petName: string;
  searchQuery: string;
  submitting: boolean;
  onRequest: (input: { brand: string; queryName: string; pastedUrl: string; email: string }) => void;
  onUploadPhotos: (email: string) => void;
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

  const onLinkFocus = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (/^https?:\/\//i.test(text.trim())) setLinkOffer(text.trim());
    } catch {
      setLinkOffer(null);
    }
  };

  return (
    <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.sm }}>
      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
        We'll look this up for {petName}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
        This food isn't in the app yet. Add the brand and product name, and we'll read the published ingredient panel.
      </Text>
      <TextInput
        value={brand}
        onChangeText={setBrand}
        placeholder="Brand"
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      <TextInput
        value={queryName}
        onChangeText={setQueryName}
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
        onFocus={onLinkFocus}
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
          backgroundColor: ready && !submitting ? colors.primary : colors.textSecondary,
          borderRadius: radius.medium,
          padding: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '700' }}>{submitting ? 'Sending...' : 'Request analysis'}</Text>
      </Pressable>
      <Pressable onPress={() => onUploadPhotos(email.trim())} style={{ paddingVertical: spacing.sm }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Upload photos instead</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
          Read the bag itself for a more accurate report. You'll earn 🦴×20.
        </Text>
      </Pressable>
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
