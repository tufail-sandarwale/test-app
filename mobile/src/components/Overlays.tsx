import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, useAccent } from './MapControls';

export interface MenuItem {
  label: string;
  icon: string;
  onPress: () => void;
  badge?: string;
}

export function SideDrawer({
  visible,
  onClose,
  title,
  subtitle,
  items,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: MenuItem[];
  footer?: string;
}) {
  const { colors } = useTheme();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.84);
  const offset = useRef(new Animated.Value(-panelWidth)).current;
  useEffect(() => {
    if (visible) {
      offset.setValue(-panelWidth);
      Animated.timing(offset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, offset, panelWidth]);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.drawerRow}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.drawer,
            {
              width: panelWidth,
              backgroundColor: colors.card,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateX: offset }],
            },
          ]}
        >
          <View
            style={[styles.drawerHeader, { borderBottomColor: colors.border }]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.drawerTitle, { color: accent }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.drawerSubtitle, { color: colors.text }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <ScrollView>
            {items.map(item => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={
                  item.badge ? `${item.label}, ${item.badge}` : item.label
                }
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.drawerItem,
                  pressed && { backgroundColor: colors.border },
                ]}
              >
                <Text style={styles.drawerIcon}>{item.icon}</Text>
                <Text style={[styles.drawerLabel, { color: colors.text }]}>
                  {item.label}
                </Text>
                {item.badge ? (
                  <Text style={styles.badge}>{item.badge}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          {footer ? (
            <Text style={[styles.footer, { color: colors.text }]}>
              {footer}
            </Text>
          ) : null}
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={styles.backdrop}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

export interface SheetOption {
  label: string;
  description?: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export function BottomSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.flex}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text
            accessibilityRole="header"
            style={[styles.sheetTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          {options.map(option => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{
                selected: option.selected,
                disabled: option.disabled,
              }}
              disabled={option.disabled}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              style={({ pressed }) => [
                styles.sheetOption,
                pressed && { backgroundColor: colors.border },
                option.disabled && styles.disabled,
              ]}
            >
              <View style={styles.flex}>
                <Text
                  style={[
                    styles.sheetLabel,
                    { color: option.selected ? accent : colors.text },
                  ]}
                >
                  {option.label}
                </Text>
                {option.description ? (
                  <Text
                    style={[styles.sheetDescription, { color: colors.text }]}
                  >
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {option.selected ? (
                <Text style={[styles.check, { color: accent }]}>✓</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export function NamePrompt({
  visible,
  title,
  message,
  initialValue = '',
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  /** Throw to keep the prompt open and show the error. */
  onSubmit: (name: string) => void;
}) {
  const { colors } = useTheme();
  const accent = useAccent();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }, [visible, initialValue]);
  const submit = () => {
    try {
      onSubmit(value);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={styles.promptBackdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.prompt, { backgroundColor: colors.card }]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.sheetTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          {message ? (
            <Text style={[styles.sheetDescription, { color: colors.text }]}>
              {message}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Name"
            autoFocus
            value={value}
            onChangeText={setValue}
            onSubmitEditing={submit}
            maxLength={80}
            placeholder="Name"
            placeholderTextColor="#8A8A8A"
            returnKeyType="done"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: error ? palette.stop : colors.border,
              },
            ]}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.promptError}>
              {error}
            </Text>
          ) : null}
          <View style={styles.promptActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={styles.promptButton}
            >
              <Text style={[styles.promptButtonLabel, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={submit}
              style={styles.promptButton}
            >
              <Text style={[styles.promptButtonLabel, { color: accent }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.45 },
  drawerRow: { flex: 1, flexDirection: 'row' },
  drawer: {
    height: '100%',
    elevation: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  drawerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0 },
  drawerSubtitle: { fontSize: 14, opacity: 0.8 },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  drawerIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  drawerLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.warningText,
    backgroundColor: palette.warningBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  footer: { fontSize: 12, opacity: 0.7, paddingHorizontal: 20, paddingTop: 12 },
  sheetContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
    letterSpacing: 0,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sheetLabel: { fontSize: 16, fontWeight: '500' },
  sheetDescription: { fontSize: 13, opacity: 0.75, marginTop: 2 },
  check: { fontSize: 18, fontWeight: '700' },
  promptBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  prompt: { borderRadius: 16, padding: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    marginHorizontal: 12,
  },
  promptError: { color: palette.stop, fontSize: 14, marginHorizontal: 12 },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  promptButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  promptButtonLabel: { fontSize: 16, fontWeight: '700' },
});
