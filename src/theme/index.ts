import { Platform } from 'react-native';

export const colors = {
  primary: '#2D6A4F',
  primaryLight: '#40916C',
  accent: '#F4A261',
  accentSoft: '#E9C46A',

  safe: '#40916C',
  caution: '#E9C46A',
  warning: '#F4A261',
  danger: '#E76F51',

  background: '#FDFBF7',
  card: '#FFFFFF',
  lightGray: '#F5F3EF',
  divider: '#E8E4DD',

  textPrimary: '#1B2B27',
  textSecondary: '#5C6B66',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  launchTeal: 'rgb(33, 140, 135)',
};

export const gradeColors: Record<string, string> = {
  A: '#2D6A4F',
  B: '#40916C',
  C: '#E9C46A',
  D: '#F4A261',
  F: '#E76F51',
};

export const gradeDescriptions: Record<string, string> = {
  A: 'Excellent Choice',
  B: 'Good Choice',
  C: 'Acceptable',
  D: 'Use Caution',
  F: 'Avoid',
};

export const riskColors: Record<string, string> = {
  safe: '#2D6A4F',
  low: '#40916C',
  moderate: '#E9C46A',
  high: '#F4A261',
  danger: '#E76F51',
};

export function getGradeColor(grade: string): string {
  return gradeColors[grade?.toUpperCase()] ?? colors.textSecondary;
}

export function getGradeDescription(grade: string): string {
  return gradeDescriptions[grade?.toUpperCase()] ?? 'Unknown';
}

export function getRiskColor(level: string): string {
  return riskColors[level?.toLowerCase()] ?? colors.textSecondary;
}

export function getPetTypeIcon(petType: string): string {
  switch (petType?.toLowerCase()) {
    case 'dog': return '🐕';
    case 'cat': return '🐱';
    default: return '🐾';
  }
}

export const typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const },
  displayMedium: { fontSize: 26, fontWeight: '600' as const },
  displaySmall: { fontSize: 20, fontWeight: '600' as const },

  titleLarge: { fontSize: 18, fontWeight: '600' as const },
  titleMedium: { fontSize: 16, fontWeight: '600' as const },

  bodyLarge: { fontSize: 17, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },

  scoreDisplay: { fontSize: 56, fontWeight: '700' as const },
  gradeDisplay: { fontSize: 64, fontWeight: '700' as const },
  numericLarge: { fontSize: 28, fontWeight: '600' as const },
  numericMedium: { fontSize: 20, fontWeight: '500' as const },

  labelLarge: { fontSize: 14, fontWeight: '600' as const },
  labelMedium: { fontSize: 12, fontWeight: '500' as const },
  labelSmall: { fontSize: 11, fontWeight: '500' as const },

  caption: { fontSize: 11, fontWeight: '400' as const },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 24,
  full: 9999,
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#2D6A4F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
  }),
  cardSecondary: Platform.select({
    ios: {
      shadowColor: '#2D6A4F',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.02,
      shadowRadius: 1,
    },
    android: {
      elevation: 1,
    },
  }),
  elevated: Platform.select({
    ios: {
      shadowColor: '#2D6A4F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
  }),
  button: (color: string) => Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
  }),
};
