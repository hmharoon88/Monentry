import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, GoogleAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { Platform } from 'react-native';
import { isAppleSignInConfigured } from '../config/apple';
import { getFirebaseAuth } from '../config/firebase';
import { ensureUserProfile } from '../sync/firestoreSync';

function generateNonce(length = 32): string {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (byte) => charset[byte % charset.length]).join('');
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !isAppleSignInConfigured()) {
    return false;
  }

  return AppleAuthentication.isAvailableAsync();
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) {
    return null;
  }

  const parts = [fullName.givenName, fullName.familyName].filter(
    (part): part is string => Boolean(part?.trim()),
  );

  return parts.length > 0 ? parts.join(' ') : null;
}

export async function signInWithApple(): Promise<void> {
  const available = await isAppleSignInAvailable();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign In did not return an identity token.');
  }

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const result = await signInWithCredential(getFirebaseAuth(), credential);
  const email = result.user.email ?? appleCredential.email ?? '';
  const displayName = formatAppleFullName(appleCredential.fullName);

  if (displayName && !result.user.displayName) {
    await updateProfile(result.user, { displayName });
  }

  await ensureUserProfile(result.user.uid, email, { displayName });
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getFirebaseAuth(), credential);
  await ensureUserProfile(result.user.uid, result.user.email ?? '');
}
