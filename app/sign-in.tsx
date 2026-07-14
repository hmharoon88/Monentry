import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialSignInButtons } from '../src/components/SocialSignInButtons';
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

function isVerificationError(message: string): boolean {
  return /confirm your email|email is already verified|verification/i.test(message);
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder: string;
  textContentType: 'password' | 'newPassword' | 'oneTimeCode';
  colors: ReturnType<typeof useTheme>['colors'];
}

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisible,
  placeholder,
  textContentType,
  colors,
}: PasswordFieldProps) {
  return (
    <View style={styles.passwordField}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.passwordRow, { borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          textContentType={textContentType}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={[styles.passwordInput, { color: colors.textPrimary }]}
        />
        <Pressable
          onPress={onToggleVisible}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Text style={[styles.showPassword, { color: colors.primary }]}>
            {visible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    signIn,
    signUp,
    resetPassword,
    resendVerificationEmail,
    signInWithApple,
    signInWithGoogleIdToken,
    firebaseReady,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationHint, setVerificationHint] = useState(false);

  const finishAuth = useCallback(() => {
    router.back();
  }, [router]);

  const switchMode = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setVerificationHint(false);
  }, []);

  const handleAuthError = useCallback((title: string, error: unknown) => {
    const message = getErrorMessage(error);
    if (message.toLowerCase().includes('cancel')) {
      return;
    }
    if (isVerificationError(message)) {
      setVerificationHint(true);
    }
    Alert.alert(title, message);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    if (mode === 'sign-up') {
      if (password.length < 6) {
        Alert.alert('Password too short', 'Use at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Make sure both password fields match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
        setVerificationHint(false);
        finishAuth();
      } else {
        await signUp(email, password);
        switchMode('sign-in');
        Alert.alert(
          'Confirm your email',
          `We sent a verification link to ${email.trim()}.\n\nOpen it, then come back and sign in.`,
        );
      }
    } catch (error) {
      handleAuthError(mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', error);
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

  const handleResendVerification = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Enter email and password', 'Use the same email and password you signed up with.');
      return;
    }

    setSubmitting(true);
    try {
      await resendVerificationEmail(email, password);
      Alert.alert('Email sent', 'Check your inbox for a new verification link.');
    } catch (error) {
      handleAuthError('Could not resend', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApple = useCallback(async () => {
    try {
      await signInWithApple();
      finishAuth();
    } catch (error) {
      handleAuthError('Apple sign in failed', error);
      throw error;
    }
  }, [finishAuth, handleAuthError, signInWithApple]);

  const handleGoogle = useCallback(
    async (idToken: string) => {
      try {
        await signInWithGoogleIdToken(idToken);
        finishAuth();
      } catch (error) {
        handleAuthError('Google sign in failed', error);
        throw error;
      }
    },
    [finishAuth, handleAuthError, signInWithGoogleIdToken],
  );

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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                ? 'Sign in to restore your entries on this device, or pick up where you left off on a new phone.'
                : 'Create a free account to back up your entries. We will email you a confirmation link before you can sign in.'}
            </Text>

            <SocialSignInButtons
              onAppleSignIn={handleApple}
              onGoogleIdToken={handleGoogle}
              disabled={submitting}
            />

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@gmail.com · @icloud.com · @hotmail.com"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              />

              <PasswordField
                label="Password"
                value={password}
                onChangeText={setPassword}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((current) => !current)}
                placeholder="At least 6 characters"
                textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
                colors={colors}
              />

              {mode === 'sign-up' && (
                <PasswordField
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((current) => !current)}
                  placeholder="Re-enter your password"
                  textContentType="newPassword"
                  colors={colors}
                />
              )}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  {mode === 'sign-in' ? 'Sign in with email' : 'Create account with email'}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
              <Text style={[styles.link, { color: colors.primary }]}>
                {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </Text>
            </Pressable>

            {mode === 'sign-in' && (
              <>
                <Pressable onPress={handleResetPassword}>
                  <Text style={[styles.link, { color: colors.textSecondary }]}>Forgot password?</Text>
                </Pressable>
                {(verificationHint || email.length > 0) && (
                  <Pressable onPress={handleResendVerification} disabled={submitting}>
                    <Text style={[styles.link, { color: colors.textSecondary }]}>
                      Resend verification email
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
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
  passwordField: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  showPassword: {
    fontSize: typography.label,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
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
