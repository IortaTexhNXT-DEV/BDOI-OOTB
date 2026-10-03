import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { PAGE_SIZE, PAGE_SIZES, useServerList } from "./useServerList";

const rowsFor = (page, pageSize, search) => Array.from({ length: pageSize }, (_, i) => ({ id: `${search}-${(page - 1) * pageSize + i}` }));

/** A list over 95 records: the fetch records every request it receives. */
const useTestList = (calls, { key, delay = 0 } = {}) => {
  const [search, setSearch] = useState("");
  const fetchPage = useCallback(async ({ page, pageSize }) => {
    calls.push({ page, pageSize, search });
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return { rows: rowsFor(page, pageSize, search), total: 95 };
  }, [calls, search, delay]);
  return { list: useServerList(fetchPage, { key, debounceMs: 10 }), setSearch };
};

describe("server-paged lists", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("asks the server for one page of 20 rows, once, and offers 20 / 50 / 100", async () => {
    const calls = [];
    const { result } = renderHook(() => useTestList(calls));
    expect(result.current.list.loading).toBe(true);
    await waitFor(() => expect(result.current.list.rows).toHaveLength(PAGE_SIZE));
    expect(calls).toEqual([{ page: 1, pageSize: 20, search: "" }]);
    expect(result.current.list.tableProps).toMatchObject({ lazy: true, paginator: true, totalRecords: 95, rows: 20, first: 0, rowsPerPageOptions: PAGE_SIZES });
  });

  it("keeps the current rows on screen while the next page loads", async () => {
    const calls = [];
    const { result } = renderHook(() => useTestList(calls, { delay: 300 }));
    await waitFor(() => expect(result.current.list.loading).toBe(false));
    const firstPage = result.current.list.rows;
    act(() => result.current.list.tableProps.onPage({ first: 20, rows: 20 }));
    await waitFor(() => expect(result.current.list.loading).toBe(true));
    expect(result.current.list.rows).toBe(firstPage);
    await waitFor(() => expect(result.current.list.rows[0].id).toBe("-20"));
    expect(calls.at(-1)).toEqual({ page: 2, pageSize: 20, search: "" });
  });

  it("goes back to the first page when the search changes", async () => {
    const calls = [];
    const { result } = renderHook(() => useTestList(calls));
    await waitFor(() => expect(result.current.list.loading).toBe(false));
    act(() => result.current.list.tableProps.onPage({ first: 40, rows: 20 }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ page: 3, pageSize: 20, search: "" }));
    act(() => result.current.setSearch("santos"));
    await waitFor(() => expect(calls.at(-1)).toEqual({ page: 1, pageSize: 20, search: "santos" }));
    expect(result.current.list.tableProps.first).toBe(0);
    // one request for the new search, not one for the old page first
    expect(calls.filter((c) => c.search === "santos")).toHaveLength(1);
  });

  it("reopens on the page it was left on", async () => {
    const calls = [];
    const { result, unmount } = renderHook(() => useTestList(calls, { key: "test-list" }));
    await waitFor(() => expect(result.current.list.loading).toBe(false));
    act(() => result.current.list.tableProps.onPage({ first: 50, rows: 50 }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ page: 2, pageSize: 50, search: "" }));
    unmount();
    const again = [];
    const view = renderHook(() => useTestList(again, { key: "test-list" }));
    await waitFor(() => expect(view.result.current.list.loading).toBe(false));
    expect(again).toEqual([{ page: 2, pageSize: 50, search: "" }]);
  });
});
