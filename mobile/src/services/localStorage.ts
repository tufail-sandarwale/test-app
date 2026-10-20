import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const usePersistenceStatus = create<{
  error: string | null;
  ready: boolean;
}>(() => ({ error: null, ready: false }));

export const localStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  removeItem: (name: string) => AsyncStorage.removeItem(name),
  async setItem(name: string, value: string) {
    try {
      await AsyncStorage.setItem(name, value);
      usePersistenceStatus.setState({ error: null });
    } catch {
      usePersistenceStatus.setState({
        error:
          'Local storage failed. Changes are available this session but may not survive a restart.',
      });
    }
  },
};
