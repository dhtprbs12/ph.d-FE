import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, shadows } from '../../theme';

type ToastType = 'success' | 'error' | 'reward' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  icon?: string;
  duration?: number;
}

interface ToastContextValue {
  show: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ACCENT_COLORS: Record<ToastType, string> = {
  success: colors.primary,
  error: colors.danger,
  reward: colors.accent,
  info: colors.textSecondary,
};

const DEFAULT_ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  reward: '🎉',
  info: 'ℹ️',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<(ToastConfig & { key: number }) | null>(null);
  const keyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(-120, { duration: 250 }, () => {
      runOnJS(setCurrent)(null);
    });
  }, [opacity, translateY]);

  const show = useCallback((config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    keyRef.current += 1;
    const entry = { ...config, key: keyRef.current };
    setCurrent(entry);

    translateY.value = -120;
    opacity.value = 0;
    translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    const dur = config.duration ?? 2500;
    timerRef.current = setTimeout(() => dismiss(), dur);
  }, [dismiss, opacity, translateY]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .onUpdate((e) => {
        if (e.translationY < 0) {
          translateY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        if (e.translationY < -30) {
          runOnJS(dismiss)();
        } else {
          translateY.value = withSpring(0, { damping: 18 });
        }
      }),
  [dismiss, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const contextValue = useMemo(() => ({ show }), [show]);

  const type = current?.type ?? 'success';
  const accentColor = ACCENT_COLORS[type];
  const icon = current?.icon ?? DEFAULT_ICONS[type];

  const toastNode = current ? (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        style={[
          styles.container,
          { top: insets.top + 8 },
          animatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <Pressable onPress={dismiss} style={styles.pressable}>
          <View style={[styles.toast, shadows.elevated]}>
            <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.message} numberOfLines={3}>{current.message}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  ) : null;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toastNode && Platform.OS === 'ios' ? (
        <FullWindowOverlay>{toastNode}</FullWindowOverlay>
      ) : toastNode}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  pressable: {
    width: '100%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radius.medium,
    borderBottomLeftRadius: radius.medium,
  },
  icon: {
    fontSize: 18,
    marginLeft: 4,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
});
