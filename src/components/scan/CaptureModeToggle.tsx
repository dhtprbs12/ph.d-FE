import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';

/**
 * Capture mode for the back-label step.
 *
 *   "flat"  – flat box, sachet, or bag where the whole ingredient panel
 *             is visible in one frame. Single-shot OCR.
 *   "round" – cylindrical can / bottle. The label wraps around, so we
 *             burst-capture several frames as the user rotates the can.
 *   "pouch" – soft pouch / stand-up bag. Same multi-frame flow as round
 *             because the label often curves and creates glare.
 */
export type CaptureMode = 'flat' | 'round' | 'pouch';

interface ModeOption {
  id: CaptureMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
}

const MODES: ModeOption[] = [
  { id: 'flat',  icon: 'square-outline',     label: 'Flat',  hint: 'Box, bag, or pouch with a flat label' },
  { id: 'round', icon: 'ellipse-outline',    label: 'Can',   hint: 'Cylindrical cans — we capture 10 photos' },
  { id: 'pouch', icon: 'leaf-outline',       label: 'Pouch', hint: 'Curved soft pouches — we capture 10 photos' },
];

interface Props {
  value: CaptureMode;
  onChange: (mode: CaptureMode) => void;
}

/**
 * Three-pill segmented selector for the back-label capture mode.
 * The hint underneath updates based on the selection so the user
 * understands WHY the next screen will look different (single shutter
 * vs. burst capture).
 */
export function CaptureModeToggle({ value, onChange }: Props) {
  const activeHint = MODES.find(m => m.id === value)?.hint ?? '';

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {MODES.map(mode => {
          const active = mode.id === value;
          return (
            <Pressable
              key={mode.id}
              onPress={() => onChange(mode.id)}
              style={({ pressed }) => [
                s.chip,
                active && s.chipActive,
                pressed && !active && s.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${mode.label} capture mode. ${mode.hint}`}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={mode.icon}
                size={20}
                color={active ? colors.white : colors.primary}
              />
              <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint} numberOfLines={2}>{activeHint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: radius.large,
    padding: 4,
    gap: 4,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.medium,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipPressed: {
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  chipLabel: {
    ...typography.labelLarge,
    color: colors.primary,
  },
  chipLabelActive: {
    color: colors.white,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
});
