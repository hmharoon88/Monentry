import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InviteQrModal } from './InviteQrModal';
import { QrScannerModal } from './QrScannerModal';
import {
  canCreateFamilyGroup,
  canCreatePartnerGroup,
} from '../constants/subscriptionAccess';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { familyGroupMemberLine, HOUSEHOLD_LIMITS } from '../types/household';
import { radius, spacing, typography } from '../theme';
import { buildHouseholdInviteLink } from '../utils/householdInviteLink';

/** Small + control for Today header — opens invite/join dialog when subscribed. */
export function TodaySharingButton() {
  const { colors } = useTheme();
  const { user, tier, firebaseReady } = useAuth();
  const {
    household,
    members,
    createPartnerGroup,
    createFamilyGroup,
    joinWithCode,
  } = useHousehold();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrInviteCode, setQrInviteCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const isSubscribed = tier === 'plus' || tier === 'family';
  const groupFull = household ? members.length >= household.maxMembers : false;

  if (!user || !firebaseReady || !isSubscribed) {
    return null;
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(
        'Could not update group',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setJoinCode('');
  };

  const openShowQr = (code: string) => {
    setQrInviteCode(code);
    setDialogOpen(false);
    setShowQr(true);
  };

  const openScanner = () => {
    setDialogOpen(false);
    setShowScanner(true);
  };

  const closeShowQr = () => {
    setShowQr(false);
    setQrInviteCode('');
  };

  const closeScanner = () => {
    setShowScanner(false);
  };

  const handleJoinCode = async (code: string) => {
    await joinWithCode(code);
    closeDialog();
    closeScanner();
  };

  const shareInvite = async () => {
    if (!household?.inviteCode) {
      return;
    }

    const message = `Join my Monentry group (${household.maxMembers} people max): ${buildHouseholdInviteLink(household.inviteCode)}`;
    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Invite code', household.inviteCode);
    }
  };

  const statusLine = household
    ? groupFull
      ? `${familyGroupMemberLine(members.length, household.maxMembers)} · group full`
      : familyGroupMemberLine(members.length, household.maxMembers)
    : 'Start a group or join with a code';

  const joinSection = (
    <>
      <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Join with a code</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Someone shared a code with you? Enter it below or scan their QR. Joining is free.
      </Text>
      <Pressable
        disabled={busy}
        onPress={openScanner}
        style={[styles.secondaryButton, { borderColor: colors.border }]}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
          Scan QR code
        </Text>
      </Pressable>
      <TextInput
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Enter invite code"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
      />
      <Pressable
        disabled={busy || !joinCode.trim()}
        onPress={() =>
          run(async () => {
            await joinWithCode(joinCode);
            closeDialog();
          })
        }
        style={[
          styles.primaryButton,
          {
            backgroundColor: colors.primary,
            opacity: busy || !joinCode.trim() ? 0.6 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Join group</Text>
        )}
      </Pressable>
    </>
  );

  return (
    <>
      <Pressable
        accessibilityLabel="Share or join a group"
        onPress={() => setDialogOpen(true)}
        style={[styles.plusButton, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
      >
        <Text style={[styles.plusIcon, { color: colors.primary }]}>+</Text>
      </Pressable>

      <Modal
        visible={dialogOpen}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeDialog}
      >
        <Pressable style={styles.backdrop} onPress={closeDialog}>
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>Share or join</Text>
            <Text style={[styles.dialogSubtitle, { color: colors.textSecondary }]}>{statusLine}</Text>

            <ScrollView style={styles.dialogBody} keyboardShouldPersistTaps="handled">
              {household?.inviteCode ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Share your invite
                  </Text>
                  <Text style={[styles.code, { color: colors.textPrimary }]}>
                    {household.inviteCode}
                  </Text>
                  {groupFull ? (
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                      Your group is full. Share this code so others can join you.
                    </Text>
                  ) : (
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                      Share this code or QR. Joining is free — no subscription needed.
                    </Text>
                  )}
                  <View style={styles.row}>
                    <Pressable
                      disabled={busy}
                      onPress={() => household?.inviteCode && openShowQr(household.inviteCode)}
                      style={[styles.primaryButton, { backgroundColor: colors.primary, flex: 1 }]}
                    >
                      <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                        Show QR
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => run(shareInvite)}
                      style={[styles.secondaryButton, { borderColor: colors.border, flex: 1 }]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                          Share
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Share · start a group
                  </Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    Create a group to get an invite code you can share.
                  </Text>
                  {canCreatePartnerGroup(tier) ? (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          const created = await createPartnerGroup();
                          openShowQr(created.inviteCode);
                        })
                      }
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                          Partner · 2 people
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                  {canCreateFamilyGroup(tier) ? (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          const created = await createFamilyGroup();
                          openShowQr(created.inviteCode);
                        })
                      }
                      style={[styles.secondaryButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                        Family · up to {HOUSEHOLD_LIMITS.family} people
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {joinSection}
            </ScrollView>

            <Pressable
              onPress={closeDialog}
              style={[styles.closeButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <InviteQrModal visible={showQr} inviteCode={qrInviteCode} onClose={closeShowQr} />

      <QrScannerModal
        visible={showScanner}
        onClose={closeScanner}
        onCodeScanned={async (code) => {
          try {
            await handleJoinCode(code);
          } catch (error) {
            Alert.alert(
              'Could not join group',
              error instanceof Error ? error.message : 'Try again in a moment.',
            );
            throw error;
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    maxHeight: '80%',
    gap: spacing.sm,
  },
  dialogTitle: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  dialogSubtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  dialogBody: {
    maxHeight: 360,
  },
  sectionLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  hint: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  code: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  closeButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
});
