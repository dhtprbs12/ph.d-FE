/**
 * Real-time cylindrical can ingredient scanner.
 *
 * Pipeline per capture:
 *   1) `mergePendingFragmentWithOcr` — prepend cached <3-char alphabetic tail
 *      from the previous frame so shards like "su" + "gar" stitch before parse.
 *   2) `absorbIncompleteParenBuffer` — carry unclosed `(` / `[` across frames
 *      until delimiters balance, then split on outer commas.
 *   3) `advancedMergeEngine` — boundary merge, sanitize, Levenshtein fuzzy dedupe,
 *      prefix–superset rules.
 *   4) `extractTrailingAlphaPending` — keep a trailing <3-letter pure-alpha
 *      token out of **visible** badges (cached for the next frame only).
 *
 * Timer: `setInterval` drives capture **slots** every 1500ms; a serialized
 * promise chain ensures `takePictureAsync` + Vision calls never overlap, so
 * slow networks do not drop scheduled frames.
 *
 * Camera: `expo-camera` `CameraView` (PHD native stack). OCR goes to
 * **Railway PHD API** `POST /vision/document-text` (see `postVisionDocumentText`
 * in `api.ts`); `GOOGLE_CLOUD_VISION_API_KEY` lives only on the server.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { postVisionDocumentText } from '../services/api';
import {
  absorbIncompleteParenBuffer,
  advancedMergeEngine,
  extractTrailingAlphaPending,
  mergePendingFragmentWithOcr,
} from '../utils/IngredientParser';
import { colors, radius, spacing, typography } from '../theme';

const CAPTURE_INTERVAL_MS = 1500;
const MAX_AUTO_CAPTURES = 3;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [badges, setBadges] = useState([]);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const captureCountRef = useRef(0);
  const scanningActiveRef = useRef(false);
  const captureChainRef = useRef(Promise.resolve());

  const confirmedRef = useRef([]);
  const parenCarryRef = useRef('');
  const pendingAlphaRef = useRef('');

  const clearIntervalSafe = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopScan = useCallback(() => {
    scanningActiveRef.current = false;
    setScanning(false);
    clearIntervalSafe();
  }, [clearIntervalSafe]);

  const resetAll = useCallback(() => {
    stopScan();
    captureCountRef.current = 0;
    captureChainRef.current = Promise.resolve();
    confirmedRef.current = [];
    parenCarryRef.current = '';
    pendingAlphaRef.current = '';
    setBadges([]);
    setError(null);
    setLoading(false);
  }, [stopScan]);

  const processVisionText = useCallback(rawText => {
    const glued = mergePendingFragmentWithOcr(
      pendingAlphaRef.current,
      rawText,
    );
    if (glued.consumedPending) pendingAlphaRef.current = '';

    const { tokens, carryOver } = absorbIncompleteParenBuffer(
      parenCarryRef.current,
      glued.text,
    );
    parenCarryRef.current = carryOver;

    const merged = advancedMergeEngine(confirmedRef.current, tokens);
    const { display, pendingAlpha } = extractTrailingAlphaPending(merged);
    confirmedRef.current = display;
    pendingAlphaRef.current = pendingAlpha;
    setBadges(display);
  }, []);

  const runSingleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: false,
      });
      const b64 = photo?.base64;
      if (!b64) throw new Error('Camera did not return base64 image data');
      const text = await postVisionDocumentText(b64);
      processVisionText(text);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        String(e);
      setError(
        typeof msg === 'string'
          ? msg
          : 'Scan failed — add POST /vision/document-text on Railway (see api.ts).',
      );
    } finally {
      setLoading(false);
    }
  }, [processVisionText]);

  const enqueueCapture = useCallback(() => {
    captureChainRef.current = captureChainRef.current.then(async () => {
      if (!scanningActiveRef.current) return;
      if (captureCountRef.current >= MAX_AUTO_CAPTURES) return;
      await runSingleCapture();
      captureCountRef.current += 1;
      if (captureCountRef.current >= MAX_AUTO_CAPTURES) {
        scanningActiveRef.current = false;
        clearIntervalSafe();
        setScanning(false);
      }
    });
  }, [runSingleCapture, clearIntervalSafe]);

  const startScan = useCallback(() => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setError(null);
    scanningActiveRef.current = true;
    setScanning(true);
    captureCountRef.current = 0;
    clearIntervalSafe();
    captureChainRef.current = Promise.resolve();

    enqueueCapture();
    intervalRef.current = setInterval(() => {
      enqueueCapture();
    }, CAPTURE_INTERVAL_MS);
  }, [permission?.granted, requestPermission, clearIntervalSafe, enqueueCapture]);

  useEffect(() => () => {
    scanningActiveRef.current = false;
    clearIntervalSafe();
  }, [clearIntervalSafe]);

  const granted = permission?.granted === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.cameraBlock}>
        {!granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>Camera access</Text>
            <Text style={styles.permissionBody}>
              Allow the camera to scan ingredient text on cans.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => requestPermission()}>
              <Text style={styles.primaryBtnText}>Grant permission</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        )}

        {granted && (
          <View pointerEvents="none" style={styles.guideOverlay}>
            <View style={styles.guideBar} />
          </View>
        )}
      </View>

      <View style={styles.chipsSection}>
        <Text style={styles.sectionLabel}>Ingredients</Text>
        <ScrollView
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsWrap}
          keyboardShouldPersistTaps="handled"
        >
          {badges.length === 0 && !loading ? (
            <Text style={styles.empty}>No ingredients yet — start a scan.</Text>
          ) : (
            badges.map((label, idx) => (
              <View key={`${label}-${idx}`} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={2}>
                  {label}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#7f1d1d" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        ) : (
          <View style={styles.spinnerPlaceholder} />
        )}
        <Pressable
          style={[styles.controlBtn, styles.startBtn, scanning && styles.btnDisabled]}
          onPress={startScan}
          disabled={scanning || loading}
        >
          <Text style={styles.controlBtnText}>Start scan</Text>
        </Pressable>
        <Pressable
          style={[styles.controlBtn, styles.stopBtn, !scanning && styles.btnDisabled]}
          onPress={stopScan}
          disabled={!scanning}
        >
          <Text style={styles.controlBtnText}>Stop scan</Text>
        </Pressable>
        <Pressable style={[styles.controlBtn, styles.resetBtn]} onPress={resetAll}>
          <Text style={[styles.controlBtnText, styles.resetBtnText]}>Reset</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const GUIDE_WIDTH = '78%';
const GUIDE_HEIGHT = 56;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraBlock: {
    flex: 1,
    minHeight: 280,
    borderRadius: radius.medium,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
    backgroundColor: '#0d1b14',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  permissionTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  permissionBody: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBar: {
    width: GUIDE_WIDTH,
    height: GUIDE_HEIGHT,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.small,
    backgroundColor: 'transparent',
  },
  chipsSection: {
    maxHeight: 160,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipText: {
    ...typography.caption,
    color: colors.textPrimary,
    maxWidth: 140,
  },
  empty: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#fee2e2',
    borderRadius: radius.small,
  },
  errorText: {
    flex: 1,
    color: '#7f1d1d',
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  spinner: { marginRight: spacing.xs },
  spinnerPlaceholder: { width: 28, height: 28 },
  controlBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    minWidth: 96,
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: colors.primary,
  },
  stopBtn: {
    backgroundColor: '#b45309',
  },
  resetBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  controlBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  resetBtnText: {
    color: colors.textPrimary,
  },
});
