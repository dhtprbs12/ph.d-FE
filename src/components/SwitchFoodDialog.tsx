import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { toTitleCase } from '../utils/helpers';

export function SwitchFoodDialog({
  visible,
  currentName,
  dayCount,
  newName,
  busy = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  currentName: string;
  dayCount?: number | null;
  newName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, padding: 16, paddingTop: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>Switch food?</Text>
          <FoodRow name={currentName} meta={dayCount != null ? `Day ${dayCount}` : ''} badge="Current" filled={false} />
          <View style={{ height: 8 }} />
          <FoodRow name={newName} meta="New food" badge="New" filled />
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginTop: 12, marginBottom: 16 }}>
            This ends the current food and starts a new period. Past logs stay on the previous food.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onCancel} style={{ flex: 1, minHeight: 44, borderRadius: radius.medium, backgroundColor: colors.lightGray, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Cancel</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={onConfirm} style={{ flex: 1, minHeight: 44, borderRadius: radius.medium, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.white }}>Switch</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FoodRow({ name, meta, badge, filled }: { name: string; meta: string; badge: string; filled: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lightGray }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>{toTitleCase(name)}</Text>
        {meta ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{meta}</Text> : null}
      </View>
      <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: filled ? colors.primary : colors.white, borderWidth: 1, borderColor: colors.primary }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: filled ? colors.white : colors.primary }}>{badge}</Text>
      </View>
    </View>
  );
}
