import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, typography } from '../theme';
import api from '../services/api';
import type { NameLookupInput } from '../services/lookupService';

export function LookupRequestCard({
  petName,
  petType,
  searchQuery,
  submitting = false,
  scrollRef,
  onRequest,
  onUploadPhotos,
  onBack,
  actionLabel = 'Request analysis',
}: {
  petName: string;
  petType?: string;
  searchQuery: string;
  submitting?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
  onRequest: (input: NameLookupInput) => void;
  onUploadPhotos?: (email: string) => void;
  onBack?: () => void;
  actionLabel?: string;
}) {
  const [brand, setBrand] = useState('');
  const [queryName, setQueryName] = useState(searchQuery);
  const [protein, setProtein] = useState('');
  const [lifeStage, setLifeStage] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<string | null>(null);
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

  const ready = brand.trim().length > 0 && queryName.trim().length > 0 && protein.trim().length > 0;
  const stages = petType === 'cat'
    ? [{ id: 'kitten', label: 'Kitten' }, { id: 'adult', label: 'Adult' }, { id: 'senior', label: 'Senior' }, { id: 'all', label: 'All' }]
    : [{ id: 'puppy', label: 'Puppy' }, { id: 'adult', label: 'Adult' }, { id: 'senior', label: 'Senior' }, { id: 'all', label: 'All' }];

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
        <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, paddingVertical: 6 }}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>
        We'll look this up for {petName}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
        Write the brand, the product name, and the protein as they appear on the package.
      </Text>
      <Field label="Brand">
        <TextInput
          value={brand}
          onChangeText={setBrand}
          onFocus={(event) => revealField(event.target)}
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      </Field>
      <Field label="Product name">
        <TextInput
          value={queryName}
          onChangeText={setQueryName}
          onFocus={(event) => revealField(event.target)}
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      </Field>
      <Field label="Protein">
        <TextInput
          value={protein}
          onChangeText={setProtein}
          onFocus={(event) => revealField(event.target)}
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      </Field>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 6 }}>Optional</Text>
      <ChoiceRow
        label="Life stage"
        options={stages}
        selected={lifeStage}
        onSelect={(id) => setLifeStage(current => current === id ? null : id)}
      />
      <ChoiceRow
        label="Dry or wet"
        options={[{ id: 'dry', label: 'Dry' }, { id: 'wet', label: 'Wet' }]}
        selected={foodForm}
        onSelect={(id) => setFoodForm(current => current === id ? null : id)}
      />
      <Field label="Product page link">
        <TextInput
          value={pastedUrl}
          onChangeText={setPastedUrl}
          onFocus={(event) => onLinkFocus(event.target)}
          placeholder="https://"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={inputStyle}
        />
      </Field>
      {linkOffer && !pastedUrl ? (
        <Pressable onPress={() => { setPastedUrl(linkOffer); setLinkOffer(null); }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Use this link?</Text>
        </Pressable>
      ) : null}
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
        A product page link lets us open that exact food. We'll still look it up by name if you skip it.
      </Text>
      <Field label="Email">
        <TextInput
          value={email}
          onChangeText={setEmail}
          onFocus={(event) => revealField(event.target)}
          placeholder="We'll reply here too"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={inputStyle}
        />
      </Field>
      <Pressable
        disabled={!ready || submitting}
        onPress={() => onRequest({
          brand: brand.trim(),
          queryName: queryName.trim(),
          protein: protein.trim(),
          lifeStage: lifeStage || '',
          foodForm: foodForm || '',
          pastedUrl: pastedUrl.trim(),
          email: email.trim(),
        })}
        style={{
          backgroundColor: colors.primary,
          opacity: ready && !submitting ? 1 : 0.45,
          borderRadius: radius.medium,
          padding: spacing.md,
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '700' }}>{submitting ? 'Sending...' : actionLabel}</Text>
      </Pressable>
      {onUploadPhotos ? (
      <Pressable
        onPress={() => onUploadPhotos(email.trim())}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E7F4EE', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>Photograph the product</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            Use the package for a more accurate report. You'll earn 20 bones.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map(option => {
          const on = option.id === selected;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={{
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.divider,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                backgroundColor: on ? colors.primary : colors.white,
              }}
            >
              <Text style={[typography.labelMedium, { color: on ? colors.white : colors.textPrimary }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
