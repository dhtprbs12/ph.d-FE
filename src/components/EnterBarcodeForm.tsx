import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

export function barcodeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

export function isCompleteBarcode(value: string): boolean {
  return value.length === 8 || value.length === 12 || value.length === 13 || value.length === 14;
}

export function EnterBarcodeForm({
  onBack,
  onSubmit,
  submitting = false,
  topInset = true,
}: {
  onBack: () => void;
  onSubmit: (barcode: string) => void;
  submitting?: boolean;
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const reveal = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'ios' ? 280 : 80);
  };

  const submit = () => {
    const digits = barcodeDigits(value);
    if (!isCompleteBarcode(digits)) {
      setError('Enter the full barcode number.');
      return;
    }
    setError('');
    Keyboard.dismiss();
    onSubmit(digits);
  };

  return (
    <View style={[styles.screen, topInset ? { paddingTop: insets.top } : null]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} disabled={submitting}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Enter barcode</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24 + keyboardHeight }}
        >
          <Text style={styles.label}>Barcode</Text>
          <TextInput
            value={value}
            onChangeText={text => {
              setValue(barcodeDigits(text));
              if (error) setError('');
            }}
            onFocus={reveal}
            autoFocus
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="012345678905"
            placeholderTextColor={colors.textSecondary}
            maxLength={14}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={submit} disabled={submitting} style={[styles.button, submitting && { opacity: 0.6 }]}>
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Look up</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  title: { ...typography.titleMedium, color: colors.textPrimary },
  label: { ...typography.labelLarge, color: colors.textPrimary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    ...typography.bodyLarge,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  error: { ...typography.bodySmall, color: colors.danger, marginTop: spacing.xs },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonText: { ...typography.titleMedium, color: colors.white },
});
