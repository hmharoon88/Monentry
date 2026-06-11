import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getGoogleClientIds, isGoogleSignInConfigured } from '../config/google';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { isAppleSignInAvailable } from '../auth/socialAuth';

WebBrowser.maybeCompleteAuthSession();

interface SocialSignInButtonsProps {
  onGoogleIdToken: (idToken: string) => Promise<void>;
  onAppleSignIn?: () => Promise<void>;
  disabled?: boolean;
}

export function SocialSignInButtons({
  onGoogleIdToken,
  onAppleSignIn,
  disabled = false,
}: SocialSignInButtonsProps) {
  const { colors } = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);
  const googleConfigured = isGoogleSignInConfigured();
  const clientIds = getGoogleClientIds();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: clientIds.webClientId,
    iosClientId: clientIds.iosClientId,
    androidClientId: clientIds.androidClientId,
  });

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type !== 'success') {
      setSocialLoading(null);
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setSocialLoading(null);
      return;
    }

    onGoogleIdToken(idToken).finally(() => setSocialLoading(null));
  }, [onGoogleIdToken, response]);

  if (!appleAvailable && !googleConfigured) {
    return (
      <Text style={[styles.emailHint, { color: colors.textTertiary }]}>
        Gmail, iCloud, Outlook, Hotmail, and other emails work with email sign up below.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {appleAvailable && onAppleSignIn && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.lg}
          style={styles.appleButton}
          onPress={() => {
            if (disabled || socialLoading) {
              return;
            }

            setSocialLoading('apple');
            onAppleSignIn().finally(() => setSocialLoading(null));
          }}
        />
      )}

      {googleConfigured && (
        <Pressable
          disabled={disabled || !request || socialLoading !== null}
          onPress={() => {
            if (!request || disabled || socialLoading) {
              return;
            }

            setSocialLoading('google');
            void promptAsync();
          }}
          style={[
            styles.googleButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled || socialLoading ? 0.6 : 1,
            },
          ]}
        >
          {socialLoading === 'google' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
              Continue with Google
            </Text>
          )}
        </Pressable>
      )}

      <Text style={[styles.dividerLabel, { color: colors.textTertiary }]}>or use any email</Text>
      <Text style={[styles.emailHint, { color: colors.textTertiary }]}>
        Gmail, iCloud, Outlook, Hotmail, and other providers
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  dividerLabel: {
    textAlign: 'center',
    fontSize: typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  googleButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  googleButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  emailHint: {
    textAlign: 'center',
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
