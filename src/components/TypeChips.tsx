import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing, typography } from '../theme';

interface TypeChipsProps {
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}

export function TypeChips({ options, selected, onSelect }: TypeChipsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? colors.primarySoft : colors.surfaceElevated,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isSelected ? colors.primary : colors.textSecondary },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.label,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});
