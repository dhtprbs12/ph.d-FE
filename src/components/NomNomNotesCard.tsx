import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import notesService, { NoteEntry, StreakInfo } from '../services/notesService';
import checkinService, { CheckinEntry } from '../services/checkinService';

interface Props {
  petId: string;
  onViewDetail: (date: string) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeDate(d: string): string {
  if (d.includes('T')) return d.split('T')[0];
  return d;
}

export default function NomNomNotesCard({ petId, onViewDetail }: Props) {
  const [today, setToday] = useState(() => new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateStr(today));
  const [loading, setLoading] = useState(true);

  const monthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const loadData = useCallback(async () => {
    try {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay = new Date(viewYear, viewMonth + 1, 0);
      const from = toDateStr(firstDay);
      const to = toDateStr(lastDay);

      const [cRes, nRes, sRes] = await Promise.allSettled([
        checkinService.getCheckins(petId, from, to),
        notesService.getNotes(petId, from, to),
        notesService.getStreak(petId),
      ]);

      if (cRes.status === 'fulfilled') setCheckins(cRes.value.checkins);
      if (nRes.status === 'fulfilled') setNotes(nRes.value);
      if (sRes.status === 'fulfilled') setStreak(sRes.value);
    } catch (e) {
      console.warn('[NomNomNotes] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [petId, viewYear, viewMonth]);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      loadData();
    }, [loadData])
  );

  const checkinDates = useMemo(() => new Set(checkins.map(c => normalizeDate(c.date))), [checkins]);
  const noteMap = useMemo(() => {
    const m: Record<string, string> = {};
    notes.forEach(n => { m[normalizeDate(n.date)] = n.note; });
    return m;
  }, [notes]);

  const calendarRows = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDay = first.getDay();
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) row.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      row.push(d);
      if (row.length === 7) { rows.push(row); row = []; }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [viewYear, viewMonth]);

  const goPrevMonth = useCallback(() => {
    setSelectedDate(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const goNextMonth = useCallback(() => {
    setSelectedDate(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  const todayStr = toDateStr(today);

  const onDayPress = useCallback((day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  }, [viewYear, viewMonth]);

  const selectedCheckin = useMemo(() => {
    if (!selectedDate) return null;
    return checkins.find(c => normalizeDate(c.date) === selectedDate) || null;
  }, [selectedDate, checkins]);

  const selectedNote = selectedDate ? noteMap[selectedDate] : null;
  const hasCheckin = selectedDate ? checkinDates.has(selectedDate) : false;

  return (
    <View style={[styles.card, shadows.card]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Nom Nom Notes</Text>
          {streak && streak.currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={14} color={colors.warning} />
              <Text style={styles.streakText}>{streak.currentStreak} day streak</Text>
            </View>
          )}
        </View>
      </View>

      {/* Month Nav */}
      <View style={styles.monthNav}>
        <Pressable onPress={goPrevMonth} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={goNextMonth} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 32 }} color={colors.primary} />
      ) : (
        <>
          {/* Weekday Headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={styles.weekLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View>
            {calendarRows.map((row, ri) => (
              <View key={`row-${ri}`} style={styles.calRow}>
                {row.map((day, ci) => {
                  if (day === null) {
                    return <View key={`e-${ri}-${ci}`} style={styles.dayCell} />;
                  }
                  const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const hadCheckin = checkinDates.has(dateStr);
                  const hasNote = !!noteMap[dateStr];
                  return (
                    <Pressable
                      key={dateStr}
                      style={[
                        styles.dayCell,
                        isToday && styles.todayCell,
                        isSelected && styles.selectedCell,
                      ]}
                      onPress={() => onDayPress(day)}
                    >
                      <Text style={[
                        styles.dayText,
                        isToday && styles.todayText,
                        isSelected && styles.selectedText,
                      ]}>{day}</Text>
                      <View style={styles.dotRow}>
                        {hadCheckin && <View style={[styles.dot, { backgroundColor: isSelected ? colors.white : colors.primary }]} />}
                        {hasNote && <View style={[styles.dot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : colors.accent }]} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendLabel}>Check-in</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendLabel}>Note</Text>
            </View>
          </View>

          {/* Inline Preview */}
          {selectedDate && (
            <View style={styles.preview}>
              <Text style={styles.previewDate}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </Text>

              {hasCheckin && selectedCheckin ? (
                <View style={styles.previewRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.previewText}>
                    Stool: {selectedCheckin.stoolScore}/5 &middot; Appetite: {selectedCheckin.appetite}
                    {selectedCheckin.vomiting ? ' \u00B7 Vomiting' : ''}
                    {selectedCheckin.itching ? ' \u00B7 Itching' : ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.previewRow}>
                  <Ionicons name="ellipse-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.previewText}>No check-in</Text>
                </View>
              )}

              {selectedNote ? (
                <View style={styles.previewRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.accent} />
                  <Text style={styles.previewText} numberOfLines={2}>{selectedNote}</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.previewCta}
                  onPress={() => onViewDetail(selectedDate)}
                >
                  <Text style={styles.previewCtaText}>Add note →</Text>
                </Pressable>
              )}

              {(hasCheckin || selectedNote) && (
                <Pressable
                  style={styles.viewBtn}
                  onPress={() => onViewDetail(selectedDate)}
                >
                  <Text style={styles.viewBtnText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.large,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,162,97,0.12)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  streakText: {
    ...typography.labelSmall,
    color: colors.warning,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  monthLabel: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxs,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  calRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.small,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  selectedCell: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  todayText: {
    fontWeight: '700',
    color: colors.primary,
  },
  selectedText: {
    fontWeight: '700',
    color: colors.white,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingLeft: spacing.xxs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  preview: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.medium,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  previewDate: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  previewText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  previewCta: {
    paddingVertical: 4,
  },
  previewCtaText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 4,
  },
  viewBtnText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
});
