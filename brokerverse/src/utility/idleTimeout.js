/**
 * Signs the user out after a period without activity (limits.session_idle_minutes on the Configuration
 * screen, default 30), with a one-minute warning. Required for shared terminals in branch offices.
 */
import { BASE_URL } from "./constant";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"];
const WARNING_MS = 60 * 1000;
const DEFAULT_MINUTES = 30;

export const loadIdleMinutes = async () => {
  try {
    const token = localStorage.getItem("accessToken");
    const r = await fetch(`${BASE_URL}/settings?group=limits`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await r.json();
    const row = (json.data || []).find((s) => s.key === "limits.session_idle_minutes");
    const n = Number(row?.value);
    return n > 0 ? n : DEFAULT_MINUTES;
  } catch {
    return DEFAULT_MINUTES;
  }
};

/** Start watching activity; returns a stop function. onWarn(secondsLeft) / onTimeout() are callbacks. */
export const startIdleTimer = (minutes, { onWarn, onActive, onTimeout }) => {
  const limit = Math.max(2, minutes) * 60 * 1000;
  let warnTimer;
  let outTimer;
  const reset = () => {
    clearTimeout(warnTimer);
    clearTimeout(outTimer);
    onActive?.();
    warnTimer = setTimeout(() => onWarn?.(WARNING_MS / 1000), limit - WARNING_MS);
    outTimer = setTimeout(() => onTimeout?.(), limit);
  };
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
  reset();
  return () => {
    clearTimeout(warnTimer);
    clearTimeout(outTimer);
    ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
  };
};
