import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { checkTokenStatus, clearAuthData } from '../utils/tokenUtils';
import { colors } from '../theme';

const LAUNCH_MS = 1800;
const FADE_MS = 380;

export function LaunchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Launch'>>();
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ranRef = useRef(false);

  const goNext = useCallback(async () => {
    const status = await checkTokenStatus();
    if (status === 'valid') {
      navigation.replace('MainTabs');
    } else if (status === 'expired') {
      await clearAuthData();
      navigation.replace('Login');
    } else {
      navigation.replace('Signup');
    }
  }, [navigation]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    Animated.spring(logoScale, {
      toValue: 1.0,
      stiffness: 110,
      damping: 15,
      mass: 1,
      useNativeDriver: true,
    }).start();

    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 500,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      void goNext();
    }, LAUNCH_MS);

    return () => clearTimeout(t);
  }, [goNext, logoScale, logoOpacity, textOpacity]);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image source={require('../../logo.png')} style={styles.logoImage} />
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
          <Text style={styles.title}>PHD</Text>
          <Text style={styles.tagline}>Pet Health Director</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.launchTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
