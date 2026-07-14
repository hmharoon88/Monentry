import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useHousehold } from '../src/context/HouseholdContext';
import { useTheme } from '../src/context/ThemeContext';
import { spacing, typography } from '../src/theme';
import { parseHouseholdInviteCode } from '../src/utils/householdInviteLink';
import { setPendingHouseholdInvite } from '../src/utils/pendingHouseholdInvite';

export default function JoinHouseholdScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, authLoading } = useAuth();
  const { joinWithCode, household } = useHousehold();
  const [message, setMessage] = useState('Joining group…');

  useEffect(() => {
    const raw = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    const inviteCode = parseHouseholdInviteCode(raw ?? '');

    if (!inviteCode) {
      router.replace('/(tabs)/me');
      return;
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      void setPendingHouseholdInvite(inviteCode).then(() => {
        router.replace('/sign-in');
      });
      return;
    }

    if (household) {
      router.replace('/(tabs)/me');
      return;
    }

    joinWithCode(inviteCode)
      .then(() => router.replace('/(tabs)/me'))
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Could not join group.');
        setTimeout(() => router.replace('/(tabs)/me'), 2000);
      });
  }, [authLoading, household, joinWithCode, rawCode, router, user]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: {
    fontSize: typography.body,
    textAlign: 'center',
  },
});
