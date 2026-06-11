import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Platform } from 'react-native';
import { getFirebaseAuth } from '../config/firebase';
import { ensureUserProfile } from '../sync/firestoreSync';

function generateNonce(length = 32): string {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (byte) => charset[byte % charset.length]).join('');
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  return AppleAuthentication.isAvailableAsync();
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
  await ensureUserProfile(result.user.uid, email);
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getFirebaseAuth(), credential);
  await ensureUserProfile(result.user.uid, result.user.email ?? '');
}
