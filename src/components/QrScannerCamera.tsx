import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { parseHouseholdInviteCode } from '../utils/householdInviteLink';

interface QrScannerCameraProps {
  onClose: () => void;
  onCodeScanned: (code: string) => Promise<void>;
  onAwaitingPermissionChange?: (awaiting: boolean) => void;
}

export function QrScannerCamera({
  onClose,
  onCodeScanned,
  onAwaitingPermissionChange,
}: QrScannerCameraProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [handled, setHandled] = useState(false);

  const awaitingSystemPrompt =
    !permission || (!permission.granted && permission.status === 'undetermined');

  useEffect(() => {
    onAwaitingPermissionChange?.(awaitingSystemPrompt);
  }, [awaitingSystemPrompt, onAwaitingPermissionChange]);

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (handled || scanning) {
        return;
      }

      const code = parseHouseholdInviteCode(data);
      if (!code) {
        return;
      }

      setHandled(true);
      setScanning(true);
      try {
        await onCodeScanned(code);
        onClose();
      } finally {
        setScanning(false);
        setHandled(false);
      }
    },
    [handled, onClose, onCodeScanned, scanning],
  );

  if (!permission) {
    return (
      <View style={styles.permissionBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    if (permission.status === 'denied' && !permission.canAskAgain) {
      return (
        <View style={styles.permissionBox}>
          <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
            Camera access is off
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            To scan invite QR codes, enable camera access for Monentry in Settings.
          </Text>
          <Pressable
            onPress={() => Linking.openSettings()}
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.permissionButtonText, { color: colors.onPrimary }]}>
              Open Settings
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.permissionBox}>
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
          Scan invite codes
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Monentry uses your camera to scan QR codes when you join a partner or family group. You
          can change this anytime in Settings.
        </Text>
        <Pressable
          onPress={() => requestPermission()}
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.permissionButtonText, { color: colors.onPrimary }]}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : handleBarcode}
      />
      {scanning && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.overlayText}>Joining group…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  permissionTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  permissionButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 160,
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  cameraWrap: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginVertical: spacing.md,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
