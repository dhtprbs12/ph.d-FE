import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { useApp } from '../context/AppContext';

/** Mirrors `expo.version` from app.json; falls back after native build */
const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.nativeApplicationVersion ??
  '2.0.4';
const PRIVACY_URL = 'https://phd-be-production.up.railway.app/privacy';
const TERMS_URL = 'https://phd-be-production.up.railway.app/terms';

/**
 * iOS “App Store ID” = Bundle ID가 아니라, App Store Connect에 **앱 항목을 만들 때** 부여되는 숫자(Apple ID).
 *   공개 출시 전에도 됨: appstoreconnect.apple.com → 내 앱 → + 로 앱 생성 → 해당 앱 → 앱 정보(또는 App Information)에 **Apple ID** 숫자가 보임 → 그걸 IOS_APP_STORE_ID에 넣으면 됨. (사용자가 스토어에서 받기 전에도 ID는 이미 존재)
 * Android: app.json의 `expo.android.package` 와 동일.
 */
const IOS_APP_STORE_ID = '0000000000';
const ANDROID_PLAY_PACKAGE = 'com.petfoodanalyzer.app';

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

function rateApp() {
  const url =
    Platform.OS === 'ios'
      ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PLAY_PACKAGE}`;
  if (Platform.OS === 'ios' && IOS_APP_STORE_ID === '0000000000') {
    Alert.alert(
      'App Store ID',
      'App Store Connect에서 앱을 새로 만들면(심사·출시 전에도) Apple ID 숫자가 생깁니다. 해당 앱 → 앱 정보에 나오는 숫자를 IOS_APP_STORE_ID에 넣으면 됩니다. 첫 출시 후에만 아는 값이 아닙니다.',
    );
    return;
  }
  openUrl(url);
}

function useStaggeredFade(count: number) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;
  const translateAnims = useRef(
    Array.from({ length: count }, () => new Animated.Value(12)),
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 350,
          delay: i * 80,
          useNativeDriver: true,
        }),
        Animated.timing(translateAnims[i], {
          toValue: 0,
          duration: 350,
          delay: i * 80,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(animations).start();
  }, [anims, translateAnims]);

  return anims.map((opacity, i) => ({
    opacity,
    transform: [{ translateY: translateAnims[i] }],
  }));
}

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  titleColor?: string;
  value?: string;
  showChevron?: boolean;
  onPress?: () => void;
};

function SettingsRow({
  icon,
  iconColor = colors.primary,
  title,
  titleColor = colors.textPrimary,
  value,
  showChevron = false,
  onPress,
}: SettingsRowProps) {
  const content = (
    <View style={rowStyles.container}>
      <Ionicons name={icon} size={18} color={iconColor} style={rowStyles.icon} />
      <Text style={[rowStyles.title, { color: titleColor }]}>{title}</Text>
      {value != null && <Text style={rowStyles.value}>{value}</Text>}
      {showChevron && (
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    width: 28,
    textAlign: 'center',
  },
  title: {
    ...typography.bodyMedium,
    flex: 1,
  },
  value: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
});

type SettingsSectionProps = {
  title: string;
  children: React.ReactNode;
  style?: Animated.WithAnimatedObject<import('react-native').ViewStyle>;
};

function SettingsSection({ title, children, style }: SettingsSectionProps) {
  return (
    <Animated.View style={[sectionStyles.container, style]}>
      <Text style={sectionStyles.header}>{title.toUpperCase()}</Text>
      <View style={[sectionStyles.card, shadows.card]}>{children}</View>
    </Animated.View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  header: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    overflow: 'hidden',
  },
});

function SectionDivider() {
  return <View style={dividerStyles.line} />;
}

const dividerStyles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 44,
  },
});

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { pets, resetApp } = useApp();
  const fadeStyles = useStaggeredFade(5);

  const onReset = () => {
    Alert.alert(
      'Reset App',
      'This will delete all your pets and reset the app to its initial state. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetApp();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* App Info Card */}
        <Animated.View style={[styles.appInfoOuter, fadeStyles[0]]}>
          <View style={[styles.appInfoCard, shadows.card]}>
            <Image source={require('../../logo.png')} style={styles.appIconCircle} />
            <View style={styles.appInfoText}>
              <Text style={styles.appName}>PHD</Text>
              <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Your Stats */}
        <SettingsSection title="Your Stats" style={fadeStyles[1]}>
          <SettingsRow icon="paw" iconColor={colors.primary} title="Pets" value={String(pets.length)} />
        </SettingsSection>

        <View style={styles.sectionGap} />

        {/* About */}
        <SettingsSection title="About" style={fadeStyles[2]}>
          <SettingsRow
            icon="hand-left"
            iconColor={colors.primary}
            title="Privacy Policy"
            showChevron
            onPress={() => openUrl(PRIVACY_URL)}
          />
          <SectionDivider />
          <SettingsRow
            icon="document-text"
            iconColor={colors.primary}
            title="Terms of Service"
            showChevron
            onPress={() => openUrl(TERMS_URL)}
          />
          <SectionDivider />
          <SettingsRow
            icon="star"
            iconColor={colors.accent}
            title="Rate App"
            showChevron
            onPress={rateApp}
          />
        </SettingsSection>

        <View style={styles.sectionGap} />

        {/* Data */}
        <SettingsSection title="Data" style={fadeStyles[3]}>
          <SettingsRow
            icon="refresh"
            iconColor={colors.danger}
            title="Reset App"
            titleColor={colors.danger}
            onPress={onReset}
          />
        </SettingsSection>

        {/* Footer */}
        <Animated.View style={[styles.footer, fadeStyles[4]]}>
          <Text style={styles.footerText}>Made with ❤️ for pet lovers</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  scroll: {
    paddingTop: spacing.xxs,
  },
  appInfoOuter: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  appInfoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  appInfoText: {
    marginLeft: spacing.xs,
    gap: 4,
  },
  appName: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  appVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  sectionGap: {
    height: spacing.lg,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
