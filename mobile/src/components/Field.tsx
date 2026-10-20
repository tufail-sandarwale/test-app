import { useTheme } from '@react-navigation/native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export function Field({
  label,
  value,
  onChange,
  numeric = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  secure?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

export function ErrorMessage({
  message,
}: {
  message: string | null | undefined;
}) {
  const { dark } = useTheme();
  return message ? (
    <Text
      accessibilityRole="alert"
      style={[styles.error, dark ? styles.errorDark : styles.errorLight]}
    >
      {message}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { fontSize: 15, lineHeight: 22 },
  errorDark: { color: '#FFB4AB' },
  errorLight: { color: '#9D201A' },
});
