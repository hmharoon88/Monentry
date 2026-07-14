import * as Linking from 'expo-linking';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from '../constants/app';
import { SUBSCRIPTION_INFO } from '../constants/categories';
import { ThemeColors } from '../theme/colors';
import { spacing, typography } from '../theme';

interface PlanLineProps {
  title: string;
  duration: string;
  priceLabel: string | null;
  fallbackPrice: string;
  colors: ThemeColors;
}

function PlanLine({ title, duration, priceLabel, fallbackPrice, colors }: PlanLineProps) {
  const price = priceLabel ?? fallbackPrice;

  return (
    <Text style={[styles.planLine, { color: colors.textSecondary }]}>
      <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
      {' · '}
      {duration}
      {' · '}
      {price}
    </Text>
  );
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', url);
  });
}

interface SubscriptionDisclosureProps {
  colors: ThemeColors;
  plusPriceLabel: string | null;
  familyPriceLabel: string | null;
  showPlanSummaries?: boolean;
}

export function SubscriptionDisclosure({
  colors,
  plusPriceLabel,
  familyPriceLabel,
  showPlanSummaries = true,
}: SubscriptionDisclosureProps) {
  return (
    <View style={styles.container}>
      {showPlanSummaries ? (
        <View style={styles.planList}>
          <PlanLine
            title={SUBSCRIPTION_INFO.plus.appleTitle}
            duration={SUBSCRIPTION_INFO.plus.duration}
            priceLabel={plusPriceLabel}
            fallbackPrice={SUBSCRIPTION_INFO.plus.price}
            colors={colors}
          />
          <PlanLine
            title={SUBSCRIPTION_INFO.family.appleTitle}
            duration={SUBSCRIPTION_INFO.family.duration}
            priceLabel={familyPriceLabel}
            fallbackPrice={SUBSCRIPTION_INFO.family.price}
            colors={colors}
          />
        </View>
      ) : null}

      <Text style={[styles.renewalText, { color: colors.textTertiary }]}>
        Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions
        automatically renew unless canceled at least 24 hours before the end of the current period.
        Your account is charged for renewal within 24 hours before the end of the current period.
        Manage or cancel subscriptions in your Apple ID account settings.
      </Text>

      <View style={styles.legalLinks}>
        <Pressable onPress={() => openUrl(PRIVACY_URL)} hitSlop={8}>
          <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy Policy</Text>
        </Pressable>
        <Text style={[styles.legalSeparator, { color: colors.textTertiary }]}>·</Text>
        <Pressable onPress={() => openUrl(TERMS_URL)} hitSlop={8}>
          <Text style={[styles.legalLink, { color: colors.primary }]}>Terms of Use (EULA)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planList: {
    gap: spacing.xs,
  },
  planLine: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  renewalText: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  legalLink: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  legalSeparator: {
    fontSize: typography.caption,
  },
});
