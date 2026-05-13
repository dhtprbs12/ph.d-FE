import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import type { CaptureMode } from './CaptureModeToggle';

/**
 * Bottom-sheet override for the back-label capture mode.
 *
 * The mode is normally chosen automatically from the front-label scan
 * (see `packageShape` in ScanFrontResponse). This sheet is only opened
 * via the small "Detected: <Mode> ▼" trigger, so most users never see
 * it — but it's available as an escape hatch when auto-detect is wrong
 * or the user knows their package better than the model does.
 */
const MODES: {
  id: CaptureMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
}[] = [
  { id: 'flat',  icon: 'square-outline',  label: 'Flat',       hint: 'Box, bag, or pouch with a flat ingredient panel' },
  { id: 'round', icon: 'ellipse-outline', label: 'Round can',  hint: 'Cylindrical can — captures 6 photos as you rotate it' },
  { id: 'pouch', icon: 'leaf-outline',    label: 'Curved pouch', hint: 'Soft pouch with curved face — captures 6 photos' },
];

interface Props {
  visible: boolean;
  selected: CaptureMode;
  onSelect: (mode: CaptureMode) => void;
  onClose: () => void;
}

export function CaptureModeSheet({ visible, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/*
          Inner Pressable swallows taps so tapping the sheet body
          doesn't dismiss it. Cleaner than wiring up gesture handlers.
        */}
        <Pressable style={s.sheet} onPress={() => { /* swallow */ }}>
          <View style={s.handle} />
          <Text style={s.title}>How is the ingredient label shaped?</Text>
          <Text style={s.subtitle}>
            We chose a default based on your photo. Pick a different one if it's wrong.
          </Text>

          <View style={s.options}>
            {MODES.map(mode => {
              const active = mode.id === selected;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    onSelect(mode.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    s.option,
                    active && s.optionActive,
                    pressed && !active && s.optionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[s.iconBubble, active && s.iconBubbleActive]}>
                    <Ionicons
                      name={mode.icon}
                      size={22}
                      color={active ? colors.white : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionLabel, active && s.optionLabelActive]}>
                      {mode.label}
                    </Text>
                    <Text style={s.optionHint}>{mode.hint}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <View style={s.checkPlaceholder} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(92,107,102,0.3)',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  options: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
  },
  optionActive: {
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.4)',
  },
  optionPressed: {
    opacity: 0.85,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  iconBubbleActive: {
    backgroundColor: colors.primary,
  },
  optionLabel: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  optionLabelActive: {
    color: colors.primary,
  },
  optionHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkPlaceholder: {
    width: 22,
    height: 22,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cancelText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
});
