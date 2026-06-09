import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
] as const;

interface AmountKeypadProps {
  value: string;
  onChange: (value: string) => void;
}

export function AmountKeypad({ value, onChange }: AmountKeypadProps) {
  const { colors } = useTheme();

  const handlePress = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }

    if (key === '.' && value.includes('.')) {
      return;
    }

    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }

    onChange(`${value}${key}`);
  };

  return (
    <View style={styles.grid}>
      {KEY_ROWS.map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => handlePress(key)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed ? colors.border : colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  key: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyText: {
    fontSize: typography.title,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: typography.title + 4,
    includeFontPadding: false,
  },
});
