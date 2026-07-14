import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME } from '../constants/app';
import { SUBSCRIPTION_INFO } from '../constants/categories';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';

export function AppBrandTitle() {
  const { colors } = useTheme();
  const { tier } = useAuth();
  const planLabel =
    tier === 'plus' || tier === 'family' ? SUBSCRIPTION_INFO[tier].label : null;

  return (
    <View style={styles.row}>
      <Text style={[styles.brand, { color: colors.primary }]}>{APP_NAME}</Text>
      {planLabel ? (
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{planLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  brand: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
