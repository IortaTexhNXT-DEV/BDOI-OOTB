import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Data of a screen, a tab or a card that reloads when its inputs change without ever going blank.
 *
 * `loader()` returns a promise of the data; wrap it in useCallback over its inputs (period, dates, tab), and a new
 * loader loads again. The data on screen is kept while the next load runs (it is never set back to empty), so the
 * content stays mounted: show a LoadingBar while `refreshing` and a skeleton only while `loading` (the first load).
 * An answer that arrives after a newer request was made is ignored. `debounceMs` waits for the inputs to settle
 * before a reload (dates typed in a date field); the first load starts at once.
 *
 * Every view has exactly four states (`status`): "loading" (the first load, at most `timeoutMs`), "loaded" (with
 * data), "empty" (answered, nothing to show: `isEmpty(data)`) and "error" (failed or timed out, nothing to keep on
 * screen). A lost connection or a gateway error (502/503/504, a server restarting) is tried again twice after a
 * short pause, and a time-out once, before it counts as failed. A failed refresh keeps the data on screen ("loaded", `error` set). `loading` / `refreshing` always end when
 * the request settles, so no spinner turns for ever. components/LoadState/ViewState renders the four states.
 *
 * @param {() => Promise<any>} loader
 * @param {{ debounceMs?: number, enabled?: boolean, initialData?: any, timeoutMs?: number, isEmpty?: (data) => boolean }} [options]
 *   enabled: false waits (nothing chosen yet); initialData: the data before the first answer (null by default);
 *   timeoutMs: a request still running after this long is given up as an error (10 s; 0: never); isEmpty: whether an
 *   answer has nothing to show (default: null, undefined or an empty array)
 * @returns {{ data: any, status: "loading"|"loaded"|"empty"|"error", loading: boolean, refreshing: boolean,
 *   error: string|null, timedOut: boolean, reload: () => Promise<any>, setData: Function }} loading: the first load is
 *   running; refreshing: a later load is running; reload: load again now (after an action, Retry), resolves with the
 *   new data (undefined when it failed or was overtaken)
 */
export const LOAD_TIMEOUT_MS = 10000;
const defaultIsEmpty = (data) => data === null || data === undefined || (Array.isArray(data) && data.length === 0);

/** Thrown when a request runs past its time limit. */
export class LoadTimeoutError extends Error {
  constructor() {
    super("The request is taking too long.");
    this.name = "LoadTimeoutError";
    this.timedOut = true;
  }
}

/** The promise, or a LoadTimeoutError once `ms` have passed (0: no limit). */
export const withTimeout = (promise, ms) => {
  if (!ms) return promise;
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new LoadTimeoutError()), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

/** How often a transient failure is tried again, and the pause before each try (a server restarting during a deploy). */
export const LOAD_RETRY_DELAYS_MS = [1500, 4000];

/** A failure worth trying again: a time-out, no answer from the server, or a gateway answer while it restarts. */
export const isTransientError = (e) => {
  if (!e) return false;
  if (e.timedOut || e.name === "TypeError") return true;
  const status = e.status || e.response?.status;
  if (status) return status === 502 || status === 503 || status === 504;
  return /\((502|503|504)\)/.test(e.message || "");
};

const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export const useStableLoad = (loader, { debounceMs = 0, enabled = true, initialData = null, timeoutMs = LOAD_TIMEOUT_MS, isEmpty = defaultIsEmpty } = {}) => {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [pending, setPending] = useState(enabled);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const hasLoaded = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mine) => {
    const current = () => mine === seq.current && mounted.current;
    setPending(true);
    try {
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await withTimeout(Promise.resolve(loader()), timeoutMs);
          break;
        } catch (e) {
          // a server restarting answers again within seconds: try again quietly before showing an error
          if (attempt >= (e?.timedOut ? 1 : LOAD_RETRY_DELAYS_MS.length) || !isTransientError(e) || !current()) throw e;
          await pause(LOAD_RETRY_DELAYS_MS[attempt]);
          if (!current()) return undefined;
        }
      }
      if (!current()) return undefined;
      setData(result);
      setError(null);
      setTimedOut(false);
      return result;
    } catch (e) {
      if (current()) {
        setError(e?.message || String(e));
        setTimedOut(!!e?.timedOut);
      }
      return undefined;
    } finally {
      if (current()) {
        hasLoaded.current = true;
        setLoaded(true);
        setPending(false);
      }
    }
  }, [loader, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      setPending(false);
      return undefined;
    }
    // from here on an answer to an earlier request is no longer wanted, even while this one waits for its turn
    const mine = ++seq.current;
    const delay = hasLoaded.current ? debounceMs : 0;
    if (!delay) {
      run(mine);
      return undefined;
    }
    const h = setTimeout(() => run(mine), delay);
    return () => clearTimeout(h);
  }, [run, enabled, debounceMs]);

  const reload = useCallback(() => run(++seq.current), [run]);

  const loading = pending && !loaded;
  let status = "loaded";
  // before the first answer (also while waiting to be enabled) the view is loading
  if (!loaded) status = "loading";
  else if (error && isEmpty(data)) status = "error";
  else if (isEmpty(data)) status = "empty";
  return { data, status, loading, refreshing: pending && loaded, error, timedOut, reload, setData };
};

export default useStableLoad;
