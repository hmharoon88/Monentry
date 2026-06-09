import { StyleSheet } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './colors';

export { darkColors, lightColors };
export type { ThemeColors };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  hero: 36,
  title: 20,
  body: 16,
  label: 13,
  caption: 12,
} as const;

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    outlineButton: {
      borderRadius: radius.xl,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.expense,
      backgroundColor: colors.expenseSoft,
    },
    outlineButtonText: {
      color: colors.expense,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}
