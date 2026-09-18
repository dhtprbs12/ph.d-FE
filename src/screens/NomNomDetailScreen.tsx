import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import type { HomeStackParamList } from '../navigation/types';
import checkinService, { CheckinEntry } from '../services/checkinService';
import notesService from '../services/notesService';
import { toTitleCase, buildThumbUrl, buildImageUrl } from '../utils/helpers';
import { useToast } from '../components/common/Toast';
import ZoomableImageModal from '../components/ZoomableImageModal';

type ScreenRoute = RouteProp<HomeStackParamList, 'NomNomDetail'>;

export default function NomNomDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ScreenRoute>();
  const { petId, date, petName } = route.params;
  const toast = useToast();

  const scrollRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<View>(null);
  const [checkin, setCheckin] = useState<CheckinEntry | null>(null);
  const [note, setNote] = useState('');
  const [originalNote, setOriginalNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const loadData = useCallback(async () => {
    try {
      const [cRes, nRes] = await Promise.allSettled([
        checkinService.getCheckins(petId, date, date),
        notesService.getNotes(petId, date, date),
      ]);

      if (cRes.status === 'fulfilled' && cRes.value.checkins.length > 0) {
        setCheckin(cRes.value.checkins[0]);
      }
      if (nRes.status === 'fulfilled' && nRes.value.length > 0) {
        setNote(nRes.value[0].note);
        setOriginalNote(nRes.value[0].note);
      }
    } catch (e) {
      console.warn('[NomNomDetail] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [petId, date]);

  useEffect(() => { loadData(); }, [loadData]);

  const hasChanges = note.trim() !== originalNote;

  const saveNote = useCallback(async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await notesService.upsertNote(petId, date, note.trim());
      setOriginalNote(note.trim());
      navigation.goBack();
    } catch (e) {
      console.warn('[NomNomDetail] saveNote error:', e);
      toast.show({ message: 'Failed to save note', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [petId, date, note, hasChanges, navigation]);

  const getStoolLabel = (score: number) => {
    switch (score) {
      case 1: return 'Very Bad';
      case 2: return 'Bad';
      case 3: return 'Normal';
      case 4: return 'Good';
      case 5: return 'Great';
      default: return `${score}`;
    }
  };

  const getStoolColor = (score: number) => {
    if (score >= 4) return colors.safe;
    if (score === 3) return colors.primaryLight;
    if (score === 2) return colors.caution;
    return colors.danger;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nom Nom Notes</Text>
          <Text style={styles.headerSubtitle}>{petName || ''}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
        ) : (
          <>
            {/* Check-in Section */}
            <View style={[styles.section, shadows.card]}>
              <Text style={styles.sectionTitle}>Daily Check-in</Text>
              {checkin ? (
                <View style={styles.checkinGrid}>
                  <View style={styles.checkinRow}>
                    {/* Stool */}
                    <View style={[styles.checkinCard, { backgroundColor: getStoolColor(checkin.stoolScore) + '12' }]}>
                      <Text style={styles.checkinEmoji}>💩</Text>
                      <Text style={styles.checkinCardLabel}>Stool</Text>
                      <Text style={[styles.checkinCardValue, { color: getStoolColor(checkin.stoolScore) }]}>
                        {checkin.stoolScore}/5
                      </Text>
                      <Text style={[styles.checkinCardSub, { color: getStoolColor(checkin.stoolScore) }]}>
                        {getStoolLabel(checkin.stoolScore)}
                      </Text>
                    </View>
                    {/* Appetite */}
                    <View style={[styles.checkinCard, { backgroundColor: colors.primary + '12' }]}>
                      <Text style={styles.checkinEmoji}>
                        {checkin.appetite === 'low' ? '😔' : checkin.appetite === 'high' ? '🤩' : '😋'}
                      </Text>
                      <Text style={styles.checkinCardLabel}>Appetite</Text>
                      <Text style={[styles.checkinCardValue, { color: colors.primary }]}>
                        {checkin.appetite.charAt(0).toUpperCase() + checkin.appetite.slice(1)}
                      </Text>
                    </View>
                  </View>
                  {/* Symptoms */}
                  <View style={[styles.checkinCard, styles.checkinCardWide, { backgroundColor: (!checkin.vomiting && !checkin.itching) ? colors.safe + '12' : colors.danger + '12' }]}>
                    <View style={styles.symptomHeader}>
                      <Text style={styles.checkinEmoji}>
                        {!checkin.vomiting && !checkin.itching ? '✨' : '⚠️'}
                      </Text>
                      <Text style={styles.checkinCardLabel}>Symptoms</Text>
                    </View>
                    <View style={styles.symptomRow}>
                      {checkin.vomiting && (
                        <View style={[styles.symptomTag, { backgroundColor: colors.danger + '20' }]}>
                          <Ionicons name="alert-circle" size={12} color={colors.danger} />
                          <Text style={[styles.symptomText, { color: colors.danger }]}>Vomiting</Text>
                        </View>
                      )}
                      {checkin.itching && (
                        <View style={[styles.symptomTag, { backgroundColor: colors.caution + '20' }]}>
                          <Ionicons name="alert-circle" size={12} color="#B8860B" />
                          <Text style={[styles.symptomText, { color: '#B8860B' }]}>Itching</Text>
                        </View>
                      )}
                      {!checkin.vomiting && !checkin.itching && (
                        <Text style={[styles.checkinCardValue, { color: colors.safe }]}>All clear!</Text>
                      )}
                    </View>
                  </View>
                  {/* Food */}
                  {checkin.foodName && (
                    <View style={[styles.checkinCard, styles.checkinCardWide, { backgroundColor: colors.accent + '12' }]}>
                      <View style={styles.symptomHeader}>
                        <Text style={styles.checkinEmoji}>🍽️</Text>
                        <Text style={styles.checkinCardLabel}>Food</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {checkin.foodImageUrl ? (
                          <Pressable onPress={() => {
                            const full = buildImageUrl(checkin.foodImageUrl);
                            if (full) setZoomImageUri(full);
                          }}>
                            <Image
                              source={{ uri: buildThumbUrl(checkin.foodImageUrl) ?? undefined }}
                              style={{ width: 44, height: 44, borderRadius: radius.small, backgroundColor: colors.lightGray }}
                            />
                          </Pressable>
                        ) : null}
                        <Text style={[styles.checkinCardValue, { flex: 1 }]}>{toTitleCase(checkin.foodName)}</Text>
                      </View>
                    </View>
                  )}
                  {/* Checkin Notes */}
                  {checkin.notes && (
                    <View style={[styles.checkinCard, styles.checkinCardWide, { backgroundColor: colors.lightGray }]}>
                      <View style={styles.symptomHeader}>
                        <Text style={styles.checkinEmoji}>📝</Text>
                        <Text style={styles.checkinCardLabel}>Check-in Notes</Text>
                      </View>
                      <Text style={styles.checkinNotes}>{checkin.notes}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="paw-outline" size={32} color={colors.textSecondary} style={{ opacity: 0.4 }} />
                  <Text style={styles.emptyText}>No check-in for this day</Text>
                </View>
              )}
            </View>

            {/* Notes Section */}
            <View ref={noteInputRef} style={[styles.section, shadows.card]}>
              <Text style={styles.sectionTitle}>Note</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Write about your pet's day, food changes, behavior..."
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                placeholderTextColor={colors.textSecondary + '80'}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />
              <View style={styles.noteFooter}>
                <Text style={styles.charCount}>{note.length}/1000</Text>
                <Pressable
                  style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
                  onPress={saveNote}
                  disabled={!hasChanges || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color={hasChanges ? colors.white : colors.textSecondary} />
                      <Text style={[styles.saveBtnText, !hasChanges && styles.saveBtnTextDisabled]}>
                        Save Note
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <ZoomableImageModal
        uri={zoomImageUri}
        visible={!!zoomImageUri}
        onClose={() => setZoomImageUri(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(45,106,79,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dateText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  checkinGrid: {
    gap: spacing.sm,
  },
  checkinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkinCard: {
    flex: 1,
    borderRadius: radius.medium,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  checkinCardWide: {
    flex: undefined,
    width: '100%',
    alignItems: 'flex-start',
  },
  checkinEmoji: {
    fontSize: 24,
  },
  checkinCardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkinCardValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkinCardSub: {
    ...typography.caption,
    fontWeight: '500',
  },
  symptomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  symptomRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  symptomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.small,
  },
  symptomText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  noSymptom: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  foodName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  checkinNotes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noteInput: {
    backgroundColor: colors.white,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    minHeight: 120,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.small,
  },
  saveBtnDisabled: {
    backgroundColor: colors.divider,
  },
  saveBtnText: {
    ...typography.labelMedium,
    color: colors.white,
  },
  saveBtnTextDisabled: {
    color: colors.textSecondary,
  },
});
