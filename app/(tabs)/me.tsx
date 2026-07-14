import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HouseholdSection } from '../../src/components/HouseholdSection';
import { SubscriptionDisclosure } from '../../src/components/SubscriptionDisclosure';
import { getAppVersionLabel, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../../src/constants/app';
import { SUBSCRIPTION_INFO, SubscriptionTier } from '../../src/constants/categories';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { ThemePreference, useTheme } from '../../src/context/ThemeContext';
import { useTransactions } from '../../src/context/TransactionContext';
import { radius, spacing, typography } from '../../src/theme';
import { confirmClearAll, confirmDeleteAccount } from '../../src/utils/confirmDelete';
import { getAccountDisplay } from '../../src/utils/accountDisplay';

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

function plusSubscribeLabel(
  purchasing: boolean,
  offeringsLoading: boolean,
  revenueCatReady: boolean,
  plusPackage: unknown,
  plusPriceLabel: string | null,
  billingError: string | null,
): string {
  if (purchasing) {
    return 'Processing…';
  }
  if (offeringsLoading) {
    return 'Loading price…';
  }
  if (!revenueCatReady) {
    return 'Billing not configured';
  }
  if (plusPackage) {
    return `Subscribe · ${plusPriceLabel ?? SUBSCRIPTION_INFO.plus.price}`;
  }
  if (billingError?.includes('App Store products')) {
    return 'App Store plans not wired yet';
  }
  if (billingError?.includes('Invalid RevenueCat')) {
    return 'Invalid billing key';
  }
  return 'Plus plan not available yet';
}

function familySubscribeLabel(
  purchasing: boolean,
  offeringsLoading: boolean,
  revenueCatReady: boolean,
  familyPriceLabel: string | null,
  billingError: string | null,
): string {
  if (purchasing) {
    return 'Processing…';
  }
  if (offeringsLoading) {
    return 'Loading price…';
  }
  if (!revenueCatReady) {
    return 'Billing not configured';
  }
  if (familyPriceLabel) {
    return `Subscribe · ${familyPriceLabel ?? SUBSCRIPTION_INFO.family.price}`;
  }
  if (billingError?.includes('App Store products')) {
    return 'App Store plans not wired yet';
  }
  if (billingError?.includes('Invalid RevenueCat')) {
    return 'Invalid billing key';
  }
  return 'Family plan not available yet';
}

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>;
}

function PlanSubsectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.planSubsectionHeader}>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.planSubsectionSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function sharingSubtitle(tier: SubscriptionTier): string {
  if (tier === 'plus') {
    return 'Start a 2-person group or join with a code — joining is free.';
  }
  if (tier === 'family') {
    return 'Groups up to 10 or 25 people. Joining is free for invitees.';
  }
  return 'Join someone\'s group with a code, or subscribe on Plans to start your own.';
}

export default function MeScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const { clearAll } = useTransactions();
  const {
    user,
    profile,
    tier,
    syncEnabled,
    syncing,
    firebaseReady,
    signOut,
    triggerSync,
    deleteAccount,
  } = useAuth();
  const {
    revenueCatReady,
    billingBlockedReason,
    billingError,
    offeringsLoading,
    offeringsAvailable,
    purchasing,
    plusPackage,
    familyPackage,
    plusPriceLabel,
    familyPriceLabel,
    purchasePlus,
    purchaseFamily,
    restorePurchases,
    manageSubscriptions,
    refreshSubscriptionTier,
    canManageSubscriptions,
    usesTestStoreBilling,
    subscriptionSetupHint,
  } = useSubscription();

  const planInfo = SUBSCRIPTION_INFO[tier];
  const accountDisplay = user ? getAccountDisplay(user, profile?.displayName) : null;
  const isSubscribed = tier === 'plus' || tier === 'family';
  const showPlansCards = tier === 'free';
  const showBillingSection = revenueCatReady;
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [subscriptionExpanded, setSubscriptionExpanded] = useState(false);
  const [sharingExpanded, setSharingExpanded] = useState(false);
  const showSharingSection = Boolean(user) && firebaseReady;

  const handleDeleteAccount = () => {
    confirmDeleteAccount(async () => {
      setDeletingAccount(true);
      try {
        await deleteAccount();
        await clearAll();
        Alert.alert('Account deleted', 'Your Monentry account has been removed.');
      } catch (error) {
        Alert.alert(
          'Could not delete account',
          error instanceof Error ? error.message : 'Try again in a moment.',
        );
      } finally {
        setDeletingAccount(false);
      }
    });
  };

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

  const showStopSubscriptionHelp = () => {
    Alert.alert(
      usesTestStoreBilling ? 'Stop subscription (Test Store)' : 'Return to Free',
      usesTestStoreBilling
        ? 'This dev build uses RevenueCat Test Store, not Apple billing.\n\nTo go back to Free while testing:\n1. RevenueCat → Customers → find your account\n2. Revoke the plus or family entitlement\n3. Tap Refresh plan status below'
        : 'To return to Free, cancel your subscription in Apple\'s screen. You keep Plus or Family until the end of the current billing period, then Monentry moves you to Free automatically.',
      [{ text: 'OK' }],
    );
  };

  const handleManageSubscription = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to manage your subscription.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }

    if (usesTestStoreBilling) {
      showStopSubscriptionHelp();
      return;
    }

    try {
      await manageSubscriptions();
    } catch (error) {
      Alert.alert(
        'Could not open subscriptions',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  };

  const handleRefreshPlanStatus = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to refresh your plan.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }

    try {
      const activeTier = await refreshSubscriptionTier();
      const label = SUBSCRIPTION_INFO[activeTier].label;
      Alert.alert('Plan updated', `Your plan is now ${label}.`);
    } catch (error) {
      Alert.alert(
        'Refresh failed',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Me</Text>

        {/* Profile + account */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.planBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.planName, { color: colors.primary }]}>{planInfo.label}</Text>
            </View>
            {accountDisplay ? (
              <View style={styles.emailBlock}>
                <Text style={[styles.email, { color: colors.textPrimary }]} numberOfLines={1}>
                  {accountDisplay.title}
                </Text>
                {accountDisplay.subtitle ? (
                  <Text style={[styles.emailSubtitle, { color: colors.textTertiary }]} numberOfLines={2}>
                    {accountDisplay.subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{planInfo.description}</Text>

          {syncEnabled ? (
            <Text style={[styles.syncStatus, { color: colors.primary }]}>
              {syncing ? 'Syncing with cloud…' : 'Backed up to cloud'}
            </Text>
          ) : firebaseReady ? (
            <Text style={[styles.syncStatus, { color: colors.accent }]}>
              Sign in to enable cloud backup
            </Text>
          ) : (
            <Text style={[styles.syncStatus, { color: colors.textSecondary }]}>
              Cloud sync not configured
            </Text>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {!firebaseReady ? (
            <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
              Add Firebase keys to enable sign in and backup.
            </Text>
          ) : (
            <>
              {!user ? (
                <>
                  <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                    Create a free account to back up entries and use them on another phone.
                  </Text>
                  <Pressable
                    onPress={() => router.push('/sign-in')}
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      Sign in
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                onPress={() => setAccountExpanded((open) => !open)}
                style={[styles.accountHeader, !user && styles.accountHeaderSpaced]}
              >
                <Text style={[styles.accountHeaderLabel, { color: colors.textPrimary }]}>
                  Account
                </Text>
                <Text style={[styles.chevron, { color: colors.textTertiary }]}>
                  {accountExpanded ? '▾' : '▸'}
                </Text>
              </Pressable>

              {accountExpanded && (
                <View style={styles.accountActions}>
                  {user ? (
                    <>
                      <Pressable
                        onPress={() =>
                          triggerSync().catch(() =>
                            Alert.alert('Sync failed', 'Try again in a moment.'),
                          )
                        }
                        style={[styles.rowButton, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.rowButtonText, { color: colors.primary }]}>
                          {syncing ? 'Syncing…' : 'Sync now'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          signOut().catch(() =>
                            Alert.alert('Sign out failed', 'Try again in a moment.'),
                          )
                        }
                        style={[styles.rowButton, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.rowButtonText, { color: colors.textPrimary }]}>
                          Sign out
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmClearAll(clearAll)}
                        style={[styles.rowButton, { borderColor: colors.expense }]}
                      >
                        <Text style={[styles.rowButtonText, { color: colors.expense }]}>
                          Clear all data
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={deletingAccount}
                        onPress={handleDeleteAccount}
                        style={[
                          styles.rowButton,
                          { borderColor: colors.expense, opacity: deletingAccount ? 0.6 : 1 },
                        ]}
                      >
                        <Text style={[styles.rowButtonText, { color: colors.expense }]}>
                          {deletingAccount ? 'Deleting account…' : 'Delete account'}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => confirmClearAll(clearAll)}
                      style={[styles.rowButton, { borderColor: colors.expense }]}
                    >
                      <Text style={[styles.rowButtonText, { color: colors.expense }]}>
                        Clear all data
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Plans & billing */}
        {showBillingSection ? (
          <>
            {showPlansCards ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => setSubscriptionExpanded((open) => !open)}
                  style={styles.accountHeader}
                >
                  <View style={styles.collapsibleHeaderText}>
                    <Text style={[styles.accountHeaderLabel, { color: colors.textPrimary }]}>
                      Plans
                    </Text>
                    {!subscriptionExpanded ? (
                      <Text style={[styles.collapsibleSubtitle, { color: colors.textSecondary }]}>
                        Plus and Family
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.chevron, { color: colors.textTertiary }]}>
                    {subscriptionExpanded ? '▾' : '▸'}
                  </Text>
                </Pressable>

                {subscriptionExpanded ? (
                  <View style={styles.accountActions}>
                    <PlanSubsectionHeader
                      title="Choose a plan"
                      subtitle="Subscribe for cloud sharing and Settle invites."
                    />
                    <View style={styles.upgradeHeader}>
                      <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                        {SUBSCRIPTION_INFO.plus.appleTitle}
                      </Text>
                      <Text style={[styles.upgradePrice, { color: colors.primary }]}>
                        {plusPriceLabel ?? SUBSCRIPTION_INFO.plus.price}
                      </Text>
                    </View>
                    <Text style={[styles.planMeta, { color: colors.textTertiary }]}>
                      {SUBSCRIPTION_INFO.plus.duration}
                    </Text>
                    <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
                      {SUBSCRIPTION_INFO.plus.description}
                    </Text>
                    <Pressable
                      disabled={purchasing || offeringsLoading || !revenueCatReady || !plusPackage}
                      onPress={() => handlePurchase(purchasePlus, 'Monentry Plus')}
                      style={[
                        styles.subscribeButton,
                        {
                          backgroundColor: colors.primary,
                          opacity:
                            purchasing || offeringsLoading || !revenueCatReady || !plusPackage
                              ? 0.6
                              : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.subscribeButtonText, { color: colors.onPrimary }]}>
                        {plusSubscribeLabel(
                          purchasing,
                          offeringsLoading,
                          revenueCatReady,
                          plusPackage,
                          plusPriceLabel,
                          billingError,
                        )}
                      </Text>
                    </Pressable>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.upgradeHeader}>
                      <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                        {SUBSCRIPTION_INFO.family.appleTitle}
                      </Text>
                      <Text style={[styles.upgradePrice, { color: colors.primary }]}>
                        {offeringsLoading ? '…' : (familyPriceLabel ?? '—')}
                      </Text>
                    </View>
                    <Text style={[styles.planMeta, { color: colors.textTertiary }]}>
                      {SUBSCRIPTION_INFO.family.duration}
                    </Text>
                    <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
                      {SUBSCRIPTION_INFO.family.description}
                    </Text>
                    <Pressable
                      disabled={
                        purchasing ||
                        offeringsLoading ||
                        !revenueCatReady ||
                        (!offeringsLoading && !familyPriceLabel)
                      }
                      onPress={() => handlePurchase(purchaseFamily, 'Monentry Family')}
                      style={[
                        styles.subscribeButton,
                        {
                          backgroundColor: colors.primary,
                          opacity:
                            purchasing ||
                            offeringsLoading ||
                            !revenueCatReady ||
                            (!offeringsLoading && !familyPriceLabel)
                              ? 0.6
                              : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.subscribeButtonText, { color: colors.onPrimary }]}>
                        {familySubscribeLabel(
                          purchasing,
                          offeringsLoading,
                          revenueCatReady,
                          familyPriceLabel,
                          billingError,
                        )}
                      </Text>
                    </Pressable>

                    {subscriptionSetupHint && !offeringsLoading ? (
                      <Text style={[styles.setupHint, { color: colors.textSecondary }]}>
                        {subscriptionSetupHint}
                      </Text>
                    ) : null}

                    {!revenueCatReady && billingBlockedReason ? (
                      <Text style={[styles.billingError, { color: colors.expense }]}>
                        {billingBlockedReason}
                      </Text>
                    ) : null}
                    {revenueCatReady && billingError ? (
                      <Text style={[styles.billingError, { color: colors.expense }]}>
                        {billingError}
                      </Text>
                    ) : null}

                    <Pressable
                      disabled={purchasing}
                      onPress={handleRestore}
                      style={[styles.restoreButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                        Restore purchases
                      </Text>
                    </Pressable>
                    <SubscriptionDisclosure
                      colors={colors}
                      plusPriceLabel={plusPriceLabel}
                      familyPriceLabel={familyPriceLabel}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {isSubscribed && canManageSubscriptions ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => setSubscriptionExpanded((open) => !open)}
                  style={styles.accountHeader}
                >
                  <View style={styles.collapsibleHeaderText}>
                    <Text style={[styles.accountHeaderLabel, { color: colors.textPrimary }]}>
                      Subscription
                    </Text>
                    {!subscriptionExpanded ? (
                      <Text style={[styles.collapsibleSubtitle, { color: colors.textSecondary }]}>
                        {planInfo.label} · billing only
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.chevron, { color: colors.textTertiary }]}>
                    {subscriptionExpanded ? '▾' : '▸'}
                  </Text>
                </Pressable>

                {subscriptionExpanded ? (
                  <View style={styles.accountActions}>
                    <PlanSubsectionHeader
                      title="Manage plan"
                      subtitle="Switch plans or return to Free through Apple. Downgrades apply at period end."
                    />

                  <View style={styles.planOptionRow}>
                    <View style={styles.planOptionBody}>
                      <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                        {SUBSCRIPTION_INFO.plus.label}
                      </Text>
                      <Text style={[styles.planOptionPrice, { color: colors.primary }]}>
                        {plusPriceLabel ?? SUBSCRIPTION_INFO.plus.price}
                      </Text>
                      <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
                        {SUBSCRIPTION_INFO.plus.description}
                      </Text>
                    </View>
                    {tier === 'plus' ? (
                      <View style={[styles.currentPlanBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.currentPlanBadgeText, { color: colors.primary }]}>
                          Current
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.planOptionHint, { color: colors.textTertiary }]}>
                        Switch via cancel below
                      </Text>
                    )}
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.planOptionRow}>
                    <View style={styles.planOptionBody}>
                      <Text style={[styles.upgradeName, { color: colors.textPrimary }]}>
                        {SUBSCRIPTION_INFO.family.label}
                      </Text>
                      <Text style={[styles.planOptionPrice, { color: colors.primary }]}>
                        {familyPriceLabel ?? SUBSCRIPTION_INFO.family.price}
                      </Text>
                      <Text style={[styles.upgradeDesc, { color: colors.textSecondary }]}>
                        {SUBSCRIPTION_INFO.family.description}
                      </Text>
                    </View>
                    {tier === 'family' ? (
                      <View style={[styles.currentPlanBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.currentPlanBadgeText, { color: colors.primary }]}>
                          Current
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        disabled={
                          purchasing ||
                          offeringsLoading ||
                          !familyPackage ||
                          (!offeringsLoading && !familyPriceLabel)
                        }
                        onPress={() => handlePurchase(purchaseFamily, 'Monentry Family')}
                        style={[
                          styles.planSwitchButton,
                          {
                            backgroundColor: colors.primary,
                            opacity:
                              purchasing ||
                              offeringsLoading ||
                              !familyPackage ||
                              (!offeringsLoading && !familyPriceLabel)
                                ? 0.6
                                : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.planSwitchButtonText, { color: colors.onPrimary }]}>
                          Upgrade
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <PlanSubsectionHeader
                    title="Billing"
                    subtitle={
                      usesTestStoreBilling
                        ? 'Dev build: stop the test subscription in RevenueCat, then refresh.'
                        : 'Cancel through Apple to return to Free at the end of the billing period.'
                    }
                  />
                  <Pressable
                    disabled={purchasing}
                    onPress={handleManageSubscription}
                    style={[styles.restoreButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.restoreButtonText, { color: colors.textPrimary }]}>
                      {usesTestStoreBilling
                        ? `Stop ${planInfo.label} (testing)`
                        : 'Cancel or change plan'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={purchasing}
                    onPress={handleRefreshPlanStatus}
                    style={[styles.restoreButton, { borderColor: colors.border, marginTop: spacing.sm }]}
                  >
                    <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                      Refresh plan status
                    </Text>
                  </Pressable>

                    <Pressable
                      disabled={purchasing}
                      onPress={handleRestore}
                      style={[styles.restoreButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                        Restore purchases
                      </Text>
                    </Pressable>
                    <SubscriptionDisclosure
                      colors={colors}
                      plusPriceLabel={plusPriceLabel}
                      familyPriceLabel={familyPriceLabel}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {showSharingSection ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setSharingExpanded((open) => !open)}
              style={styles.accountHeader}
            >
              <View style={styles.collapsibleHeaderText}>
                <Text style={[styles.accountHeaderLabel, { color: colors.textPrimary }]}>
                  Sharing
                </Text>
                {!sharingExpanded ? (
                  <Text style={[styles.collapsibleSubtitle, { color: colors.textSecondary }]}>
                    Partner & family groups
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>
                {sharingExpanded ? '▾' : '▸'}
              </Text>
            </Pressable>

            {sharingExpanded ? (
              <View style={styles.accountActions}>
                <PlanSubsectionHeader
                  title="Shared expenses"
                  subtitle={sharingSubtitle(tier)}
                />
                <HouseholdSection signedIn embedded tier={tier} />

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <PlanSubsectionHeader
                  title="Settle (lend & borrow)"
                  subtitle="Track who owes whom with friends — use the Settle tab. Starting Settle invites needs Plus."
                />
                <Pressable
                  onPress={() => router.push('/(tabs)/settle')}
                  style={[styles.restoreButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.restoreButtonText, { color: colors.textPrimary }]}>
                    Open Settle tab
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Settings */}
        <SectionHeader title="Settings" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Appearance</Text>
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

        {/* About */}
        <SectionHeader title="About" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => openUrl(PRIVACY_URL)}
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>Privacy Policy</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => openUrl(TERMS_URL)}
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>Terms of Use</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>›</Text>
          </Pressable>
          <Pressable onPress={() => openUrl(SUPPORT_URL)} style={styles.linkRowLast}>
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>Support</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>›</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.versionFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.version, { color: colors.textTertiary }]}>
          Monentry {getAppVersionLabel()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.label,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  cardLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  planBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  planName: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  emailBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  email: {
    fontSize: typography.label,
    fontWeight: '600',
    textAlign: 'right',
  },
  emailSubtitle: {
    fontSize: typography.caption,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'right',
  },
  planDesc: {
    fontSize: typography.label,
    lineHeight: 20,
  },
  syncStatus: {
    marginTop: spacing.sm,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  accountDesc: {
    fontSize: typography.label,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountHeaderSpaced: {
    marginTop: spacing.md,
  },
  accountHeaderLabel: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  collapsibleHeaderText: {
    flex: 1,
    gap: 2,
  },
  collapsibleSubtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  planSubsectionHeader: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  planSubsectionSubtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  chevron: {
    fontSize: typography.body,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  accountActions: {
    gap: spacing.sm,
  },
  rowButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  rowButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
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
  upgradeNote: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginBottom: spacing.sm,
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
  planOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  planOptionBody: {
    flex: 1,
    gap: spacing.xs,
  },
  planOptionPrice: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  planOptionHint: {
    fontSize: typography.caption,
    lineHeight: 18,
    maxWidth: 96,
    textAlign: 'right',
  },
  currentPlanBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  currentPlanBadgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  planSwitchButton: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  planSwitchButtonText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  restoreButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  restoreButtonText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  billingError: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  setupHint: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  planMeta: {
    fontSize: typography.caption,
    marginBottom: spacing.xs,
  },
  subscriptionTerms: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
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
  versionFooter: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  version: {
    fontSize: typography.caption,
  },
});
