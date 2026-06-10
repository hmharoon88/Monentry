import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';

export function BackupBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, firebaseReady, syncEnabled } = useAuth();

  if (!firebaseReady || user || syncEnabled) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push('/sign-in')}
      style={[styles.banner, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
    >
      <Text style={[styles.title, { color: colors.primary }]}>Back up your data</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Sign in to save your entries to the cloud. On a new phone, sign in to restore everything.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.label,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
