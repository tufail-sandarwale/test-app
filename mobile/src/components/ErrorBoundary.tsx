import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { describeError, type ErrorReport } from '../services/diagnostics';
import { resetSavedData } from '../services/resetData';

type BoundaryProps = {
  children: ReactNode;
  renderFallback: (report: ErrorReport, reset: () => void) => ReactNode;
};

/** Shows a readable error instead of an empty screen when rendering fails. */
export class ErrorBoundary extends Component<
  BoundaryProps,
  { report: ErrorReport | null }
> {
  state: { report: ErrorReport | null } = { report: null };

  static getDerivedStateFromError(error: unknown) {
    return { report: describeError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ report: describeError(error, info.componentStack) });
  }

  reset = () => this.setState({ report: null });

  render() {
    return this.state.report
      ? this.props.renderFallback(this.state.report, this.reset)
      : this.props.children;
  }
}

function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? {
        background: '#121212',
        card: '#1E1E1E',
        text: '#FFFFFF',
        accent: '#86DBBC',
      }
    : {
        background: '#FFFFFF',
        card: '#F2F2F2',
        text: '#1B1B1B',
        accent: '#006C4C',
      };
}

function TextButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const share = (title: string, text: string) =>
  Share.share({ title, message: `${title}\n\n${text}` }).catch(() => undefined);

export function ErrorScreen({
  title,
  report,
  onRetry,
}: {
  title: string;
  report: ErrorReport;
  onRetry: () => void;
}) {
  const colors = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {report.message}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        Try again, or share these details with the developer.
      </Text>
      <ScrollView
        style={[styles.details, { backgroundColor: colors.card }]}
        contentContainerStyle={styles.detailsContent}
      >
        <Text selectable style={[styles.mono, { color: colors.text }]}>
          {report.details}
        </Text>
      </ScrollView>
      <View style={styles.actions}>
        <TextButton label="Try again" color={colors.accent} onPress={onRetry} />
        <TextButton
          label="Share details"
          color={colors.accent}
          onPress={() =>
            share(`Mock GPS Tester error: ${report.message}`, report.details)
          }
        />
        <TextButton
          label="Reset saved data"
          color={colors.text}
          onPress={() =>
            Alert.alert(
              'Reset saved data?',
              'Favorites, routes, history and settings on this phone will be deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: () =>
                    resetSavedData()
                      .catch(() => undefined)
                      .finally(onRetry),
                },
              ],
            )
          }
        />
      </View>
    </View>
  );
}

/** Explains a crash from the previous run and lets the tester share it. */
export function CrashReportNotice({
  report,
  onDismiss,
}: {
  report: string | null;
  onDismiss: () => void;
}) {
  const colors = usePalette();
  return (
    <Modal
      transparent
      visible={!!report}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: colors.background }]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            The app closed unexpectedly last time
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>
            Share this report with the developer so the problem can be fixed.
          </Text>
          <ScrollView
            style={[styles.details, { backgroundColor: colors.card }]}
            contentContainerStyle={styles.detailsContent}
          >
            <Text selectable style={[styles.mono, { color: colors.text }]}>
              {report?.slice(0, 6000)}
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <TextButton
              label="Share report"
              color={colors.accent}
              onPress={() =>
                share('Mock GPS Tester crash report', report ?? '')
              }
            />
            <TextButton
              label="Dismiss"
              color={colors.text}
              onPress={onDismiss}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 22 },
  details: { flexGrow: 0, maxHeight: 320, borderRadius: 8 },
  detailsContent: { padding: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialog: { borderRadius: 16, padding: 20, gap: 12, maxHeight: '90%' },
});
