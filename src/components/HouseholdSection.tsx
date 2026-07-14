import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InviteQrModal } from './InviteQrModal';
import { QrScannerModal } from './QrScannerModal';
import { SubscriptionTier } from '../constants/categories';
import {
  canCreateFamilyGroup,
  canCreatePartnerGroup,
  canCreateTeamGroup,
} from '../constants/subscriptionAccess';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import {
  HOUSEHOLD_LIMITS,
  familyGroupMemberLine,
  familyGroupSizeOption,
  familyGroupTitle,
} from '../types/household';
import { radius, spacing, typography } from '../theme';
import { buildHouseholdInviteLink } from '../utils/householdInviteLink';
import { consumePendingHouseholdInvite } from '../utils/pendingHouseholdInvite';

interface HouseholdSectionProps {
  signedIn: boolean;
  tier: SubscriptionTier;
  /** Render inside another card (no outer border/background). */
  embedded?: boolean;
}

const SIZE_OPTIONS = [
  {
    key: 'partner',
    maxMembers: HOUSEHOLD_LIMITS.partner,
    note: 'you + 1 other',
    planLabel: 'Plus plan',
    canCreate: canCreatePartnerGroup,
    createLabel: 'partner',
    alertTitle: 'Plus plan required',
    alertMessage: 'Family groups for 2 people need Monentry Plus. Subscribe under Plans on Me.',
    action: 'createPartnerGroup' as const,
  },
  {
    key: 'family',
    maxMembers: HOUSEHOLD_LIMITS.family,
    note: 'household or close group',
    planLabel: 'Family plan',
    canCreate: canCreateFamilyGroup,
    createLabel: 'family',
    alertTitle: 'Family plan required',
    alertMessage: 'Family groups for up to 10 people need Monentry Family. Subscribe under Plans on Me.',
    action: 'createFamilyGroup' as const,
  },
  {
    key: 'team',
    maxMembers: HOUSEHOLD_LIMITS.team,
    note: 'larger group',
    planLabel: 'Family plan',
    canCreate: canCreateTeamGroup,
    createLabel: 'team',
    alertTitle: 'Family plan required',
    alertMessage: 'Family groups for up to 25 people need Monentry Family. Subscribe under Plans on Me.',
    action: 'createTeamGroup' as const,
  },
] as const;

export function HouseholdSection({ signedIn, tier, embedded = false }: HouseholdSectionProps) {
  const { colors } = useTheme();
  const {
    household,
    members,
    loading,
    createPartnerGroup,
    createFamilyGroup,
    createTeamGroup,
    joinWithCode,
    leaveGroup,
    upgradeGroupToFamily,
  } = useHousehold();
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [groupExpanded, setGroupExpanded] = useState(true);
  const previousHouseholdId = useRef<string | null>(null);

  const createActions = {
    createPartnerGroup,
    createFamilyGroup,
    createTeamGroup,
  };

  useEffect(() => {
    const currentId = household?.id ?? null;
    const wasEmpty = !previousHouseholdId.current;
    const isNewGroup = wasEmpty && currentId && household?.memberCount === 1;

    if (isNewGroup) {
      setShowQr(true);
    }

    previousHouseholdId.current = currentId;
  }, [household]);

  useEffect(() => {
    if (!household) {
      setGroupExpanded(true);
      return;
    }

    const canExpand =
      household.mode === 'partner' &&
      household.maxMembers < HOUSEHOLD_LIMITS.family &&
      canCreateFamilyGroup(tier);

    if (canExpand || household.memberCount <= 1) {
      setGroupExpanded(true);
      return;
    }

    setGroupExpanded(false);
  }, [household?.id, household?.memberCount, household?.mode, household?.maxMembers, tier]);

  useEffect(() => {
    if (!signedIn || household) {
      return;
    }

    consumePendingHouseholdInvite().then(async (pendingCode) => {
      if (!pendingCode) {
        return;
      }

      setInviteCode(pendingCode);
      setBusy('join');
      try {
        await joinWithCode(pendingCode);
      } catch (error) {
        Alert.alert(
          'Could not join',
          error instanceof Error ? error.message : 'Try again in a moment.',
        );
      } finally {
        setBusy(null);
      }
    });
  }, [household, joinWithCode, signedIn]);

  if (!signedIn) {
    return null;
  }

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again in a moment.';
      Alert.alert(
        'Could not update family group',
        /permission/i.test(message)
          ? `${message}\n\nIf this keeps happening, ask the group owner to update Firestore rules (firebase deploy --only firestore:rules).`
          : message,
      );
    } finally {
      setBusy(null);
    }
  };

  const shareInviteCode = async () => {
    if (!household?.inviteCode) {
      return;
    }

    const message = `Join my Monentry family (${household.maxMembers} people max): ${buildHouseholdInviteLink(household.inviteCode)}`;
    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Invite code', household.inviteCode);
    }
  };

  const shellStyle = embedded
    ? styles.embeddedShell
    : [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (loading && !household) {
    return (
      <View style={shellStyle}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (household) {
    const waitingForMembers = members.length < household.maxMembers;
    const canExpandToFamily =
      household.mode === 'partner' &&
      household.maxMembers < HOUSEHOLD_LIMITS.family &&
      canCreateFamilyGroup(tier);
    const memberLine = familyGroupMemberLine(members.length, household.maxMembers);

    return (
      <View style={shellStyle}>
        <Pressable
          onPress={() => setGroupExpanded((open) => !open)}
          style={styles.groupHeader}
        >
          <View style={styles.groupHeaderText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {familyGroupTitle(household.maxMembers)}
            </Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              {memberLine}
              {waitingForMembers
                ? ' · invite people below'
                : canExpandToFamily
                  ? ' · full — expand below to add more'
                  : ' · everyone sees the same entries'}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textTertiary }]}>
            {groupExpanded ? '▾' : '▸'}
          </Text>
        </Pressable>

        {canExpandToFamily && (
          <>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              This family group fits {household.maxMembers} people. Your Family plan can expand it to{' '}
              {HOUSEHOLD_LIMITS.family} — same people, same entries.
            </Text>
            <Pressable
              onPress={() => runAction('expand', upgradeGroupToFamily)}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              {busy === 'expand' ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Expand to {HOUSEHOLD_LIMITS.family} people
                </Text>
              )}
            </Pressable>
          </>
        )}

        {groupExpanded && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>People</Text>
            {members.map((member) => (
              <Text key={member.uid} style={[styles.member, { color: colors.textPrimary }]}>
                {member.email}
                {member.role === 'owner' ? ' · started this family' : ''}
              </Text>
            ))}

            {waitingForMembers && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Add people
                </Text>
                <Text style={[styles.desc, { color: colors.textSecondary }]}>
                  Share the code or QR. They install Monentry, sign in, and join free — no subscription
                  needed.
                </Text>
                <View
                  style={[
                    styles.codeBox,
                    { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.codeLabel, { color: colors.primary }]}>Invite code</Text>
                  <Text style={[styles.code, { color: colors.textPrimary }]}>
                    {household.inviteCode}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setShowQr(true)}
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    Show QR code
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => runAction('share', shareInviteCode)}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                    Share link or code
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Leave family group?',
                  'Your device keeps its local copy. Shared cloud data stays with the group.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Leave',
                      style: 'destructive',
                      onPress: () => runAction('leave', leaveGroup),
                    },
                  ],
                )
              }
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                Leave family group
              </Text>
            </Pressable>
          </>
        )}

        <InviteQrModal
          visible={showQr}
          inviteCode={household.inviteCode}
          onClose={() => setShowQr(false)}
        />
      </View>
    );
  }

  return (
    <>
      <View style={shellStyle}>
        {!embedded ? (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Family</Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              Track expenses and income together with family. Pick how many people, then share an invite
              code. Joining is always free.
            </Text>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Start a family group</Text>

        {SIZE_OPTIONS.map((option, index) => {
          const allowed = option.canCreate(tier);
          const isPrimary = index === 0;

          return (
            <Pressable
              key={option.key}
              disabled={busy !== null}
              onPress={() => {
                if (!allowed) {
                  Alert.alert(option.alertTitle, option.alertMessage);
                  return;
                }
                runAction(option.createLabel, createActions[option.action]);
              }}
              style={[
                isPrimary ? styles.primaryButton : styles.secondaryButton,
                isPrimary
                  ? { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }
                  : { borderColor: colors.border, opacity: busy ? 0.7 : 1 },
              ]}
            >
              {busy === option.createLabel ? (
                <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
              ) : (
                <>
                  <Text
                    style={[
                      isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
                      { color: isPrimary ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {familyGroupSizeOption(option.maxMembers, option.note)}
                  </Text>
                  {!allowed && (
                    <Text
                      style={[
                        styles.planHint,
                        { color: isPrimary ? colors.onPrimary : colors.textSecondary },
                      ]}
                    >
                      {option.planLabel}
                    </Text>
                  )}
                </>
              )}
            </Pressable>
          );
        })}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Join a family group</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Someone shared a code with you? Enter it here or scan their QR.
        </Text>

        <Pressable
          disabled={busy !== null}
          onPress={() => setShowScanner(true)}
          style={[styles.secondaryButton, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Scan QR code</Text>
        </Pressable>

        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Invite code"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
        />
        <Pressable
          disabled={busy !== null || !inviteCode.trim()}
          onPress={() => runAction('join', () => joinWithCode(inviteCode))}
          style={[styles.secondaryButton, { borderColor: colors.border, opacity: busy || !inviteCode.trim() ? 0.6 : 1 }]}
        >
          {busy === 'join' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Join with code</Text>
          )}
        </Pressable>
      </View>

      <QrScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onCodeScanned={(code) => joinWithCode(code).then(() => undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  embeddedShell: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  chevron: {
    fontSize: typography.body,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  desc: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  member: {
    fontSize: typography.caption,
  },
  planHint: {
    fontSize: typography.caption,
    marginTop: 2,
    opacity: 0.85,
  },
  codeBox: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  codeLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    letterSpacing: 2,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
});
