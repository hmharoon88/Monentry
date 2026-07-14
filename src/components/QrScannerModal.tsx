import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { QrScannerCamera } from './QrScannerCamera';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onCodeScanned: (code: string) => Promise<void>;
}

export function QrScannerModal({ visible, onClose, onCodeScanned }: QrScannerModalProps) {
  const { colors } = useTheme();
  const [awaitingPermission, setAwaitingPermission] = useState(true);

  useEffect(() => {
    if (visible) {
      setAwaitingPermission(true);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onRequestClose={awaitingPermission ? undefined : onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Scan invite QR</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Point your camera at the QR code on the other person&apos;s phone.
        </Text>

        <QrScannerCamera
          onClose={onClose}
          onCodeScanned={onCodeScanned}
          onAwaitingPermissionChange={setAwaitingPermission}
        />

        {!awaitingPermission ? (
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.closeButtonText, { color: colors.textPrimary }]}>Close</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
  closeButton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
