import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as authService from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { colors, spacing, radius, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);

  const [nickname, setNickname] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameReason, setNicknameReason] = useState('');
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<'dog' | 'cat'>('dog');
  const [breed, setBreed] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [activityLevel, setActivityLevel] = useState<'low' | 'moderate' | 'high'>('moderate');

  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!nickname || nickname.length < 2) {
      setNicknameAvailable(null);
      setNicknameReason('');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setNicknameAvailable(false);
      setNicknameReason('Only letters, numbers, and underscores');
      return;
    }

    setNicknameChecking(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await authService.checkNickname(nickname);
        setNicknameAvailable(result.available);
        setNicknameReason(result.reason || '');
      } catch {
        setNicknameAvailable(null);
      } finally {
        setNicknameChecking(false);
      }
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nickname]);

  const pinValid = pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin);
  const pinMatch = pin === pinConfirm;
  const step1Ready = nicknameAvailable === true && pinValid && pinMatch;
  const step2Ready = petName.trim().length > 0;

  const handleRegister = async () => {
    if (!step2Ready) return;
    setLoading(true);
    try {
      const { token, user } = await authService.registerWithNickname(nickname, pin);
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', user.id);

      await api.post('/pets', {
        name: petName.trim(),
        pet_type: petType,
        breed: breed.trim() || null,
        age_months: ageMonths ? parseInt(ageMonths) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        sex,
        activity_level: activityLevel,
      });

      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.form}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Choose a nickname and PIN to get started</Text>

            <Text style={styles.label}>Nickname</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={nickname}
                onChangeText={setNickname}
                placeholder="e.g. puppy_lover_42"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
              {nicknameChecking && <ActivityIndicator size="small" style={styles.inputIcon} color={colors.primary} />}
              {!nicknameChecking && nicknameAvailable === true && <Text style={styles.checkOk}>✓</Text>}
              {!nicknameChecking && nicknameAvailable === false && <Text style={styles.checkFail}>✗</Text>}
            </View>
            {nicknameReason ? <Text style={styles.hint}>{nicknameReason}</Text> : null}

            <Text style={styles.label}>PIN (4-6 digits)</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />

            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              style={styles.input}
              value={pinConfirm}
              onChangeText={setPinConfirm}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            {pinConfirm.length > 0 && !pinMatch && <Text style={styles.hint}>PINs do not match</Text>}

            <TouchableOpacity
              style={[styles.button, !step1Ready && styles.buttonDisabled]}
              onPress={() => setStep(1)}
              disabled={!step1Ready}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.title}>Your Pet</Text>
            <Text style={styles.subtitle}>Tell us about your first pet</Text>

            <Text style={styles.label}>Pet Name *</Text>
            <TextInput
              style={styles.input}
              value={petName}
              onChangeText={setPetName}
              placeholder="e.g. Buddy"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.chip, petType === 'dog' && styles.chipActive]} onPress={() => setPetType('dog')}>
                <Text style={[styles.chipText, petType === 'dog' && styles.chipTextActive]}>Dog</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, petType === 'cat' && styles.chipActive]} onPress={() => setPetType('cat')}>
                <Text style={[styles.chipText, petType === 'cat' && styles.chipTextActive]}>Cat</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Breed</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Age (months)</Text>
            <TextInput
              style={styles.input}
              value={ageMonths}
              onChangeText={setAgeMonths}
              keyboardType="number-pad"
              placeholder="e.g. 24"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder="e.g. 12.5"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Sex</Text>
            <View style={styles.row}>
              {(['male', 'female', 'unknown'] as const).map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, sex === s && styles.chipActive]} onPress={() => setSex(s)}>
                  <Text style={[styles.chipText, sex === s && styles.chipTextActive]}>
                    {s === 'unknown' ? 'Unknown' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Activity Level</Text>
            <View style={styles.row}>
              {(['low', 'moderate', 'high'] as const).map((a) => (
                <TouchableOpacity key={a} style={[styles.chip, activityLevel === a && styles.chipActive]} onPress={() => setActivityLevel(a)}>
                  <Text style={[styles.chipText, activityLevel === a && styles.chipTextActive]}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.flex1, (!step2Ready || loading) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={!step2Ready || loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  form: { width: '100%' },
  title: { ...typography.displayLarge, color: colors.textPrimary, marginBottom: spacing.xxs },
  subtitle: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: spacing.lg },
  label: { ...typography.labelLarge, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xxs + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    padding: 14,
    ...typography.bodyLarge,
    backgroundColor: colors.card,
    color: colors.textPrimary,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1 },
  inputIcon: { marginLeft: spacing.xs },
  checkOk: { marginLeft: spacing.xs, fontSize: 18, color: colors.safe },
  checkFail: { marginLeft: spacing.xs, fontSize: 18, color: colors.danger },
  hint: { ...typography.labelSmall, color: colors.danger, marginTop: spacing.xxs },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { backgroundColor: colors.divider },
  buttonText: { color: colors.white, ...typography.titleMedium },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.primary, ...typography.bodySmall },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.lightGray,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  backBtn: { paddingHorizontal: 20, paddingVertical: spacing.md, marginTop: spacing.lg },
  backBtnText: { color: colors.primary, ...typography.titleMedium },
  flex1: { flex: 1 },
});
