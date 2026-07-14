import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme';
import { Transaction } from '../types/transaction';
import { formatShortDate, formatTime, isSameDay } from '../utils/date';
import { formatAmount } from '../utils/format';
import { confirmDeleteEntry } from '../utils/confirmDelete';
import {
  getTransactionTitle,
  shouldShowCategoryInMeta,
} from '../utils/transactionDisplay';

interface TransactionRowProps {
  transaction: Transaction;
  onDelete?: (id: string) => void;
  showDate?: boolean;
}

export function TransactionRow({ transaction, onDelete, showDate }: TransactionRowProps) {
  const { colors } = useTheme();
  const amountColor = transaction.type === 'expense' ? colors.expense : colors.income;

  const metaParts = [
    showDate && !isSameDay(transaction.date, new Date().toISOString())
      ? formatShortDate(transaction.date)
      : null,
    shouldShowCategoryInMeta(transaction) ? transaction.category : null,
    transaction.place,
    transaction.method,
    formatTime(transaction.date),
  ].filter(Boolean);

  const handleDelete = () => {
    if (!onDelete) return;
    confirmDeleteEntry(() => onDelete(transaction.id));
  };

  return (
    <Pressable
      onLongPress={handleDelete}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {getTransactionTitle(transaction)}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {metaParts.join(' · ')}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {formatAmount(transaction.amount, true, transaction.type)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '500',
  },
  meta: {
    fontSize: typography.caption,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
