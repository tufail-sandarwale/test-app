import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function ActionButton({ label, onPress, disabled = false }: Props) {
  const { colors, dark } = useTheme();
  const accent = dark ? '#86DBBC' : '#006C4C';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: disabled ? colors.border : accent,
          backgroundColor: pressed ? colors.border : colors.card,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          disabled && styles.disabledLabel,
          {
            color: disabled ? colors.text : accent,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabledLabel: { opacity: 0.55 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0,
  },
});
