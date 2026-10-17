import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { useStableLoad } from "./useStableLoad";

/** A promise the test settles itself. */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** A statement of a period: every request is recorded and answered when the test says so. */
const useStatement = (requests, options) => {
  const [period, setPeriod] = useState("2026-09");
  const loader = useCallback(() => {
    const d = deferred();
    requests.push({ period, ...d });
    return d.promise;
  }, [requests, period]);
  return { load: useStableLoad(loader, options), setPeriod };
};

describe("useStableLoad", () => {
  it("is loading until the first answer, then shows the data", async () => {
    const requests = [];
    const { result } = renderHook(() => useStatement(requests));
    expect(result.current.load).toMatchObject({ data: null, loading: true, refreshing: false, error: null });
    await act(async () => requests[0].resolve({ period: "2026-09" }));
    expect(result.current.load).toMatchObject({ data: { period: "2026-09" }, loading: false, refreshing: false });
    expect(requests).toHaveLength(1);
  });

  it("keeps the previous data on screen while the next period loads", async () => {
    const requests = [];
    const { result } = renderHook(() => useStatement(requests));
    const september = { period: "2026-09" };
    await act(async () => requests[0].resolve(september));
    act(() => result.current.setPeriod("2026-10"));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(result.current.load).toMatchObject({ loading: false, refreshing: true });
    expect(result.current.load.data).toBe(september);
    await act(async () => requests[1].resolve({ period: "2026-10" }));
    expect(result.current.load).toMatchObject({ data: { period: "2026-10" }, refreshing: false });
  });

  it("ignores an answer that arrives after a newer request", async () => {
    const requests = [];
    const { result } = renderHook(() => useStatement(requests));
    await act(async () => requests[0].resolve({ period: "2026-09" }));
    act(() => result.current.setPeriod("2026-10"));
    act(() => result.current.setPeriod("2026-11"));
    await waitFor(() => expect(requests).toHaveLength(3));
    await act(async () => requests[2].resolve({ period: "2026-11" }));
    await act(async () => requests[1].resolve({ period: "2026-10" }));
    expect(result.current.load.data).toEqual({ period: "2026-11" });
    expect(result.current.load.refreshing).toBe(false);
  });

  it("waits for the inputs to settle before reloading, but loads the first time at once", async () => {
    const requests = [];
    const { result } = renderHook(() => useStatement(requests, { debounceMs: 50 }));
    expect(requests).toHaveLength(1);
    await act(async () => requests[0].resolve({ period: "2026-09" }));
    act(() => result.current.setPeriod("2026-1"));
    act(() => result.current.setPeriod("2026-10"));
    expect(requests).toHaveLength(1);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].period).toBe("2026-10");
  });

  it("keeps the data when a reload fails and clears the error on the next answer", async () => {
    const requests = [];
    const { result } = renderHook(() => useStatement(requests));
    await act(async () => requests[0].resolve({ period: "2026-09" }));
    let reloaded;
    act(() => {
      reloaded = result.current.load.reload();
    });
    await act(async () => requests[1].reject(new Error("The server is not reachable")));
    await expect(reloaded).resolves.toBeUndefined();
    expect(result.current.load).toMatchObject({ data: { period: "2026-09" }, error: "The server is not reachable", refreshing: false });
    act(() => {
      reloaded = result.current.load.reload();
    });
    await act(async () => requests[2].resolve({ period: "2026-09", again: true }));
    await expect(reloaded).resolves.toEqual({ period: "2026-09", again: true });
    expect(result.current.load.error).toBeNull();
  });

  it("does not load while it is not enabled", async () => {
    const requests = [];
    const { result, rerender } = renderHook(({ enabled }) => useStatement(requests, { enabled, initialData: [] }), { initialProps: { enabled: false } });
    expect(result.current.load).toMatchObject({ data: [], loading: false, refreshing: false });
    expect(requests).toHaveLength(0);
    rerender({ enabled: true });
    expect(requests).toHaveLength(1);
    expect(result.current.load.loading).toBe(true);
  });

  describe("the four states of a view", () => {
    it("loading, then loaded with data", async () => {
      const requests = [];
      const { result } = renderHook(() => useStatement(requests));
      expect(result.current.load.status).toBe("loading");
      await act(async () => requests[0].resolve({ premium: 0 }));
      // a real zero is data, not an empty view
      expect(result.current.load).toMatchObject({ status: "loaded", loading: false, refreshing: false });
    });

    it("loaded-empty when the answer holds nothing (isEmpty decides)", async () => {
      const requests = [];
      const { result } = renderHook(() => useStatement(requests, { isEmpty: (d) => !d?.rows?.length }));
      await act(async () => requests[0].resolve({ rows: [] }));
      expect(result.current.load).toMatchObject({ status: "empty", loading: false, refreshing: false });
      const plain = [];
      const { result: list } = renderHook(() => useStatement(plain));
      await act(async () => plain[0].resolve([]));
      expect(list.current.load.status).toBe("empty");
    });

    it("error when the first load fails, loaded again after Retry; no loading flag is left on", async () => {
      const requests = [];
      const { result } = renderHook(() => useStatement(requests));
      await act(async () => requests[0].reject(new Error("Server unavailable")));
      expect(result.current.load).toMatchObject({ status: "error", error: "Server unavailable", loading: false, refreshing: false, timedOut: false });
      act(() => { result.current.load.reload(); });
      expect(result.current.load.status).toBe("error");
      expect(result.current.load.refreshing).toBe(true);
      await act(async () => requests[1].resolve({ ok: true }));
      expect(result.current.load).toMatchObject({ status: "loaded", error: null, refreshing: false });
    });

    it("stays loading while it waits to be enabled (no empty state flashes before the first request)", () => {
      const requests = [];
      const { result } = renderHook(() => useStatement(requests, { enabled: false }));
      expect(result.current.load.status).toBe("loading");
      expect(requests).toHaveLength(0);
    });

    describe("time limit", () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it("gives a request up after 10 s: error with timedOut, and the late answer is ignored", async () => {
        const requests = [];
        const { result } = renderHook(() => useStatement(requests));
        await act(async () => { jest.advanceTimersByTime(9999); });
        expect(result.current.load.status).toBe("loading");
        await act(async () => { jest.advanceTimersByTime(1); });
        // tried once more after a short pause (a server restarting) before the error shows
        expect(result.current.load.status).toBe("loading");
        await act(async () => { jest.advanceTimersByTime(1500); });
        expect(requests).toHaveLength(2);
        await act(async () => { jest.advanceTimersByTime(10000); });
        expect(result.current.load).toMatchObject({ status: "error", timedOut: true, loading: false, refreshing: false });
        await act(async () => requests[0].resolve({ late: true }));
        expect(result.current.load.data).toBeNull();
      });

      it("tries a gateway error again after a pause and shows the answer of the second try", async () => {
        const requests = [];
        const { result } = renderHook(() => useStatement(requests));
        await act(async () => requests[0].reject(new Error("Request failed (502)")));
        expect(result.current.load.status).toBe("loading");
        await act(async () => { jest.advanceTimersByTime(1500); });
        await act(async () => requests[1].resolve({ period: "2026-10" }));
        expect(result.current.load).toMatchObject({ status: "loaded", data: { period: "2026-10" }, error: null });
      });

      it("keeps the data on screen when a refresh times out", async () => {
        const requests = [];
        const { result } = renderHook(() => useStatement(requests, { timeoutMs: 500 }));
        await act(async () => requests[0].resolve({ period: "2026-09" }));
        act(() => { result.current.load.reload(); });
        await act(async () => { jest.advanceTimersByTime(500); });
        await act(async () => { jest.advanceTimersByTime(1500); });
        await act(async () => { jest.advanceTimersByTime(500); });
        expect(result.current.load).toMatchObject({ status: "loaded", data: { period: "2026-09" }, timedOut: true, refreshing: false });
      });
    });
  });
});
