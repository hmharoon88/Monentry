import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { CategoryTotal } from '../types/transaction';
import { formatAmount } from '../utils/format';

interface CategoryBarProps {
  item: CategoryTotal;
  maxAmount: number;
}

export function CategoryBar({ item, maxAmount }: CategoryBarProps) {
  const { colors } = useTheme();
  const widthPercent = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
  const barColor = item.type === 'expense' ? colors.expense : colors.income;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{item.category}</Text>
        <Text style={[styles.amount, { color: barColor }]}>
          {formatAmount(item.amount, true, item.type)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: `${Math.max(widthPercent, 4)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '500',
  },
  amount: {
    fontSize: typography.label,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
