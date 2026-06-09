import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { TransactionRow } from '../../src/components/TransactionRow';
import { useTheme } from '../../src/context/ThemeContext';
import { useTransactions } from '../../src/context/TransactionContext';
import { radius, spacing, typography } from '../../src/theme';
import { formatAmount } from '../../src/utils/format';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { todayTransactions, todayTotals, removeTransaction, refresh } = useTransactions();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.primary }]}>Monentry</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Today</Text>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Spent today</Text>
        <Text style={[styles.heroAmount, { color: colors.expense }]}>
          {formatAmount(todayTotals.expense)}
        </Text>
        <Text style={[styles.incomeLine, { color: colors.income }]}>
          + {formatAmount(todayTotals.income)} income
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.expenseButton, { borderColor: colors.expense, backgroundColor: colors.expenseSoft }]}
          onPress={() => router.push({ pathname: '/add-entry', params: { type: 'expense' } })}
        >
          <Text style={[styles.expenseButtonText, { color: colors.expense }]}>− Expense</Text>
        </Pressable>
        <Pressable
          style={[styles.incomeButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/add-entry', params: { type: 'income' } })}
        >
          <Text style={[styles.incomeButtonText, { color: colors.onPrimary }]}>+ Income</Text>
        </Pressable>
      </View>

      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScrollView>
          {todayTransactions.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              subtitle="Tap − Expense or + Income to log your first entry. Long-press to delete."
            />
          ) : (
            todayTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onDelete={removeTransaction}
              />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  brand: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.label,
    marginTop: 2,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  heroLabel: {
    fontSize: typography.label,
  },
  heroAmount: {
    fontSize: typography.hero,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  incomeLine: {
    fontSize: typography.body,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  expenseButton: {
    flex: 1,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  expenseButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  incomeButton: {
    flex: 1,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  incomeButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  listCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
});
