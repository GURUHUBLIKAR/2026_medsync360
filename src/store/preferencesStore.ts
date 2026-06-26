import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SESSION_TIMEOUT_ENABLED } from '../hooks/useSessionTimeout';

export type ThemeMode = 'light' | 'dark';

export interface NotificationPrefs {
  inApp: boolean;
  dutySwap: boolean;
  referrals: boolean;
  sound: boolean;
}

interface PreferencesState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Mirrors the build-time VITE_SESSION_TIMEOUT_ENABLED flag, but user-toggleable.
  sessionTimeoutEnabled: boolean;
  setSessionTimeoutEnabled: (value: boolean) => void;

  notifications: NotificationPrefs;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      sessionTimeoutEnabled: SESSION_TIMEOUT_ENABLED,
      setSessionTimeoutEnabled: (sessionTimeoutEnabled) => set({ sessionTimeoutEnabled }),

      notifications: { inApp: true, dutySwap: true, referrals: true, sound: false },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
    }),
    { name: 'medsync-preferences' }
  )
);
