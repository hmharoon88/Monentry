import { Platform } from 'react-native';

const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

export function getRevenueCatApiKey(): string {
  if (Platform.OS === 'ios') {
    return iosApiKey;
  }

  if (Platform.OS === 'android') {
    return androidApiKey;
  }

  return iosApiKey || androidApiKey;
}

export function isRevenueCatConfigured(): boolean {
  return Boolean(getRevenueCatApiKey());
}
