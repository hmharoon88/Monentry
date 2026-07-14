import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { buildHouseholdInviteLink } from '../utils/householdInviteLink';

interface InviteQrModalProps {
  visible: boolean;
  inviteCode: string;
  onClose: () => void;
}

export function InviteQrModal({ visible, inviteCode, onClose }: InviteQrModalProps) {
  const { colors } = useTheme();
  const inviteLink = buildHouseholdInviteLink(inviteCode);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Scan to join</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Scan with Monentry, or enter the code below on the + screen or Me → Sharing.
          </Text>

          <View style={[styles.qrWrap, { backgroundColor: '#FFFFFF' }]}>
            <QRCode value={inviteLink} size={220} />
          </View>

          <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Or enter code manually</Text>
          <Text style={[styles.code, { color: colors.textPrimary }]}>{inviteCode}</Text>

          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.closeButtonText, { color: colors.onPrimary }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
  qrWrap: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginVertical: spacing.sm,
  },
  codeLabel: {
    fontSize: typography.caption,
  },
  code: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
  },
  closeButton: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 160,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
