import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUBSCRIPTION_INFO } from '../../src/constants/categories';
import { ThemePreference, useTheme } from '../../src/context/ThemeContext';
import { useTransactions } from '../../src/context/TransactionContext';
import { radius, spacing, typography } from '../../src/theme';
import { confirmClearAll } from '../../src/utils/confirmDelete';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function MeScreen() {
  const { colors, preference, setPreference } = useTheme();
  const { clearAll } = useTransactions();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Me</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Plan</Text>
          <View style={[styles.planBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.planName, { color: colors.primary }]}>
              {SUBSCRIPTION_INFO.free.label}
            </Text>
          </View>
          <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
            {SUBSCRIPTION_INFO.free.description}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {THEME_OPTIONS.map((option, index) => {
            const selected = preference === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={[
                  styles.themeRow,
                  index < THEME_OPTIONS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>
                  {option.label}
                </Text>
                {selected && (
                  <Text style={[styles.check, { color: colors.primary }]}>✓</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Data</Text>
        <Pressable
          onPress={() => confirmClearAll(clearAll)}
          style={[styles.dangerCard, { backgroundColor: colors.surface, borderColor: colors.expense }]}
        >
          <Text style={[styles.dangerTitle, { color: colors.expense }]}>Clear all data</Text>
          <Text style={[styles.dangerDesc, { color: colors.textSecondary }]}>
            Delete every expense and income entry. Today and Summary will reset.
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upgrade</Text>
        {(['plus', 'family'] as const).map((tier) => (
          <View
            key={tier}
            style={[styles.upgradeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.upgradeHeader}>
              <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                {SUBSCRIPTION_INFO[tier].label}
              </Text>
              <Text style={[styles.upgradePrice, { color: colors.primary }]}>
                {SUBSCRIPTION_INFO[tier].price}
              </Text>
            </View>
            <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
              {SUBSCRIPTION_INFO[tier].description}
            </Text>
            <View style={[styles.comingSoon, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.comingSoonText, { color: colors.accent }]}>Coming soon</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.label,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  planName: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  planDesc: {
    fontSize: typography.label,
    lineHeight: 20,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  themeLabel: {
    fontSize: typography.body,
  },
  check: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  dangerCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  dangerTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  dangerDesc: {
    fontSize: typography.label,
    lineHeight: 20,
  },
  upgradeCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  upgradeName: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  upgradePrice: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  upgradeDesc: {
    fontSize: typography.label,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  comingSoon: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  comingSoonText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
});
