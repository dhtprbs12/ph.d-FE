import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../../theme';

/** Hard cap passed to recordAsync; user can stop earlier. */
const MAX_RECORD_SEC = 10;

type Phase = 'permission' | 'ready' | 'recording' | 'finalizing';

interface Props {
  visible: boolean;
  mode: 'round' | 'pouch';
  onCancel: () => void;
  /** Local file URI of the recorded video (mp4/mov). */
  onComplete: (videoUri: string) => void;
}

export function SpinVideoCaptureView({ visible, mode, onCancel, onComplete }: Props) {
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [phase, setPhase] = useState<Phase>('ready');
  const cameraRef = useRef<CameraView | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    const camOk = camPerm?.granted;
    const micOk = micPerm?.granted;
    if (!camOk || !micOk) setPhase('permission');
    else setPhase('ready');
  }, [camPerm?.granted, micPerm?.granted]);

  useEffect(() => {
    if (visible) reset();
    else cancelledRef.current = true;
  }, [visible, reset]);

  useEffect(() => {
    if (!visible) return;
    if (!camPerm || !micPerm) return;
    if (camPerm.granted && micPerm.granted && phase === 'permission') {
      setPhase('ready');
    }
  }, [visible, phase, camPerm, micPerm]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    try {
      cameraRef.current?.stopRecording();
    } catch {
      /* noop */
    }
    onCancel();
  }, [onCancel]);

  const stopRecordingSafe = useCallback(() => {
    try {
      cameraRef.current?.stopRecording();
    } catch {
      /* noop */
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || cancelledRef.current) return;
    if (!camPerm?.granted || !micPerm?.granted) {
      setPhase('permission');
      return;
    }
    setPhase('recording');
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORD_SEC,
      });
      if (cancelledRef.current) return;
      const uri = result?.uri;
      if (!uri) {
        handleCancel();
        return;
      }
      setPhase('finalizing');
      setTimeout(() => {
        if (!cancelledRef.current) onComplete(uri);
      }, 200);
    } catch (e) {
      console.warn('[SpinVideo] recordAsync failed:', e);
      if (!cancelledRef.current) handleCancel();
    }
  }, [camPerm?.granted, micPerm?.granted, handleCancel, onComplete]);

  const subjectLabel = mode === 'round' ? 'can' : 'pouch';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <View style={s.root}>
        {camPerm?.granted && micPerm?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="video"
            mute
            videoQuality="1080p"
          />
        ) : null}

        <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
          <View style={s.topBar}>
            <Pressable onPress={handleCancel} hitSlop={16} style={s.iconBtn}>
              <Ionicons name="close" size={28} color={colors.white} />
            </Pressable>
          </View>

          {phase === 'permission' && (
            <View style={s.card}>
              <Text style={s.title}>Camera & microphone</Text>
              <Text style={s.body}>
                We need both to record a short spin video of the {subjectLabel}. Audio is not saved
                (muted).
              </Text>
              <Pressable
                style={s.primaryBtn}
                onPress={async () => {
                  const c = await requestCam();
                  if (!c.granted) return;
                  const m = await requestMic();
                  if (m.granted) setPhase('ready');
                }}
              >
                <Text style={s.primaryBtnText}>Allow camera & mic</Text>
              </Pressable>
            </View>
          )}

          {phase === 'ready' && (
            <View style={s.bottomArea}>
              <View style={s.hintCard}>
                <Text style={s.hintTitle}>Slow spin</Text>
                <Text style={s.hintBody}>
                  Hold the {subjectLabel} steady. Tap record, then rotate the label smoothly for one
                  full turn (about 5–8 seconds). Tap Stop when done — you do not have to use the full
                  {MAX_RECORD_SEC}s.
                </Text>
              </View>
              <Pressable style={s.primaryBtnWide} onPress={startRecording}>
                <Ionicons name="videocam" size={20} color={colors.white} />
                <Text style={s.primaryBtnText}>Start recording</Text>
              </Pressable>
            </View>
          )}

          {phase === 'recording' && (
            <View style={s.bottomArea}>
              <View style={s.recordingBadge}>
                <View style={s.recDot} />
                <Text style={s.recText}>Recording</Text>
              </View>
              <Pressable style={s.stopBtn} onPress={stopRecordingSafe}>
                <Text style={s.stopBtnText}>Stop & upload</Text>
              </Pressable>
            </View>
          )}

          {phase === 'finalizing' && (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={s.finalizingText}>Preparing video…</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.large,
    ...shadows.card,
  },
  title: { ...typography.titleLarge, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.labelLarge, color: colors.white },
  bottomArea: { padding: spacing.lg, paddingBottom: spacing.xl },
  hintCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  hintTitle: { ...typography.titleLarge, color: colors.white, marginBottom: spacing.sm },
  hintBody: { ...typography.bodyMedium, color: 'rgba(255,255,255,0.92)' },
  primaryBtnWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(180,40,40,0.9)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
  },
  recText: { ...typography.labelLarge, color: colors.white },
  stopBtn: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: radius.medium,
    alignItems: 'center',
  },
  stopBtnText: { ...typography.labelLarge, color: colors.textPrimary },
  centered: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  finalizingText: { ...typography.bodyMedium, color: colors.white, marginTop: spacing.md },
});
