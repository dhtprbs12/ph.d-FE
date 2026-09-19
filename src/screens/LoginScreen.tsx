import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as authService from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useToast } from '../components/common/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { authenticateAndSync } = useApp();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    AsyncStorage.getItem('userNickname').then((saved) => {
      if (saved) setNickname(saved);
    });
  }, []);

  const canLogin = nickname.trim().length >= 2 && pin.length >= 4;

  const handleLogin = async () => {
    if (!canLogin) return;
    setLoading(true);
    try {
      const { token, user } = await authService.loginWithNickname(nickname.trim(), pin);
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userNickname', nickname.trim());
      await authenticateAndSync();
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.error === 'too_many_attempts') {
        toast.show({ message: data.message, type: 'error' });
      } else {
        toast.show({ message: data?.message || 'Invalid ID or PIN', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        bounces={false}
      >
        <View style={styles.logoRow}>
          <Image source={require('../../logo.png')} style={styles.logoImg} />
          <Text style={styles.logoText}>PHD</Text>
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Log in with your ID and PIN</Text>

        <Text style={styles.label}>ID</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Your ID"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>PIN</Text>
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

        <TouchableOpacity
          style={[styles.button, (!canLogin || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!canLogin || loading}
        >
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: spacing.lg },
  logoImg: { width: 36, height: 36, borderRadius: 8 },
  logoText: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
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
});
