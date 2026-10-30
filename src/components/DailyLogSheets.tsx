import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../theme';
import checkinService, { AppetiteValue, ItchValue, MealSlot, VomitValue } from '../services/checkinService';
import { phoneYmd } from '../utils/foodTime';
import { SheetHost } from './sheetHost';

type Sheet = 'meal' | 'health' | null;

const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'evening', label: 'Evening' },
  { id: 'snack', label: 'Snack' },
];

const APPETITES: { id: AppetiteValue; label: string }[] = [
  { id: 'high', label: '😋 Great' },
  { id: 'normal', label: '😐 Normal' },
  { id: 'low', label: '😮‍💨 Picky' },
];

const STOOL = [
  { score: 1, label: 'Very Bad' },
  { score: 2, label: 'Bad' },
  { score: 3, label: 'Normal' },
  { score: 4, label: 'Good' },
  { score: 5, label: 'Great' },
];

const ITCH: { id: ItchValue; label: string }[] = [
  { id: 'scratching', label: 'Scratching' },
  { id: 'licking', label: 'Licking' },
  { id: 'none', label: 'None' },
];

const VOMIT: { id: VomitValue; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'none', label: 'None' },
];

export default function DailyLogSheets({
  petId,
  visible,
  onClose,
  onSaved,
}: {
  petId: string;
  visible: Sheet;
  onClose: () => void;
  onSaved: (tokensAwarded: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [appetite, setAppetite] = useState<AppetiteValue | null>(null);
  const [stool, setStool] = useState<number | null>(null);
  const [itch, setItch] = useState<ItchValue | null>(null);
  const [vomit, setVomit] = useState<VomitValue | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardPad(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const reset = () => {
    setMealSlot(null);
    setAppetite(null);
    setStool(null);
    setItch(null);
    setVomit(null);
    setNote('');
    setError('');
  };

  const closeNow = () => {
    if (saving) return;
    reset();
    onClose();
  };
  const save = async () => {
    if (!visible || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await checkinService.saveLog(petId, visible === 'meal'
        ? { logType: 'meal', localDate: phoneYmd(), mealSlot, appetite }
        : {
          logType: 'health',
          localDate: phoneYmd(),
          stoolScore: stool,
          itching: itch,
          vomiting: vomit,
          notes: note.trim() || null,
        });
      reset();
      onSaved(result.tokensAwarded);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not save this log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetHost visible={visible != null} onClose={closeNow}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dim} onPress={closeNow} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md + (Platform.OS === 'android' ? keyboardPad : 0), maxHeight: '85%' }]}>
          <Text style={styles.title}>{visible === 'meal' ? 'Log a Meal' : 'Log Pet Health'}</Text>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {visible === 'meal' ? (
            <>
              <ChipRow label="When" options={MEAL_SLOTS} selected={mealSlot} onSelect={id => setMealSlot(prev => prev === id ? null : id)} />
              <ChipRow label="Appetite" options={APPETITES} selected={appetite} onSelect={setAppetite} />
            </>
          ) : (
            <>
              <ChipRow label="Stool" options={STOOL.map(item => ({ id: item.score, label: item.label }))} selected={stool} onSelect={id => setStool(prev => prev === id ? null : id)} />
              <ChipRow label="Itching" options={ITCH} selected={itch} onSelect={setItch} />
              <ChipRow label="Vomit" options={VOMIT} selected={vomit} onSelect={setVomit} />
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Note</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything else?"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.note}
                  maxLength={500}
                />
              </View>
            </>
          )}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SheetHost>
  );
}

function ChipRow<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map(option => {
          const on = option.id === selected;
          return (
            <Pressable key={String(option.id)} onPress={() => onSelect(option.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  title: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  group: {
    gap: spacing.xs,
  },
  groupLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xxs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.textPrimary,
  },
  chipTextOn: {
    color: colors.white,
  },
  note: {
    backgroundColor: colors.lightGray,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    color: colors.textPrimary,
    ...typography.bodyMedium,
  },
  error: {
    ...typography.labelMedium,
    color: colors.danger,
  },
  save: {
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.xs,
  },
  saveText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '700',
  },
});
