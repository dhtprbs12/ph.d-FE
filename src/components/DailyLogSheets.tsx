import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import checkinService, { AppetiteValue, ItchValue, MealSlot, VomitValue } from '../services/checkinService';
import { phoneYmd } from '../utils/foodTime';

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
  { score: 1, label: '1 Very Bad' },
  { score: 2, label: '2 Bad' },
  { score: 3, label: '3 Normal' },
  { score: 4, label: '4 Good' },
  { score: 5, label: '5 Great' },
];

const ITCH: { id: ItchValue; label: string }[] = [
  { id: 'scratching', label: 'Scratching' },
  { id: 'licking', label: 'Licking' },
  { id: 'none', label: 'None' },
];

const VOMIT: { id: VomitValue; label: string }[] = [
  { id: 'food', label: 'Food Vomit' },
  { id: 'yellow', label: 'Yellow vomit' },
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

  const reset = () => {
    setMealSlot(null);
    setAppetite(null);
    setStool(null);
    setItch(null);
    setVomit(null);
    setNote('');
    setError('');
  };

  const close = () => {
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
    <Modal visible={visible != null} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.title}>{visible === 'meal' ? 'Log a Meal' : 'Log Pet Health'}</Text>
        {visible === 'meal' ? (
          <>
            <ChipRow options={MEAL_SLOTS} selected={mealSlot} onSelect={id => setMealSlot(prev => prev === id ? null : id)} />
            <ChipRow options={APPETITES} selected={appetite} onSelect={setAppetite} />
          </>
        ) : (
          <>
            <ChipRow options={STOOL.map(item => ({ id: item.score, label: item.label }))} selected={stool} onSelect={id => setStool(prev => prev === id ? null : id)} />
            <ChipRow options={ITCH} selected={itch} onSelect={setItch} />
            <ChipRow options={VOMIT} selected={vomit} onSelect={setVomit} />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Quick note"
              placeholderTextColor={colors.textSecondary}
              style={styles.note}
              maxLength={500}
            />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

function ChipRow<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
}) {
  return (
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
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.titleLarge, color: colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.labelMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.white },
  note: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: radius.medium,
    padding: spacing.sm,
    color: colors.textPrimary,
    ...typography.bodyMedium,
  },
  error: { ...typography.labelMedium, color: colors.danger },
  save: {
    backgroundColor: colors.primary,
    borderRadius: radius.medium,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  saveText: { ...typography.labelLarge, color: colors.white },
});
