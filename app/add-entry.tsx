import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountKeypad } from '../src/components/AmountKeypad';
import { TypeChips } from '../src/components/TypeChips';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  PLACES,
} from '../src/constants/categories';
import { useTheme } from '../src/context/ThemeContext';
import { useTransactions } from '../src/context/TransactionContext';
import { radius, spacing, typography } from '../src/theme';
import { EntryType } from '../src/types/transaction';
import { formatAmount, parseAmountInput } from '../src/utils/format';

export default function AddEntryScreen() {
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const entryType: EntryType = typeParam === 'income' ? 'income' : 'expense';
  const { colors } = useTheme();
  const { createTransaction } = useTransactions();

  const categories = entryType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(categories[0]);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [place, setPlace] = useState<string>(PLACES[0]);
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAmount = useMemo(() => parseAmountInput(amount), [amount]);
  const descriptionPlaceholder =
    entryType === 'income'
      ? 'e.g. Paycheck, freelance, refund'
      : 'e.g. Weekly shop, dinner with Sam';
  const canSave = parsedAmount > 0 && !saving;
  const accentColor = entryType === 'expense' ? colors.expense : colors.income;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await createTransaction({
        type: entryType,
        amount: parsedAmount,
        category,
        method: showMore ? method : undefined,
        place: showMore ? place : undefined,
        note: note.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {entryType === 'expense' ? 'Add expense' : 'Add income'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.amount, { color: accentColor }]}>
          {amount ? formatAmount(parsedAmount) : '$0'}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Description <Text style={{ fontWeight: '400' }}>(optional)</Text>
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={descriptionPlaceholder}
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.descriptionInput,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        />

        <Text style={[styles.sectionLabel, styles.sectionGap, { color: colors.textSecondary }]}>
          Category
        </Text>
        <TypeChips options={categories} selected={category} onSelect={setCategory} />

        <Pressable onPress={() => setShowMore((v) => !v)} style={styles.moreToggle}>
          <Text style={[styles.moreToggleText, { color: colors.primary }]}>
            {showMore ? 'Hide details' : 'More details'}
          </Text>
        </Pressable>

        {showMore && (
          <View style={styles.moreSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Method</Text>
            <TypeChips options={PAYMENT_METHODS} selected={method} onSelect={setMethod} />

            <Text style={[styles.sectionLabel, styles.sectionGap, { color: colors.textSecondary }]}>
              Place
            </Text>
            <TypeChips options={PLACES} selected={place} onSelect={setPlace} />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AmountKeypad value={amount} onChange={setAmount} />
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cancel: {
    fontSize: typography.body,
    width: 64,
  },
  headerTitle: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 64,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.label,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionGap: {
    marginTop: spacing.md,
  },
  moreToggle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  moreToggleText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  moreSection: {
    paddingBottom: spacing.sm,
  },
  descriptionInput: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
  },
  footer: {
    flexShrink: 0,
    paddingBottom: spacing.sm,
  },
  saveButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
