import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import api from '../services/api';
import { toTitleCase } from '../utils/helpers';

export interface FoodSelection {
  productId?: string;
  productName: string;
  brand?: string;
  imageUrl?: string | null;
}

interface Props {
  petType?: string;
  onSelect: (food: FoodSelection) => void;
  onScanBarcode?: () => void;
  placeholder?: string;
  initialValue?: string;
}

export default function FoodSearchInput({ petType = 'dog', onSelect, onScanBarcode, placeholder, initialValue }: Props) {
  const [text, setText] = useState(initialValue || '');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback((val: string) => {
    setText(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/products/search', {
          params: { q: val.trim(), petType, limit: 5 },
        });
        setResults(data.products || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [petType]);

  const handleSelectProduct = (p: any) => {
    setText(p.name);
    setResults([]);
    onSelect({ productId: p.id, productName: p.name, brand: p.brand || undefined, imageUrl: p.imageUrl || p.image_url || null });
  };

  const handleFreeText = () => {
    if (!text.trim()) return;
    setResults([]);
    onSelect({ productName: text.trim() });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleChange}
        placeholder={placeholder || 'Search food name...'}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="words"
      />

      {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 4 }} />}

      {results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((p: any) => (
            <Pressable key={p.id} onPress={() => handleSelectProduct(p)} style={styles.dropdownItem}>
              <Ionicons name="nutrition-outline" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{toTitleCase(p.name)}</Text>
                {p.brand && <Text style={styles.itemBrand}>{toTitleCase(p.brand)}</Text>}
              </View>
              {p.base_dog_score && (
                <Text style={styles.itemScore}>{p.base_dog_score}pt</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {text.trim().length > 0 && (
          <Pressable onPress={handleFreeText} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.freeTextLabel}>Save "{text.trim()}" as-is</Text>
          </Pressable>
        )}
        {onScanBarcode && (
          <Pressable onPress={onScanBarcode} style={styles.actionBtn}>
            <Ionicons name="barcode-outline" size={14} color={colors.primary} />
            <Text style={styles.scanLabel}>Scan barcode</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 12 : spacing.xs,
    fontSize: 14,
    backgroundColor: colors.card,
    color: colors.textPrimary,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  itemName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  itemBrand: { fontSize: 11, color: colors.textSecondary },
  itemScore: { fontSize: 12, fontWeight: '700', color: colors.primary },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  freeTextLabel: { fontSize: 12, color: colors.textSecondary },
  scanLabel: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
