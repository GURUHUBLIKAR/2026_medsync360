import { useCallback, useEffect, useRef, useState } from 'react';

// Feature flag: the idle session-timeout is DISABLED by default. Enable it by
// setting VITE_SESSION_TIMEOUT_ENABLED=true in the environment (.env).
export const SESSION_TIMEOUT_ENABLED =
  String(import.meta.env.VITE_SESSION_TIMEOUT_ENABLED).toLowerCase() === 'true';

// Tuning: idle window before logout, and how long the warning countdown lasts.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const WARNING_DURATION_MS = 60 * 1000; // 60 seconds

// Activity that should reset the idle timer. We intentionally avoid 'mousemove'
// so trivial pointer drift doesn't keep a truly idle session alive forever.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'wheel'] as const;

interface UseSessionTimeoutOptions {
  enabled: boolean;
  onTimeout: () => void;
}

interface UseSessionTimeoutResult {
  showWarning: boolean;
  secondsRemaining: number;
  stayLoggedIn: () => void;
}

export function useSessionTimeout({
  enabled,
  onTimeout,
}: UseSessionTimeoutOptions): UseSessionTimeoutResult {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.round(WARNING_DURATION_MS / 1000)
  );

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read inside event listeners without re-subscribing on every render.
  const showWarningRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  const beginCountdown = useCallback(() => {
    setSecondsRemaining(Math.round(WARNING_DURATION_MS / 1000));
    setShowWarning(true);
    showWarningRef.current = true;

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    showWarningRef.current = false;

    warningTimerRef.current = setTimeout(() => {
      beginCountdown();
    }, IDLE_TIMEOUT_MS - WARNING_DURATION_MS);

    logoutTimerRef.current = setTimeout(() => {
      clearTimers();
      setShowWarning(false);
      showWarningRef.current = false;
      onTimeoutRef.current();
    }, IDLE_TIMEOUT_MS);
  }, [beginCountdown, clearTimers]);

  // "Stay Logged In" — explicit reset of the whole idle cycle.
  const stayLoggedIn = useCallback(() => {
    startTimers();
  }, [startTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }

    startTimers();

    const handleActivity = () => {
      // While the warning modal is up, ignore ambient activity — the user must
      // explicitly choose "Stay Logged In" so we don't silently extend a session.
      if (showWarningRef.current) return;
      startTimers();
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      clearTimers();
    };
  }, [enabled, startTimers, clearTimers]);

  return { showWarning, secondsRemaining, stayLoggedIn };
}
