import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { colors, radius, shadows, spacing, typography } from '../../theme';

/**
 * Recovery modal shown when Gemini's multi-image OCR returns LOW confidence
 * (< 0.5). We deliberately do NOT pre-show the (probably wrong) ingredient
 * list — that would erode trust. Instead we tell the user where the gap is
 * and recommend re-scanning.
 *
 * "Show what we got" is available as a secondary action so the user can
 * still bail out into the confirmation step if they really want to.
 */
interface Props {
  visible: boolean;
  missingSection: 'start' | 'middle' | 'end' | null;
  notes?: string;
  capturedCount?: number;
  onRescan: () => void;
  onShowAnyway: () => void;
  onCancel: () => void;
}

const SECTION_COPY: Record<NonNullable<Props['missingSection']>, { title: string; hint: string }> = {
  start: {
    title: 'We missed the top of the list',
    hint: 'The ingredients list usually starts with "Ingredients:" — that part wasn\'t captured.',
  },
  middle: {
    title: 'There\'s a gap in the middle',
    hint: 'A few ingredients between the top and bottom of the list were skipped.',
  },
  end: {
    title: 'The bottom of the list is cut off',
    hint: 'The ingredient list usually ends with vitamins / preservatives — that part wasn\'t captured.',
  },
};

const FALLBACK_COPY = {
  title: 'We couldn\'t read the label clearly',
  hint: 'Glare, blur, or low light made the ingredients hard to extract.',
};

export function RecaptureModal({
  visible,
  missingSection,
  notes,
  capturedCount,
  onRescan,
  onShowAnyway,
  onCancel,
}: Props) {
  const copy = missingSection ? SECTION_COPY[missingSection] : FALLBACK_COPY;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.iconRow}>
            <View style={s.iconBadge}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.warning} />
            </View>
            <Pressable hitSlop={12} onPress={onCancel} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.hint}>{copy.hint}</Text>

          <View style={s.illusWrap}>
            <CanIllustration highlight={missingSection ?? 'middle'} />
          </View>

          {/* Subtle technical detail. Hidden when notes is empty so we
              don't show "" ghost rows. */}
          {notes ? <Text style={s.notes}>AI memo: {notes}</Text> : null}
          {typeof capturedCount === 'number' ? (
            <Text style={s.notes}>{capturedCount} photos captured this round</Text>
          ) : null}

          <View style={s.actions}>
            <Pressable style={s.primaryBtn} onPress={onRescan}>
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={s.primaryBtnText}>Re-scan (recommended)</Text>
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={onShowAnyway}>
              <Text style={s.secondaryBtnText}>Show what we got anyway</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Tiny SVG of a stylized food can. The "missing" band is highlighted
 * orange so the user can see at a glance which part of the wrap they
 * should aim for on the second try.
 */
function CanIllustration({ highlight }: { highlight: 'start' | 'middle' | 'end' }) {
  const W = 140;
  const H = 160;
  const bodyX = 24;
  const bodyY = 18;
  const bodyW = W - bodyX * 2;
  const bodyH = H - bodyY * 2;

  // Horizontal band coordinates inside the can body.
  const bands = {
    start:  { y: bodyY + 10,            h: 22 },
    middle: { y: bodyY + bodyH / 2 - 11, h: 22 },
    end:    { y: bodyY + bodyH - 32,    h: 22 },
  };

  const HIGHLIGHT_COLOR = colors.warning;
  const NEUTRAL_COLOR = 'rgba(45,106,79,0.18)';

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Can body */}
      <Rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={10}
        ry={10}
        fill={'rgba(45,106,79,0.06)'}
        stroke={'rgba(45,106,79,0.4)'}
        strokeWidth={1.5}
      />
      {/* Lid ellipses (top & bottom) */}
      <G>
        <Circle cx={W / 2} cy={bodyY} r={bodyW / 2} fill={'rgba(45,106,79,0.06)'} stroke={'rgba(45,106,79,0.4)'} strokeWidth={1.5} transform={`scale(1, 0.22) translate(0, ${(bodyY * (1 / 0.22 - 1))})`} />
      </G>
      {/* Ingredient bands */}
      {(['start', 'middle', 'end'] as const).map(key => (
        <Rect
          key={key}
          x={bodyX + 6}
          y={bands[key].y}
          width={bodyW - 12}
          height={bands[key].h}
          rx={3}
          ry={3}
          fill={key === highlight ? HIGHLIGHT_COLOR : NEUTRAL_COLOR}
          opacity={key === highlight ? 0.85 : 1}
        />
      ))}
      {/* Subtle text-line hints inside the highlighted band */}
      {([0, 1, 2] as const).map(i => (
        <Line
          key={i}
          x1={bodyX + 12}
          y1={bands[highlight].y + 6 + i * 5}
          x2={bodyX + bodyW - 12}
          y2={bands[highlight].y + 6 + i * 5}
          stroke={'rgba(255,255,255,0.7)'}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,162,97,0.15)',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  hint: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  illusWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  notes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.large,
    ...shadows.button(colors.primary),
  },
  primaryBtnText: {
    ...typography.titleMedium,
    color: colors.white,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: radius.medium,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
});
