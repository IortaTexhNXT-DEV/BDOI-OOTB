import { useEffect, useState } from "react";

const KEY = "bv.chartPatterns";
const EVENT = "bv-chart-patterns";

const stored = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const forcedColors = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(forced-colors: active)").matches;

/**
 * Whether chart fills carry the line texture (colour-blind viewing, print): the viewer's choice, remembered in this
 * browser, and always in forced-colours mode. Every chart of the page follows the same switch.
 */
export function usePatterns() {
  const [on, setOn] = useState(() => stored() || forcedColors());
  useEffect(() => {
    const sync = () => setOn(stored() || forcedColors());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = () => {
    try {
      localStorage.setItem(KEY, on ? "0" : "1");
    } catch {
      setOn(!on);
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, toggle];
}
