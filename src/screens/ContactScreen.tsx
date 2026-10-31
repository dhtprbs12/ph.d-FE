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
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import api from '../services/api';

const TOPICS = ['Account', 'PHD Plus', 'A food or scan', 'Something else'] as const;
const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.nativeApplicationVersion ??
  '2.0.9';

function usableEmail(value: string): string {
  const email = value.trim();
  if (!email || email.endsWith('@nickname.local') || email.endsWith('@device.local')) return '';
  return email;
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('Account');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [messageError, setMessageError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    api.get<{ user?: { email?: string } }>('/auth/me').then(res => {
      const value = usableEmail(String(res.data?.user?.email || ''));
      if (value) setEmail(current => current || value);
    }).catch(() => {});
  }, []);

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

  const revealEmail = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'ios' ? 280 : 80);
  };

  const send = async () => {
    const text = message.trim();
    const addr = email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
    setMessageError(text ? '' : 'Write a message before sending.');
    setEmailError(emailOk ? '' : 'Enter an email address so we can reply.');
    setSendError('');
    if (!text || !emailOk || sending) return;
    setSending(true);
    try {
      await api.post('/contact', {
        topic,
        message: text,
        email: addr,
        appVersion: APP_VERSION,
        platform: Platform.OS,
      });
      setSent(true);
    } catch (e: any) {
      const status = e?.response?.status;
      setSendError(status === 429
        ? 'Please wait a few minutes before sending another message.'
        : 'Could not send the message. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        {sent ? (
          <View style={styles.sent}>
            <Text style={styles.sentTitle}>Sent.</Text>
            <Text style={styles.hint}>We'll reply by email.</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24 + keyboardHeight }}
          >
            <Text style={styles.lead}>We read every message.</Text>
            <Text style={styles.label}>Topic</Text>
            <View style={styles.topics}>
              {TOPICS.map(item => {
                const selected = item === topic;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setTopic(item)}
                    style={[styles.topic, selected && styles.topicOn]}
                  >
                    <Text style={[styles.topicText, selected && styles.topicTextOn]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={value => {
                setMessage(value);
                if (messageError) setMessageError('');
              }}
              placeholder="My food scan has been pending since yesterday."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              style={styles.message}
            />
            {messageError ? <Text style={styles.error}>{messageError}</Text> : null}
            <Text style={styles.label}>Email</Text>
            <Text style={styles.hint}>We'll reply to this address.</Text>
            <TextInput
              value={email}
              onChangeText={value => {
                setEmail(value);
                if (emailError) setEmailError('');
              }}
              onFocus={revealEmail}
              placeholder="name@email.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            <Pressable onPress={send} disabled={sending} style={[styles.send, sending && { opacity: 0.6 }]}>
              {sending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
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
  headerTitle: { ...typography.titleMedium, color: colors.textPrimary },
  lead: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  label: { ...typography.labelLarge, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  topic: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  topicOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicText: { ...typography.bodyMedium, color: colors.textPrimary },
  topicTextOn: { color: colors.white, fontWeight: '600' },
  message: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    padding: spacing.sm,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  error: { ...typography.bodySmall, color: colors.danger, marginTop: spacing.xs },
  send: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  sendText: { ...typography.titleMedium, color: colors.white },
  sent: { padding: spacing.lg, paddingTop: spacing.xl },
  sentTitle: { ...typography.displaySmall, color: colors.textPrimary, marginBottom: spacing.xs },
});
