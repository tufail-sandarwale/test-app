import { create } from 'zustand';
import { nativeLocation } from './MockLocation';

export interface ErrorReport {
  message: string;
  details: string;
}

interface DiagnosticsState {
  /** A fatal JavaScript error caught by the global handler. */
  fatalError: ErrorReport | null;
  /** Report of a crash recorded natively during a previous run. */
  crashReport: string | null;
}

export const useDiagnosticsStore = create<DiagnosticsState>(() => ({
  fatalError: null,
  crashReport: null,
}));

export function describeError(error: unknown, componentStack?: string | null) {
  const value =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : String(error));
  const details = [
    `${value.name}: ${value.message}`,
    value.stack?.split('\n').slice(0, 12).join('\n'),
    componentStack?.trim()
      ? `Component stack:${componentStack.split('\n').slice(0, 12).join('\n')}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { message: value.message || value.name, details } as ErrorReport;
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

let installed = false;

/**
 * Shows fatal JavaScript errors on screen instead of letting a release build
 * tear down React Native, which otherwise leaves a blank white screen.
 */
export function installGlobalErrorHandler() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !errorUtils) {
    return;
  }
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      useDiagnosticsStore.setState({ fatalError: describeError(error) });
    }
    previous(error, __DEV__ ? isFatal : false);
  });
}

export async function loadCrashReport() {
  try {
    const report = await nativeLocation?.getLastCrashReport?.();
    useDiagnosticsStore.setState({ crashReport: report || null });
  } catch {
    useDiagnosticsStore.setState({ crashReport: null });
  }
}

export async function clearCrashReport() {
  useDiagnosticsStore.setState({ crashReport: null });
  try {
    await nativeLocation?.clearLastCrashReport?.();
  } catch {
    // The report is hidden either way; a stale file is harmless.
  }
}
