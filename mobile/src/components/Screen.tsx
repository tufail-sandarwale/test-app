import { useTheme } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: colors.text }]}
    >
      {children}
    </Text>
  );
}

export function Reading({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.reading, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function UnavailableState({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="text" style={styles.empty}>
      <SectionTitle>{title}</SectionTitle>
      <Text style={[styles.message, { color: colors.text }]}>
        Not available in this build.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexGrow: 1,
  },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: 0 },
  reading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flexGrow: 1, flexBasis: 150, fontSize: 16 },
  value: { flexShrink: 1, fontSize: 16, fontWeight: '500' },
  empty: { paddingVertical: 28, gap: 12 },
  message: { fontSize: 16, lineHeight: 24 },
});
