import { Alert } from 'react-native';

export function confirmDeleteEntry(onConfirm: () => void): void {
  Alert.alert(
    'Delete entry?',
    'This removes it from Today and Summary.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ],
  );
}

export function confirmClearAll(onConfirm: () => void): void {
  Alert.alert(
    'Clear all data?',
    'Every expense and income entry will be deleted. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: onConfirm },
    ],
  );
}

export function confirmDeleteAccount(onConfirm: () => void): void {
  Alert.alert(
    'Delete account?',
    'This permanently deletes your Monentry account, cloud profile, and personal backup data. Shared group entries stay with the group. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: onConfirm },
    ],
  );
}
