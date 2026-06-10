import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_VERSION, PRIVACY_URL, SUPPORT_URL } from '../../src/constants/app';
import { SUBSCRIPTION_INFO } from '../../src/constants/categories';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { ThemePreference, useTheme } from '../../src/context/ThemeContext';
import { useTransactions } from '../../src/context/TransactionContext';
import { radius, spacing, typography } from '../../src/theme';
import { confirmClearAll } from '../../src/utils/confirmDelete';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', url);
  });
}

export default function MeScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const { clearAll } = useTransactions();
  const {
    user,
    tier,
    syncEnabled,
    syncing,
    firebaseReady,
    signOut,
    triggerSync,
  } = useAuth();
  const {
    revenueCatReady,
    offeringsLoading,
    purchasing,
    purchasePlus,
    purchaseFamily,
    restorePurchases,
  } = useSubscription();

  const planInfo = SUBSCRIPTION_INFO[tier];

  const handlePurchase = async (action: () => Promise<void>, label: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account before subscribing.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }

    try {
      await action();
      Alert.alert('Success', `${label} is now active.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Purchase failed', message);
      }
    }
  };

  const handleRestore = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in before restoring purchases.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }

    try {
      await restorePurchases();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Me</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Plan</Text>
          <View style={[styles.planBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.planName, { color: colors.primary }]}>{planInfo.label}</Text>
          </View>
          <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{planInfo.description}</Text>
          {syncEnabled && (
            <Text style={[styles.syncStatus, { color: colors.primary }]}>
              {syncing ? 'Syncing with cloud…' : 'Backed up to cloud'}
            </Text>
          )}
          {!syncEnabled && firebaseReady && (
            <Text style={[styles.syncStatus, { color: colors.accent }]}>
              Sign in to enable cloud backup
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!firebaseReady ? (
            <>
              <Text style={[styles.accountTitle, { color: colors.textPrimary }]}>Cloud sync unavailable</Text>
              <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                Firebase is not configured yet. Add your project keys to enable sign in and backup.
              </Text>
            </>
          ) : user ? (
            <>
              <Text style={[styles.accountTitle, { color: colors.textPrimary }]}>{user.email}</Text>
              <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                Your entries are saved to the cloud. Sign in on a new phone to restore the same data.
              </Text>
              <Pressable
                onPress={() => triggerSync().catch(() => Alert.alert('Sync failed', 'Try again in a moment.'))}
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  signOut().catch(() => Alert.alert('Sign out failed', 'Try again in a moment.'))
                }
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  Sign out
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.accountTitle, { color: colors.textPrimary }]}>Sign in to back up your data</Text>
              <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                Create a free account to save your entries to the cloud. On a new phone, sign in to get everything back.
              </Text>
              <Pressable
                onPress={() => router.push('/sign-in')}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Sign in</Text>
              </Pressable>
            </>
          )}
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
                <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>{option.label}</Text>
                {selected && <Text style={[styles.check, { color: colors.primary }]}>✓</Text>}
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
            Delete every expense and income entry on this device
            {syncEnabled ? ' and mark them deleted in the cloud' : ''}. Today and Summary will reset.
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upgrade</Text>
        {(['plus', 'family'] as const).map((upgradeTier) => {
          const isActive = tier === upgradeTier || (upgradeTier === 'plus' && tier === 'family');
          const isFamily = upgradeTier === 'family';

          return (
            <View
              key={upgradeTier}
              style={[styles.upgradeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.upgradeHeader}>
                <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                  {SUBSCRIPTION_INFO[upgradeTier].label}
                </Text>
                <Text style={[styles.upgradePrice, { color: colors.primary }]}>
                  {SUBSCRIPTION_INFO[upgradeTier].price}
                </Text>
              </View>
              <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
                {SUBSCRIPTION_INFO[upgradeTier].description}
              </Text>
              {isActive ? (
                <View style={[styles.activeBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.activeBadgeText, { color: colors.primary }]}>Active</Text>
                </View>
              ) : isFamily ? (
                <View style={[styles.comingSoon, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.comingSoonText, { color: colors.accent }]}>Coming soon</Text>
                </View>
              ) : (
                <Pressable
                  disabled={purchasing || offeringsLoading || !revenueCatReady}
                  onPress={() => handlePurchase(purchasePlus, 'Monentry Plus')}
                  style={[
                    styles.subscribeButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: purchasing || offeringsLoading || !revenueCatReady ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.subscribeButtonText, { color: colors.onPrimary }]}>
                    {purchasing
                      ? 'Processing…'
                      : !revenueCatReady
                        ? 'Billing not configured'
                        : 'Subscribe to Plus'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {revenueCatReady && (
          <Pressable
            disabled={purchasing}
            onPress={handleRestore}
            style={[styles.restoreButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
              Restore purchases
            </Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => openUrl(PRIVACY_URL)}
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>Privacy Policy</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>›</Text>
          </Pressable>
          <Pressable onPress={() => openUrl(SUPPORT_URL)} style={styles.linkRowLast}>
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>Support</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>›</Text>
          </Pressable>
          <Text style={[styles.version, { color: colors.textTertiary }]}>Monentry {APP_VERSION}</Text>
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
  syncStatus: {
    marginTop: spacing.sm,
    fontSize: typography.label,
    fontWeight: '600',
  },
  accountTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  accountDesc: {
    fontSize: typography.label,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
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
  activeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  activeBadgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  subscribeButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  restoreButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  restoreButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkLabel: {
    fontSize: typography.body,
  },
  linkArrow: {
    fontSize: typography.title,
  },
  version: {
    marginTop: spacing.md,
    fontSize: typography.caption,
  },
});
