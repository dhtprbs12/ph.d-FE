import React, { useEffect, useState, useRef } from 'react';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { colors, spacing } from '../../theme';

/**
 * True only when the OS is confident we're offline: no link, or explicit "no internet".
 * isInternetReachable `null` = still checking — do not treat as offline (avoids flash on resume).
 * After backgrounding, a brief `isConnected: false` is common; we debounce showing the banner.
 */
function isDefinitelyOffline(
  s: { isConnected: boolean | null; isInternetReachable: boolean | null }
): boolean {
  if (s.isConnected === false) return true;
  if (s.isConnected && s.isInternetReachable === false) return true;
  return false;
}

function isDefinitelyOnline(
  s: { isConnected: boolean | null; isInternetReachable: boolean | null }
): boolean {
  if (s.isConnected === true) {
    if (s.isInternetReachable === false) return false;
    return true;
  }
  return false;
}

const SHOW_OFFLINE_MS = 2000;
/** After resuming the app, NetInfo often spuriously reports offline for 1–3s — suppress banner. */
const FOREGROUND_GRACE_MS = 4000;

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceUntilRef = useRef(0);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const applyState = (state: NetInfoState) => {
      const inGrace = Date.now() < graceUntilRef.current;

      if (inGrace) {
        if (isDefinitelyOnline(state)) {
          clearShowTimer();
          setIsOffline(false);
          return;
        }
        if (isDefinitelyOffline(state)) {
          clearShowTimer();
          return;
        }
        clearShowTimer();
        return;
      }

      if (isDefinitelyOnline(state)) {
        clearShowTimer();
        setIsOffline(false);
        return;
      }
      if (isDefinitelyOffline(state)) {
        clearShowTimer();
        showTimerRef.current = setTimeout(() => {
          setIsOffline(true);
          showTimerRef.current = null;
        }, SHOW_OFFLINE_MS);
        return;
      }
      clearShowTimer();
    };

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        graceUntilRef.current = Date.now() + FOREGROUND_GRACE_MS;
        clearShowTimer();
        setIsOffline(false);
        setTimeout(() => {
          void NetInfo.fetch().then(applyState);
        }, 400);
      }
    });

    const unsubscribe = NetInfo.addEventListener(applyState);
    void NetInfo.fetch().then(applyState);
    return () => {
      clearShowTimer();
      sub.remove();
      unsubscribe();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.band} accessibilityRole="alert" accessibilityLabel="No internet connection">
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 4, paddingBottom: spacing.sm },
        ]}
      >
        <Text style={styles.text}>No Internet Connection</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    backgroundColor: colors.danger,
  },
  content: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
