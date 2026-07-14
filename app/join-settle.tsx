import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useSettle } from '../src/context/SettleContext';
import { useTheme } from '../src/context/ThemeContext';
import { spacing, typography } from '../src/theme';
import { parseSettleInviteCode } from '../src/utils/settleInviteLink';

export default function JoinSettleScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, authLoading } = useAuth();
  const { acceptInvite } = useSettle();
  const [message, setMessage] = useState('Joining Settle…');

  useEffect(() => {
    const raw = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    const inviteCode = parseSettleInviteCode(raw ?? '');

    if (!inviteCode) {
      router.replace('/(tabs)/settle');
      return;
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace('/sign-in');
      return;
    }

    acceptInvite(inviteCode)
      .then((ledger) => {
        router.replace(`/settle-ledger/${ledger.id}`);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Could not join Settle.');
        setTimeout(() => router.replace('/(tabs)/settle'), 2500);
      });
  }, [acceptInvite, authLoading, rawCode, router, user]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  message: { fontSize: typography.body, textAlign: 'center', paddingHorizontal: spacing.lg },
});
