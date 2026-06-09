import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { radius, spacing, typography } from '../src/theme';

type Mode = 'sign-in' | 'sign-up';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, '');
  }
  return 'Something went wrong. Please try again.';
}

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, signUp, resetPassword, firebaseReady } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.back();
    } catch (error) {
      Alert.alert(mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter email', 'Type your email address first, then tap reset password.');
      return;
    }

    try {
      await resetPassword(email);
      Alert.alert('Email sent', 'Check your inbox for a password reset link.');
    } catch (error) {
      Alert.alert('Reset failed', getErrorMessage(error));
    }
  };

  if (!firebaseReady) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Cloud not configured</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Add Firebase env vars to enable sign in and sync. See docs/FIREBASE_SETUP.md.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mode === 'sign-in'
              ? 'Back up and sync your entries across devices with Monentry Plus.'
              : 'Create an account to enable cloud backup when you upgrade to Plus.'}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            <Text style={[styles.link, { color: colors.primary }]}>
              {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </Text>
          </Pressable>

          {mode === 'sign-in' && (
            <Pressable onPress={handleResetPassword}>
              <Text style={[styles.link, { color: colors.textSecondary }]}>Forgot password?</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  close: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  link: {
    textAlign: 'center',
    fontSize: typography.label,
    fontWeight: '600',
  },
});
