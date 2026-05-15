import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../../theme';

/**
 * Burst-capture overlay for cylindrical cans / curved pouches.
 *
 * UX:
 *   1. Permission gate. Asks camera permission if not granted.
 *   2. "Get ready" — instructions + big start button. User aligns the
 *      label, sees the rotation hint, presses "Start Capture".
 *   3. Burst — auto-captures TOTAL_FRAMES photos at FRAME_INTERVAL_MS
 *      apart while a progress bar fills. Floating label tells the user
 *      "keep rotating slowly".
 *   4. Done — uploads automatically (parent handles the network call via
 *      onComplete(uris[])).
 *
 * The user can cancel anytime; partial captures are discarded.
 */
const TOTAL_FRAMES = 30;
/** Gap between shots — keep sequential `takePictureAsync` from overlapping on slower devices. */
const FRAME_INTERVAL_MS = 420;
/** Progress bar duration ≈ (frames−1)×interval + small tail so the bar matches the burst. */
const BAR_FILL_MS = (TOTAL_FRAMES - 1) * FRAME_INTERVAL_MS + 900;
const COUNTDOWN_SECONDS = Math.max(5, Math.ceil(BAR_FILL_MS / 1000));

type Phase = 'permission' | 'ready' | 'capturing' | 'finalizing';

interface Props {
  visible: boolean;
  mode: 'round' | 'pouch';
  onCancel: () => void;
  onComplete: (uris: string[]) => void;
}

export function BurstCaptureView({ visible, mode, onCancel, onComplete }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('ready');
  const cameraRef = useRef<CameraView | null>(null);
  const capturedUrisRef = useRef<string[]>([]);
  // Used to bail out of in-flight timers / takePictureAsync() promises if
  // the modal is dismissed mid-burst.
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    capturedUrisRef.current = [];
    setPhase(permission?.granted ? 'ready' : 'permission');
  }, [permission?.granted]);

  // Reset when the modal opens / closes so reopening starts clean.
  useEffect(() => {
    if (visible) reset();
    else cancelledRef.current = true;
  }, [visible, reset]);

  // Auto-request permission when entering the modal, so the user usually
  // lands on the "ready" screen instead of a separate permission screen.
  useEffect(() => {
    if (!visible) return;
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain && phase === 'permission') {
      requestPermission().then(res => {
        if (res.granted) setPhase('ready');
      });
    } else if (permission.granted && phase === 'permission') {
      setPhase('ready');
    } else if (!permission.granted && !permission.canAskAgain && phase !== 'permission') {
      setPhase('permission');
    }
  }, [visible, permission, phase, requestPermission]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        // Burst frames feed multi-frame OCR — small text on the
        // wrap-around ingredient panel needs every pixel of detail
        // we can keep. Quality 1.0 (vs 0.8) noticeably reduces
        // missed-ingredient rate at the cost of slightly larger
        // files; the upload pipeline downscales to a fixed bound
        // anyway, so end-to-end size barely changes.
        quality: 1.0,
        skipProcessing: false,
        exif: false,
      });
      return pic?.uri ?? null;
    } catch (e) {
      console.warn('[BurstCapture] takePictureAsync failed:', e);
      return null;
    }
  }, []);

  // The capture loop is a recursive setTimeout chain rather than
  // setInterval so we never overlap two takePictureAsync calls (which
  // some Android devices reject), and so cancellation is immediate.
  const runBurst = useCallback(async () => {
    setPhase('capturing');
    capturedUrisRef.current = [];

    for (let i = 0; i < TOTAL_FRAMES; i += 1) {
      if (cancelledRef.current) return;

      const uri = await captureOne();
      if (cancelledRef.current) return;

      if (uri) {
        capturedUrisRef.current.push(uri);
      }

      // Don't wait after the last frame.
      if (i < TOTAL_FRAMES - 1) {
        await new Promise<void>(r => setTimeout(r, FRAME_INTERVAL_MS));
        if (cancelledRef.current) return;
      }
    }

    setPhase('finalizing');
    // Tiny delay so the final progress fill animation isn't jarring.
    setTimeout(() => {
      if (cancelledRef.current) return;
      const uris = capturedUrisRef.current;
      if (uris.length === 0) {
        // All frames failed — bail out gracefully.
        handleCancel();
      } else {
        onComplete(uris);
      }
    }, 300);
  }, [captureOne, handleCancel, onComplete]);

  // We deliberately skip the 3-2-1 countdown — it felt cumbersome in
  // testing, and the user is already lined up on the label when they
  // tap "Start Capture". Going straight into the burst keeps the flow
  // tight; the bar fills over BAR_FILL_MS while frames fire on a fixed interval.
  const startBurst = useCallback(() => {
    runBurst();
  }, [runBurst]);

  const subjectLabel = mode === 'round' ? 'can' : 'pouch';

  // Smooth progress bar (not tied to per-frame ticks). Starts when
  // 'capturing' begins; reset on cancel / completion.
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'capturing') {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: BAR_FILL_MS,
        useNativeDriver: false, // width % can't use the native driver
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [phase, progressAnim]);
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Big white countdown number (seconds remaining) in the centre of
  // the frame guide while capturing. Counts seconds remaining, NOT
  // photo index — the user shouldn't have to think about how the bar
  // is wired to the capture loop.
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  useEffect(() => {
    if (phase !== 'capturing') {
      setSecondsLeft(COUNTDOWN_SECONDS);
      return;
    }
    setSecondsLeft(COUNTDOWN_SECONDS);
    const tick = setInterval(() => {
      setSecondsLeft(prev => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [phase]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <View style={s.root}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : null}

        {/* Dim overlay so the white text is readable over busy backgrounds */}
        <View style={s.dim} pointerEvents="none" />

        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topBar}>
            <Pressable onPress={handleCancel} hitSlop={12} style={s.closeBtn}>
              <Ionicons name="close" size={26} color={colors.white} />
            </Pressable>
            <View style={s.modePill}>
              <Ionicons
                name={mode === 'round' ? 'ellipse-outline' : 'leaf-outline'}
                size={14}
                color={colors.white}
              />
              <Text style={s.modePillText}>
                {mode === 'round' ? 'Can' : 'Pouch'} mode
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {phase === 'permission' && (
            <PermissionPanel
              canAskAgain={permission?.canAskAgain ?? true}
              onRequest={async () => {
                const res = await requestPermission();
                if (res.granted) setPhase('ready');
              }}
            />
          )}

          {phase === 'ready' && permission?.granted && (
            <View style={s.centerBlock}>
              <View style={s.frameGuide} />
              <View style={s.bottomPanel}>
                <Text style={s.title}>Ready to scan ingredients?</Text>
                <Text style={s.subtitle}>
                  Aim at the ingredient list, then slowly rotate the {subjectLabel}{' '}
                  for ~{COUNTDOWN_SECONDS} seconds.
                </Text>
                <Pressable style={s.primaryBtn} onPress={startBurst}>
                  <Ionicons name="camera" size={18} color={colors.white} />
                  <Text style={s.primaryBtnText}>Start Capture</Text>
                </Pressable>
              </View>
            </View>
          )}

          {phase === 'capturing' && (
            <View style={s.centerBlock}>
              <View style={s.frameGuide}>
                {/* Big white countdown number sits inside the dashed
                    frame guide so the user keeps their eyes on the
                    target instead of darting to the bottom panel. */}
                <View style={s.countdownWrap} pointerEvents="none">
                  <Text style={s.countdownNum}>{secondsLeft}</Text>
                </View>
              </View>
              <View style={s.bottomPanel}>
                <View style={s.captureRow}>
                  <Ionicons name="sync-outline" size={20} color={colors.white} />
                  <Text style={s.captureHint}>
                    Keep rotating to show the full ingredient list…
                  </Text>
                </View>

                <View style={s.progressTrack}>
                  <Animated.View style={[s.progressFill, { width: progressWidth }]} />
                </View>
              </View>
            </View>
          )}

          {phase === 'finalizing' && (
            <View style={s.centerBlock}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={s.finalizingText}>Saving photos…</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function PermissionPanel({
  canAskAgain,
  onRequest,
}: {
  canAskAgain: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={s.centerBlock}>
      <View style={s.bottomPanel}>
        <Ionicons name="camera-outline" size={48} color={colors.white} />
        <Text style={s.title}>Camera access needed</Text>
        <Text style={s.subtitle}>
          {canAskAgain
            ? 'We use the camera to read the ingredient list on the back of the package.'
            : 'Open Settings → Privacy → Camera to allow camera access for PHD.'}
        </Text>
        {canAskAgain ? (
          <Pressable style={s.primaryBtn} onPress={onRequest}>
            <Text style={s.primaryBtnText}>Allow Camera</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modePillText: {
    ...typography.labelMedium,
    color: colors.white,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  frameGuide: {
    flex: 1,
    width: '78%',
    marginTop: spacing.lg,
    borderRadius: radius.large,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    fontSize: 120,
    lineHeight: 130,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    fontVariant: ['tabular-nums'],
  },
  bottomPanel: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.large,
    ...shadows.button(colors.primary),
  },
  primaryBtnText: {
    ...typography.titleMedium,
    color: colors.white,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captureHint: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  finalizingText: {
    ...typography.bodyLarge,
    color: colors.white,
    marginTop: spacing.md,
  },
});
