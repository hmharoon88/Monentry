import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryBar } from '../../src/components/CategoryBar';
import { EmptyState } from '../../src/components/EmptyState';
import { TransactionRow } from '../../src/components/TransactionRow';
import { useTheme } from '../../src/context/ThemeContext';
import { useTransactions } from '../../src/context/TransactionContext';
import { radius, spacing, typography } from '../../src/theme';
import { formatAmount } from '../../src/utils/format';
import { formatMonthLabel } from '../../src/utils/date';

export default function SummaryScreen() {
  const { colors } = useTheme();
  const { monthTransactions, monthTotals, categoryTotals, removeTransaction, refresh } =
    useTransactions();
  const maxAmount = categoryTotals[0]?.amount ?? 0;
  const expenseCategories = categoryTotals.filter((c) => c.type === 'expense');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Summary</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {formatMonthLabel()}
          </Text>
        </View>

        <View style={[styles.totalsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Income</Text>
            <Text style={[styles.totalValue, { color: colors.income }]}>
              {formatAmount(monthTotals.income, true, 'income')}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.totalValue, { color: colors.expense }]}>
              {formatAmount(monthTotals.expense, true, 'expense')}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.totalRow}>
            <Text style={[styles.netLabel, { color: colors.textPrimary }]}>Net</Text>
            <Text
              style={[
                styles.netValue,
                { color: monthTotals.net >= 0 ? colors.income : colors.expense },
              ]}
            >
              {formatAmount(monthTotals.net, true, monthTotals.net >= 0 ? 'income' : 'expense')}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>By type</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {expenseCategories.length === 0 ? (
            <EmptyState
              title="No expenses this month"
              subtitle="Your category breakdown will appear here."
            />
          ) : (
            expenseCategories.map((item) => (
              <CategoryBar key={`${item.type}-${item.category}`} item={item} maxAmount={maxAmount} />
            ))
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>This month</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Long-press an entry to delete it
        </Text>

        <View style={[styles.entriesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {monthTransactions.length === 0 ? (
            <EmptyState title="No entries this month" subtitle="Add expenses or income on Today." />
          ) : (
            monthTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onDelete={removeTransaction}
                showDate
              />
            ))
          )}
        </View>
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
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.label,
    marginTop: 2,
  },
  totalsCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.body,
  },
  totalValue: {
    fontSize: typography.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  netLabel: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  netValue: {
    fontSize: typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: typography.caption,
    marginBottom: spacing.sm,
  },
  listCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  entriesCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
});
