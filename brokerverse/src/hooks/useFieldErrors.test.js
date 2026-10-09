import { act, renderHook } from "@testing-library/react";
import useFieldErrors, { apiFieldErrors, blank } from "./useFieldErrors";

describe("useFieldErrors", () => {
  it("keeps the messages of the rules that fail and says whether all passed", () => {
    const { result } = renderHook(() => useFieldErrors());
    let ok;
    act(() => { ok = result.current.check({ code: "Required", name: null }); });
    expect(ok).toBe(false);
    expect(result.current.errors).toEqual({ code: "Required" });
    act(() => { ok = result.current.check({ code: null }); });
    expect(ok).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it("puts the API validation messages on their fields", () => {
    const { result } = renderHook(() => useFieldErrors());
    act(() => result.current.fromApi({ errors: [{ path: "lines.0.amount", message: "Expected number" }, { message: "no field" }] }));
    expect(result.current.errors).toEqual({ lines: "Expected number" });
    expect(apiFieldErrors(new Error("plain"))).toEqual({});
  });

  it("treats nothing chosen, spaces and an empty list as blank", () => {
    expect([null, undefined, "", "  ", []].every(blank)).toBe(true);
    expect([0, "x", ["a"]].some(blank)).toBe(false);
  });
});
