import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { SETTLE_FEATURE } from '../../src/constants/settle';
import { canCreateSettle } from '../../src/constants/subscriptionAccess';
import { SUBSCRIPTION_INFO } from '../../src/constants/categories';
import { useAuth } from '../../src/context/AuthContext';
import { useSettle } from '../../src/context/SettleContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SETTLE_GROUP_MAX } from '../../src/types/settle';
import { radius, spacing, typography } from '../../src/theme';
import { buildSettleInviteLink } from '../../src/utils/settleInviteLink';
import { isGroupLedger, ledgerDisplayName, ledgerSubtitle } from '../../src/utils/settleLedger';

export default function SettleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, tier } = useAuth();
  const { ledgers, loading, createInvite, createGroupInvite, acceptInvite, cancelInvite } = useSettle();
  const { plusPriceLabel, purchasePlus } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [groupLabel, setGroupLabel] = useState('');

  const canStartSettle = canCreateSettle(tier);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      Alert.alert(
        'Could not update Settle',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(null);
    }
  };

  const shareInvite = async (code: string, group = false) => {
    const link = buildSettleInviteLink(code);
    await Share.share({
      message: group
        ? `Join my Monentry Group Settle (up to ${SETTLE_GROUP_MAX} people): ${link}\nOr enter code: ${code}`
        : `Join me on Monentry Settle to track lend & borrow: ${link}\nOr enter code: ${code}`,
    });
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{SETTLE_FEATURE.name}</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{SETTLE_FEATURE.tagline}</Text>
          <Pressable
            onPress={() => router.push('/sign-in')}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{SETTLE_FEATURE.name}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{SETTLE_FEATURE.tagline}</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          ledgers.map((ledger) => {
            const name = ledgerDisplayName(ledger, user.uid);
            const subtitle = ledgerSubtitle(ledger);
            const isPending = ledger.status === 'pending';
            const isClosePending = ledger.status === 'close_pending';
            const isGroup = isGroupLedger(ledger);
            return (
              <Pressable
                key={ledger.id}
                onPress={() => router.push(`/settle-ledger/${ledger.id}`)}
                style={[styles.ledgerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.ledgerName, { color: colors.textPrimary }]}>{name}</Text>
                {subtitle ? (
                  <Text style={[styles.ledgerMeta, { color: colors.textSecondary }]}>{subtitle}</Text>
                ) : null}
                <Text style={[styles.ledgerMeta, { color: colors.textSecondary }]}>
                  {isPending
                    ? isGroup
                      ? 'Share invite to add people'
                      : 'Waiting for them to join'
                    : isClosePending
                      ? 'Close requested'
                      : isGroup
                        ? 'Tap to view balances & entries'
                        : 'Tap to view balance & entries'}
                </Text>
                {(isPending || (isGroup && ledger.participantIds.length < ledger.maxMembers)) &&
                ledger.createdBy === user.uid ? (
                  <>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation?.();
                        run('share', () => shareInvite(ledger.inviteCode, isGroup));
                      }}
                      style={[styles.inlineButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.inlineButtonText, { color: colors.primary }]}>
                        Share invite · {ledger.inviteCode}
                      </Text>
                    </Pressable>
                    {isPending ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          Alert.alert('Cancel invite?', 'This will remove the pending Settle invite.', [
                            { text: 'Keep', style: 'cancel' },
                            {
                              text: 'Cancel invite',
                              style: 'destructive',
                              onPress: () => run(`cancel-${ledger.id}`, () => cancelInvite(ledger.id)),
                            },
                          ]);
                        }}
                        style={[styles.inlineButton, { borderColor: colors.expense }]}
                      >
                        <Text style={[styles.inlineButtonText, { color: colors.expense }]}>
                          Cancel invite
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </Pressable>
            );
          })
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>1-on-1 Settle</Text>
          {!canStartSettle ? (
            <Text style={[styles.cardHint, { color: colors.textSecondary }]}>
              Starting Settle needs Plus. Joining with an invite code is free.
            </Text>
          ) : null}
          <TextInput
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="Their name (e.g. Alex)"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
            ]}
          />
          <Pressable
            disabled={busy !== null}
            onPress={() => {
              if (!canStartSettle) {
                Alert.alert(
                  'Plus plan required',
                  'Starting Settle needs Monentry Plus. Subscribe on the Me tab, or join free with an invite code below.',
                  [
                    { text: 'OK', style: 'cancel' },
                    {
                      text: 'View plans',
                      onPress: () => router.push('/(tabs)/me'),
                    },
                  ],
                );
                return;
              }
              run('create', async () => {
                const ledger = await createInvite(newLabel);
                setNewLabel('');
                await shareInvite(ledger.inviteCode);
              });
            }}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy === 'create' ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Invite friend or family{!canStartSettle ? ' · Plus plan' : ''}
              </Text>
            )}
          </Pressable>
          {!canStartSettle ? (
            <Pressable
              onPress={() =>
                run('plus', async () => {
                  await purchasePlus();
                })
              }
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                Subscribe · {plusPriceLabel ?? SUBSCRIPTION_INFO.plus.price}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Group Settle</Text>
          <Text style={[styles.cardHint, { color: colors.textSecondary }]}>
            Track lend & borrow with up to {SETTLE_GROUP_MAX} people. Share one invite code — everyone
            joins free.
          </Text>
          {!canStartSettle ? (
            <Text style={[styles.cardHint, { color: colors.textSecondary }]}>
              Starting a group needs Plus.
            </Text>
          ) : null}
          <TextInput
            value={groupLabel}
            onChangeText={setGroupLabel}
            placeholder="Group name (e.g. Trip, Roommates)"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
            ]}
          />
          <Pressable
            disabled={busy !== null}
            onPress={() => {
              if (!canStartSettle) {
                Alert.alert(
                  'Plus plan required',
                  'Starting Group Settle needs Monentry Plus. Subscribe on the Me tab, or join free with an invite code below.',
                  [
                    { text: 'OK', style: 'cancel' },
                    { text: 'View plans', onPress: () => router.push('/(tabs)/me') },
                  ],
                );
                return;
              }
              run('create-group', async () => {
                const ledger = await createGroupInvite(groupLabel);
                setGroupLabel('');
                await shareInvite(ledger.inviteCode, true);
              });
            }}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy === 'create-group' ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Start group · up to {SETTLE_GROUP_MAX} people
                {!canStartSettle ? ' · Plus plan' : ''}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Have an invite code?</Text>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Enter code"
            autoCapitalize="characters"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
            ]}
          />
          <Pressable
            disabled={busy !== null || !joinCode.trim()}
            onPress={() =>
              run('join', async () => {
                const ledger = await acceptInvite(joinCode.trim());
                setJoinCode('');
                router.push(`/settle-ledger/${ledger.id}`);
              })
            }
            style={[styles.secondaryButton, { borderColor: colors.border, opacity: busy || !joinCode.trim() ? 0.6 : 1 }]}
          >
            {busy === 'join' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Join Settle</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  title: { fontSize: typography.title, fontWeight: '700' },
  desc: { fontSize: typography.body, lineHeight: 22 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '600' },
  cardHint: { fontSize: typography.caption, lineHeight: 18 },
  ledgerCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  ledgerName: { fontSize: typography.body, fontWeight: '600' },
  ledgerMeta: { fontSize: typography.caption },
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
  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: typography.body, fontWeight: '600' },
  inlineButton: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  inlineButtonText: { fontSize: typography.caption, fontWeight: '600' },
});
