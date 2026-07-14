import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useSettle } from '../../src/context/SettleContext';
import { useTheme } from '../../src/context/ThemeContext';
import { subscribeToSettleEntries, subscribeToSettleLedger } from '../../src/sync/settleSync';
import { SettleEntry, SettleLedger } from '../../src/types/settle';
import { radius, spacing, typography } from '../../src/theme';
import {
  computePairwiseNetCents,
  computeSettleBalance,
  formatMoney,
  formatPairwiseNet,
  formatSettleBalance,
  isGroupFullySettled,
} from '../../src/utils/settleBalance';
import {
  isGroupLedger,
  ledgerDisplayName,
  otherParticipantId,
  participantEmailName,
} from '../../src/utils/settleLedger';
import { buildSettleInviteLink } from '../../src/utils/settleInviteLink';

export default function SettleLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    addEntry,
    addGroupEntry,
    approveEntry,
    rejectEntry,
    requestDeleteEntry,
    approveDeleteEntry,
    rejectDeleteEntry,
    cancelInvite,
    closeLedger,
    requestClose,
    approveClose,
    rejectClose,
  } = useSettle();

  const [ledger, setLedger] = useState<SettleLedger | null>(null);
  const [entries, setEntries] = useState<SettleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState<'they_owe_me' | 'i_owe_them'>('they_owe_me');
  const [creditorUid, setCreditorUid] = useState('');
  const [debtorUid, setDebtorUid] = useState('');
  const [membersExpanded, setMembersExpanded] = useState(false);

  const ledgerId = typeof id === 'string' ? id : '';

  useEffect(() => {
    if (!ledgerId) {
      return;
    }

    let cancelled = false;
    const unsubscribeLedger = subscribeToSettleLedger(ledgerId, (next) => {
      if (!cancelled) {
        setLedger(next);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToSettleEntries(ledgerId, (next) => {
      if (!cancelled) {
        setEntries(next);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeLedger();
      unsubscribe();
    };
  }, [ledgerId]);

  useEffect(() => {
    if (ledger?.status === 'closed' || ledger?.status === 'cancelled') {
      router.back();
    }
  }, [ledger?.status, router]);

  const otherUid = user && ledger && !isGroupLedger(ledger) ? otherParticipantId(ledger, user.uid) : null;
  const otherName = user && ledger ? ledgerDisplayName(ledger, user.uid) : 'them';
  const isGroup = ledger ? isGroupLedger(ledger) : false;

  useEffect(() => {
    if (!ledger || !isGroup || !user) {
      return;
    }

    const others = ledger.participantIds.filter((id) => id !== user.uid);
    if (others.length === 0) {
      return;
    }

    setCreditorUid((current) => (current && ledger.participantIds.includes(current) ? current : user.uid));
    setDebtorUid((current) => {
      if (current && ledger.participantIds.includes(current) && current !== user.uid) {
        return current;
      }
      return others[0];
    });
  }, [isGroup, ledger, user]);

  useEffect(() => {
    if (!ledger || !isGroup) {
      return;
    }
    setMembersExpanded(ledger.participantIds.length <= 4);
  }, [isGroup, ledger?.id, ledger?.participantIds.length]);

  const balance = useMemo(() => {
    if (!user || !otherUid) {
      return null;
    }
    return computeSettleBalance(entries, user.uid, otherUid);
  }, [entries, otherUid, user]);

  const groupPairwiseBalances = useMemo(() => {
    if (!user || !ledger || !isGroup) {
      return [];
    }

    return ledger.participantIds
      .filter((id) => id !== user.uid)
      .map((id) => ({
        uid: id,
        name: participantEmailName(ledger, id),
        netCents: computePairwiseNetCents(entries, user.uid, id),
      }));
  }, [entries, isGroup, ledger, user]);

  const groupFullySettled = useMemo(() => {
    if (!ledger || !isGroup) {
      return false;
    }
    return isGroupFullySettled(
      entries.filter((entry) => entry.status === 'approved'),
      ledger.participantIds,
    );
  }, [entries, isGroup, ledger]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.status !== 'deleted' && entry.status !== 'rejected'),
    [entries],
  );

  const { myDebts, theirDebts } = useMemo(() => {
    if (!user || !otherUid || isGroup) {
      return { myDebts: [] as SettleEntry[], theirDebts: [] as SettleEntry[] };
    }

    return {
      myDebts: visibleEntries.filter((entry) => entry.debtorUid === user.uid),
      theirDebts: visibleEntries.filter((entry) => entry.debtorUid === otherUid),
    };
  }, [isGroup, otherUid, user, visibleEntries]);

  const shareGroupInvite = async () => {
    if (!ledger?.inviteCode) {
      return;
    }
    const link = buildSettleInviteLink(ledger.inviteCode);
    await Share.share({
      message: `Join my Monentry Group Settle "${ledger.label}": ${link}\nOr enter code: ${ledger.inviteCode}`,
    });
  };

  const renderGroupEntry = (entry: SettleEntry) => {
    if (!ledger || !user) {
      return null;
    }

    const isCreator = entry.createdBy === user.uid;
    const pending = entry.status === 'pending';
    const deletePending = entry.status === 'delete_pending';
    const approved = entry.status === 'approved';
    const debtorName = participantEmailName(ledger, entry.debtorUid);
    const creditorName = participantEmailName(ledger, entry.creditorUid);
    const summary = `${debtorName} owes ${creditorName} $${formatMoney(entry.amount)}`;

    return (
      <View
        key={entry.id}
        style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.entryAmount, { color: colors.textPrimary }]}>
          {summary}
          {pending && isCreator ? ' · pending' : ''}
        </Text>
        {entry.note ? (
          <Text style={[styles.entryNote, { color: colors.textSecondary }]}>{entry.note}</Text>
        ) : null}
        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
          {new Date(entry.createdAt).toLocaleString()}
        </Text>

        {pending && !isCreator ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={busy !== null}
              onPress={() => run(`approve-${entry.id}`, () => approveEntry(ledgerId, entry.id))}
              style={[styles.approveButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.approveText, { color: colors.onPrimary }]}>Approve</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => run(`reject-${entry.id}`, () => rejectEntry(ledgerId, entry.id))}
              style={[styles.rejectButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rejectText, { color: colors.textPrimary }]}>Decline</Text>
            </Pressable>
          </View>
        ) : null}

        {deletePending && entry.deleteRequestedBy !== user.uid ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={busy !== null}
              onPress={() =>
                run(`del-approve-${entry.id}`, () => approveDeleteEntry(ledgerId, entry.id))
              }
              style={[styles.approveButton, { backgroundColor: colors.expense }]}
            >
              <Text style={[styles.approveText, { color: colors.onPrimary }]}>Approve remove</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() =>
                run(`del-reject-${entry.id}`, () => rejectDeleteEntry(ledgerId, entry.id))
              }
              style={[styles.rejectButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rejectText, { color: colors.textPrimary }]}>Keep</Text>
            </Pressable>
          </View>
        ) : null}

        {approved && !deletePending ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              Alert.alert('Remove entry?', 'Someone else in the group must approve before it is removed.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Request remove',
                  onPress: () =>
                    run(`del-req-${entry.id}`, () => requestDeleteEntry(ledgerId, entry.id)),
                },
              ])
            }
          >
            <Text style={[styles.removeLink, { color: colors.expense }]}>Request remove</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderParticipantChip = (
    uid: string,
    selected: boolean,
    onSelect: () => void,
    label: string,
  ) => (
    <Pressable
      key={uid}
      onPress={onSelect}
      style={[
        styles.directionChip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.bg,
        },
      ]}
    >
      <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  const renderParticipantPicker = (
    selectedUid: string,
    onSelect: (uid: string) => void,
    compact: boolean,
  ) => {
    if (!ledger) {
      return null;
    }

    if (compact) {
      return (
        <View style={styles.participantList}>
          {ledger.participantIds.map((uid) => {
            const selected = selectedUid === uid;
            const label = participantEmailName(ledger, uid);
            return (
              <Pressable
                key={uid}
                onPress={() => onSelect(uid)}
                style={[
                  styles.participantRow,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.bg,
                  },
                ]}
              >
                <Text style={[styles.participantRowText, { color: colors.textPrimary }]}>
                  {label}
                </Text>
                {selected ? (
                  <Text style={[styles.participantCheck, { color: colors.primary }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.directionRow}>
        {ledger.participantIds.map((uid) =>
          renderParticipantChip(
            uid,
            selectedUid === uid,
            () => onSelect(uid),
            participantEmailName(ledger, uid),
          ),
        )}
      </View>
    );
  };

  const renderEntry = (entry: SettleEntry, column: 'you' | 'them') => {
    if (!user) {
      return null;
    }
    const isCreator = entry.createdBy === user.uid;
    const pending = entry.status === 'pending';
    const deletePending = entry.status === 'delete_pending';
    const approved = entry.status === 'approved';

    const summary =
      column === 'you'
        ? `You owe ${otherName} $${formatMoney(entry.amount)}`
        : `${otherName} owes you $${formatMoney(entry.amount)}`;

    return (
      <View
        key={entry.id}
        style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.entryAmount, { color: colors.textPrimary }]}>
          {summary}
          {pending && isCreator ? ' · pending' : ''}
        </Text>
        {entry.note ? (
          <Text style={[styles.entryNote, { color: colors.textSecondary }]}>{entry.note}</Text>
        ) : null}
        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
          {new Date(entry.createdAt).toLocaleString()}
        </Text>

        {pending && !isCreator ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={busy !== null}
              onPress={() => run(`approve-${entry.id}`, () => approveEntry(ledgerId, entry.id))}
              style={[styles.approveButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.approveText, { color: colors.onPrimary }]}>Approve</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => run(`reject-${entry.id}`, () => rejectEntry(ledgerId, entry.id))}
              style={[styles.rejectButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rejectText, { color: colors.textPrimary }]}>Decline</Text>
            </Pressable>
          </View>
        ) : null}

        {deletePending && entry.deleteRequestedBy !== user.uid ? (
          <View style={styles.actionRow}>
            <Text style={[styles.entryNote, { color: colors.textSecondary }]}>
              {isCreator ? 'You' : otherName} asked to remove
            </Text>
            <Pressable
              disabled={busy !== null}
              onPress={() =>
                run(`del-approve-${entry.id}`, () => approveDeleteEntry(ledgerId, entry.id))
              }
              style={[styles.approveButton, { backgroundColor: colors.expense }]}
            >
              <Text style={[styles.approveText, { color: colors.onPrimary }]}>Approve remove</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() =>
                run(`del-reject-${entry.id}`, () => rejectDeleteEntry(ledgerId, entry.id))
              }
              style={[styles.rejectButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rejectText, { color: colors.textPrimary }]}>Keep</Text>
            </Pressable>
          </View>
        ) : null}

        {approved && !deletePending ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              Alert.alert('Remove entry?', 'The other person must approve before it is removed.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Request remove',
                  onPress: () =>
                    run(`del-req-${entry.id}`, () => requestDeleteEntry(ledgerId, entry.id)),
                },
              ])
            }
          >
            <Text style={[styles.removeLink, { color: colors.expense }]}>Request remove</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderColumn = (
    title: string,
    columnEntries: SettleEntry[],
    column: 'you' | 'them',
    totalCents: number,
  ) => (
    <View style={[styles.column, { borderColor: colors.border }]}>
      <View style={[styles.columnHeader, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.columnTitle, { color: colors.primary }]}>{title}</Text>
      </View>
      <View style={styles.columnEntries}>
        {columnEntries.length === 0 ? (
          <Text style={[styles.emptyColumn, { color: colors.textTertiary }]}>No entries</Text>
        ) : (
          columnEntries.map((entry) => renderEntry(entry, column))
        )}
      </View>
      <View style={[styles.columnTotal, { borderTopColor: colors.border }]}>
        <Text style={[styles.columnTotalLabel, { color: colors.textSecondary }]}>Total</Text>
        <Text style={[styles.columnTotalValue, { color: colors.textPrimary }]}>
          ${formatMoney(totalCents / 100)}
        </Text>
      </View>
    </View>
  );

  const hasOpenItems = useMemo(
    () => entries.some((entry) => entry.status === 'pending' || entry.status === 'delete_pending'),
    [entries],
  );

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
      if (label === 'add') {
        setAmount('');
        setNote('');
      }
    } catch (error) {
      Alert.alert(
        'Could not update',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (!ledger) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.primary }]}>← Back</Text>
          </Pressable>
        </View>
        <Text style={[styles.bannerText, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
          Settle not found.
        </Text>
      </SafeAreaView>
    );
  }

  const isPending = ledger.status === 'pending';
  const isActive = ledger.status === 'active';
  const isClosePending = ledger.status === 'close_pending';
  const showLedger = isActive || isClosePending;
  const canAddEntry = isActive && (!isGroup || ledger.participantIds.length >= 2);
  const isCreator = ledger.createdBy === user.uid;
  const closeRequestedByMe = ledger.closeRequestedBy === user.uid;
  const closeRequestedByOther = isClosePending && ledger.closeRequestedBy !== user.uid;
  const canCloseNow =
    isActive && !hasOpenItems && (isGroup ? groupFullySettled : balance?.netCents === 0);
  const canRequestClose =
    isActive && !isGroup && balance && balance.netCents !== 0 && !hasOpenItems;
  const headerTitle = isGroup ? ledger.label : otherName;
  const canShareGroupInvite =
    isGroup &&
    ledger.participantIds.length < ledger.maxMembers &&
    ledger.status !== 'close_pending';
  const groupNeedsMorePeople = isGroup && ledger.participantIds.length < 2;
  const useCompactMemberPicker = isGroup && ledger.participantIds.length > 4;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isGroup ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setMembersExpanded((open) => !open)}
              style={styles.membersHeader}
            >
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                People · {ledger.participantIds.length} of {ledger.maxMembers}
              </Text>
              <Text style={[styles.membersChevron, { color: colors.textTertiary }]}>
                {membersExpanded ? '▾' : '▸'}
              </Text>
            </Pressable>
            {!membersExpanded ? (
              <Text style={[styles.memberLine, { color: colors.textSecondary }]}>
                {ledger.participantIds
                  .slice(0, 3)
                  .map((uid) => participantEmailName(ledger, uid))
                  .join(', ')}
                {ledger.participantIds.length > 3
                  ? ` +${ledger.participantIds.length - 3} more`
                  : ''}
              </Text>
            ) : (
              ledger.participantIds.map((uid) => (
                <Text key={uid} style={[styles.memberLine, { color: colors.textSecondary }]}>
                  {participantEmailName(ledger, uid)}
                  {uid === ledger.createdBy ? ' · started group' : ''}
                </Text>
              ))
            )}
            {canShareGroupInvite ? (
              <Pressable
                disabled={busy !== null}
                onPress={() => run('share', shareGroupInvite)}
                style={[styles.secondaryManageButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryManageText, { color: colors.primary }]}>
                  Share invite · {ledger.inviteCode}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!isActive && isPending ? (
          <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
              {isGroup
                ? 'Share the invite so more people can join.'
                : `Waiting for ${otherName} to accept your invite.`}
            </Text>
          </View>
        ) : null}

        {groupNeedsMorePeople && isActive ? (
          <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
              Need at least 2 people before adding entries. Share the invite above.
            </Text>
          </View>
        ) : null}

        {!isGroup && isClosePending && closeRequestedByMe ? (
          <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
              Waiting for {otherName} to approve closing this Settle.
            </Text>
          </View>
        ) : null}

        {!isGroup && closeRequestedByOther && balance ? (
          <View style={[styles.manageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.manageTitle, { color: colors.textPrimary }]}>
              {otherName} wants to close this Settle
            </Text>
            <Text style={[styles.manageDesc, { color: colors.textSecondary }]}>
              Current balance: {formatSettleBalance(balance.netCents, otherName)}. Approving will
              archive this Settle for both of you.
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                disabled={busy !== null}
                onPress={() => run('approve-close', () => approveClose(ledgerId))}
                style={[styles.approveButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.approveText, { color: colors.onPrimary }]}>Approve close</Text>
              </Pressable>
              <Pressable
                disabled={busy !== null}
                onPress={() => run('reject-close', () => rejectClose(ledgerId))}
                style={[styles.rejectButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.rejectText, { color: colors.textPrimary }]}>Keep open</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canAddEntry ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Add entry</Text>
            {isGroup ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Who is owed</Text>
                {renderParticipantPicker(creditorUid, setCreditorUid, useCompactMemberPicker)}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Who owes</Text>
                {renderParticipantPicker(debtorUid, setDebtorUid, useCompactMemberPicker)}
              </>
            ) : (
              <View style={styles.directionRow}>
                {(
                  [
                    ['they_owe_me', `They owe me`],
                    ['i_owe_them', `I owe them`],
                  ] as const
                ).map(([value, label]) => {
                  const selected = direction === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDirection(value)}
                      style={[
                        styles.directionChip,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primarySoft : colors.bg,
                        },
                      ]}
                    >
                      <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            />
            <Pressable
              disabled={busy !== null || !amount.trim() || (isGroup && creditorUid === debtorUid)}
              onPress={() =>
                run('add', async () => {
                  const parsed = Number.parseFloat(amount.replace(/,/g, ''));
                  if (isGroup) {
                    await addGroupEntry(ledgerId, creditorUid, debtorUid, parsed, note);
                  } else {
                    await addEntry(ledgerId, parsed, direction, note);
                  }
                })
              }
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy || !amount.trim() || (isGroup && creditorUid === debtorUid) ? 0.6 : 1,
                },
              ]}
            >
              {busy === 'add' ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Add · needs approval
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {showLedger && isGroup ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your balances</Text>
              {groupPairwiseBalances.length === 0 ? (
                <Text style={[styles.entryNote, { color: colors.textTertiary }]}>No one else yet</Text>
              ) : (
                groupPairwiseBalances.map((row) => (
                  <Text
                    key={row.uid}
                    style={[
                      styles.balanceLine,
                      {
                        color:
                          row.netCents > 0
                            ? colors.income
                            : row.netCents < 0
                              ? colors.expense
                              : colors.textPrimary,
                      },
                    ]}
                  >
                    {formatPairwiseNet(row.netCents, row.name)}
                  </Text>
                ))
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>All entries</Text>
              {visibleEntries.length === 0 ? (
                <Text style={[styles.entryNote, { color: colors.textTertiary }]}>No entries yet</Text>
              ) : (
                visibleEntries.map((entry) => renderGroupEntry(entry))
              )}
            </View>
          </>
        ) : null}

        {showLedger && !isGroup ? (
          <View style={styles.columnsRow}>
            {renderColumn('You', myDebts, 'you', balance?.iOweThemCents ?? 0)}
            {renderColumn(otherName, theirDebts, 'them', balance?.theyOweMeCents ?? 0)}
          </View>
        ) : null}

        {showLedger && !isGroup && balance ? (
          <View style={[styles.netSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text
              style={[
                styles.netSummaryText,
                {
                  color:
                    balance.netCents > 0
                      ? colors.income
                      : balance.netCents < 0
                        ? colors.expense
                        : colors.textPrimary,
                },
              ]}
            >
              {formatSettleBalance(balance.netCents, otherName)}
            </Text>
          </View>
        ) : null}

        {isPending && isCreator ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              Alert.alert('Cancel invite?', 'This will remove the pending Settle invite.', [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel invite',
                  style: 'destructive',
                  onPress: () => run('cancel', () => cancelInvite(ledgerId)),
                },
              ])
            }
            style={[styles.dangerButton, { borderColor: colors.expense }]}
          >
            <Text style={[styles.dangerButtonText, { color: colors.expense }]}>Cancel invite</Text>
          </Pressable>
        ) : null}

        {canCloseNow ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(
                isGroup ? 'Close group Settle?' : 'Close Settle?',
                isGroup
                  ? 'This archives the group for everyone. All balances are zero.'
                  : 'This archives the Settle for both of you. You are all settled up.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Close Settle',
                    onPress: () => run('close', () => closeLedger(ledgerId)),
                  },
                ],
              )
            }
            style={[styles.secondaryManageButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryManageText, { color: colors.textPrimary }]}>
              {isGroup ? 'Close group Settle' : 'Close Settle'}
            </Text>
          </Pressable>
        ) : null}

        {isGroup && isActive && !groupFullySettled && !hasOpenItems ? (
          <Text style={[styles.manageHint, { color: colors.textTertiary }]}>
            Everyone must be settled up before closing this group.
          </Text>
        ) : null}

        {canRequestClose && balance ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(
                'Request to close?',
                `${formatSettleBalance(balance.netCents, otherName)}. ${otherName} must approve before this Settle is archived.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Request to close',
                    style: 'destructive',
                    onPress: () => run('request-close', () => requestClose(ledgerId)),
                  },
                ],
              )
            }
            style={[styles.dangerButton, { borderColor: colors.expense }]}
          >
            <Text style={[styles.dangerButtonText, { color: colors.expense }]}>Request to close</Text>
          </Pressable>
        ) : null}

        {showLedger && hasOpenItems ? (
          <Text style={[styles.manageHint, { color: colors.textTertiary }]}>
            Resolve pending entries before closing this Settle.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  back: { fontSize: typography.body, fontWeight: '600', width: 72 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.body, fontWeight: '700' },
  headerSpacer: { width: 72 },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  banner: { borderRadius: radius.lg, padding: spacing.md },
  bannerText: { fontSize: typography.body, textAlign: 'center' },
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  column: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  columnTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  columnHeader: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  columnEntries: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  emptyColumn: {
    fontSize: typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  columnTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  columnTotalLabel: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
  columnTotalValue: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  entryCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  entryAmount: { fontSize: typography.caption, fontWeight: '600', lineHeight: 18 },
  entryNote: { fontSize: typography.caption },
  entryDate: { fontSize: typography.caption },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  approveButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  approveText: { fontSize: typography.caption, fontWeight: '600' },
  rejectButton: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rejectText: { fontSize: typography.caption, fontWeight: '600' },
  removeLink: { fontSize: typography.caption, fontWeight: '600', marginTop: spacing.xs },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '600' },
  fieldLabel: { fontSize: typography.caption, fontWeight: '600' },
  memberLine: { fontSize: typography.caption },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersChevron: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  participantList: { gap: spacing.xs },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  participantRowText: {
    fontSize: typography.body,
    fontWeight: '500',
    flex: 1,
  },
  participantCheck: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  balanceLine: { fontSize: typography.body, fontWeight: '600' },
  directionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  directionChip: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: typography.body, fontWeight: '600' },
  netSummary: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  netSummaryText: {
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  manageCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  manageTitle: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  manageDesc: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  manageHint: {
    fontSize: typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  dangerButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  dangerButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  secondaryManageButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryManageText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
