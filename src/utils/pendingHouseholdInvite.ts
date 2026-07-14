import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'monentry.pendingHouseholdInvite';

export async function setPendingHouseholdInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code.trim().toUpperCase());
}

export async function consumePendingHouseholdInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(KEY);
  if (code) {
    await AsyncStorage.removeItem(KEY);
  }
  return code;
}
