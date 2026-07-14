import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

const HARMLESS_RC_LOG_PATTERNS = [
  /Failed to read cache contents/i,
  /local-transaction-metadata/i,
  /couldn.t be opened because there is no such file/i,
  /LogOut was called but the current user is anonymous/i,
];

export function configureRevenueCatLogging(): void {
  Purchases.setLogHandler((level, message) => {
    if (HARMLESS_RC_LOG_PATTERNS.some((pattern) => pattern.test(message))) {
      return;
    }

    switch (level) {
      case LOG_LEVEL.DEBUG:
        if (__DEV__) {
          console.debug(`[RevenueCat] ${message}`);
        }
        break;
      case LOG_LEVEL.INFO:
        console.info(`[RevenueCat] ${message}`);
        break;
      case LOG_LEVEL.WARN:
        console.warn(`[RevenueCat] ${message}`);
        break;
      case LOG_LEVEL.ERROR:
        console.error(`[RevenueCat] ${message}`);
        break;
      default:
        console.log(`[RevenueCat] ${message}`);
    }
  });
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.INFO);
}

export function getRevenueCatApiKey(): string {
  if (Platform.OS === 'ios') {
    return iosApiKey;
  }

  if (Platform.OS === 'android') {
    return androidApiKey;
  }

  return iosApiKey || androidApiKey;
}

export function isTestStoreApiKey(key: string = getRevenueCatApiKey()): boolean {
  return key.startsWith('test_');
}

/** True when an API key is present in env (may still be unsuitable for release builds). */
export function hasRevenueCatApiKey(): boolean {
  return Boolean(getRevenueCatApiKey());
}

/** Only configure the native SDK when an API key is present and safe for this build. */
export function shouldConfigureRevenueCat(): boolean {
  if (!hasRevenueCatApiKey()) {
    return false;
  }

  // RevenueCat fatalErrors if a test_ key is used in Release — skip configure.
  if (isTestStoreApiKey() && !__DEV__) {
    return false;
  }

  return true;
}

export function getBillingBlockedReason(): string | null {
  if (!hasRevenueCatApiKey()) {
    return 'Billing is not configured in this build. Reinstall the latest TestFlight build or contact support.';
  }

  if (isTestStoreApiKey() && !__DEV__) {
    return 'Release builds need an appl_… App Store key. test_… Test Store keys only work in Debug.';
  }

  return null;
}
