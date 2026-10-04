import { useCallback, useEffect, useRef, useState } from "react";

/** One paginator on every list: 20 rows by default, 20 / 50 / 100 to choose from. */
export const PAGE_SIZE = 20;
export const PAGE_SIZES = [20, 50, 100];
export const PAGINATOR_TEMPLATE = "FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport";
export const PAGE_REPORT = "{first} - {last} of {totalRecords}";

/** Paginator props for a list paged in the browser (small reference lists). */
export const clientPaging = {
  paginator: true,
  rows: PAGE_SIZE,
  rowsPerPageOptions: PAGE_SIZES,
  paginatorTemplate: PAGINATOR_TEMPLATE,
  currentPageReportTemplate: PAGE_REPORT,
};

const readStored = (key, initial) => {
  if (!key) return initial;
  try {
    const raw = window.sessionStorage.getItem(`bv-list:${key}`);
    return raw ? { ...initial, ...JSON.parse(raw) } : initial;
  } catch {
    return initial;
  }
};

/**
 * State that survives leaving the screen for a detail page and coming back (kept for the browser tab only), so a
 * list reopens with the search, filters and page the user left it with.
 * @param {string} key list name, e.g. "clients"
 * @param {object} initial default state (an object: its fields are merged with what was stored)
 */
export const useListState = (key, initial) => {
  const [state, setState] = useState(() => readStored(key, initial));
  useEffect(() => {
    if (!key) return;
    try {
      window.sessionStorage.setItem(`bv-list:${key}`, JSON.stringify(state));
    } catch {
      // storage unavailable (private window): the list simply starts fresh next time
    }
  }, [key, state]);
  const patch = useCallback((change) => setState((s) => ({ ...s, ...(typeof change === "function" ? change(s) : change) })), []);
  return [state, patch];
};

/**
 * A list paged, searched and filtered by the server.
 *
 * `fetchPage({ page, pageSize })` returns `{ rows, total }`; wrap it in useCallback over the search and filters, and
 * a change of filters goes back to the first page. While a page loads the current rows stay on screen under the
 * table's loading veil (never blank, then refilled); typing in a search box is debounced; an older answer that
 * arrives after a newer request is ignored.
 *
 * @returns {{ rows: any[], total: number, loading: boolean, error: string|null, reload: Function, tableProps: object }}
 *   spread `tableProps` on the DataTable.
 */
export const useServerList = (fetchPage, { key, pageSize = PAGE_SIZE, debounceMs = 250 } = {}) => {
  const [paging, setPaging] = useListState(key && `${key}:page`, { first: 0, rows: pageSize });
  const [data, setData] = useState({ rows: [], total: 0 });
  // loading from the first render: the table shows its loading state (not "No records") until the first page arrives
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const loaded = useRef(false);
  const lastFetch = useRef(fetchPage);

  // new search or filters: back to the first page
  useEffect(() => {
    if (lastFetch.current === fetchPage) return;
    lastFetch.current = fetchPage;
    setPaging((p) => (p.first ? { first: 0 } : {}));
  }, [fetchPage, setPaging]);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetchPage({ page: Math.floor(paging.first / paging.rows) + 1, pageSize: paging.rows });
      if (mine !== seq.current) return;
      const rows = Array.isArray(res?.rows) ? res.rows : [];
      const total = Number(res?.total) || 0;
      // the stored page may be past the end now (records removed): show the last page instead
      if (!rows.length && total > 0 && paging.first >= total) {
        setPaging({ first: Math.max(0, Math.floor((total - 1) / paging.rows) * paging.rows) });
        return;
      }
      setData({ rows, total });
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e?.message || String(e));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        loaded.current = true;
      }
    }
  }, [fetchPage, paging.first, paging.rows, setPaging]);

  useEffect(() => {
    // the first load starts at once; later ones (typing, filter clicks) are debounced
    const h = setTimeout(reload, loaded.current ? debounceMs : 0);
    return () => clearTimeout(h);
  }, [reload, debounceMs]);

  const onPage = useCallback((e) => setPaging({ first: e.first, rows: e.rows }), [setPaging]);

  return {
    rows: data.rows,
    total: data.total,
    loading,
    error,
    reload,
    tableProps: {
      value: data.rows,
      lazy: true,
      paginator: true,
      first: paging.first,
      rows: paging.rows,
      totalRecords: data.total,
      onPage,
      loading,
      rowsPerPageOptions: PAGE_SIZES,
      paginatorTemplate: PAGINATOR_TEMPLATE,
      currentPageReportTemplate: PAGE_REPORT,
    },
  };
};

export default useServerList;
