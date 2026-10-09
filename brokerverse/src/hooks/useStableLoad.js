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
 * @param {() => Promise<any>} loader
 * @param {{ debounceMs?: number, enabled?: boolean, initialData?: any }} [options] enabled: false waits (nothing
 *   chosen yet); initialData: the data before the first answer (null by default)
 * @returns {{ data: any, loading: boolean, refreshing: boolean, error: string|null, reload: () => Promise<any>,
 *   setData: Function }} loading: the first load is running; refreshing: a later load is running; reload: load
 *   again now (after an action), resolves with the new data (undefined when it failed or was overtaken)
 */
export const useStableLoad = (loader, { debounceMs = 0, enabled = true, initialData = null } = {}) => {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
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
      const result = await loader();
      if (!current()) return undefined;
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      if (current()) setError(e?.message || String(e));
      return undefined;
    } finally {
      if (current()) {
        hasLoaded.current = true;
        setLoaded(true);
        setPending(false);
      }
    }
  }, [loader]);

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

  return { data, loading: pending && !loaded, refreshing: pending && loaded, error, reload, setData };
};

export default useStableLoad;
