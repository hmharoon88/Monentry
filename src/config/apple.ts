/** Apple Sign In is required when Google or other third-party login is offered (App Store 4.8). */
export function isAppleSignInConfigured(): boolean {
  return process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'false';
}
