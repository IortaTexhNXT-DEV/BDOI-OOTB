import { renderHook, waitFor } from "@testing-library/react";
import useMasterOptions from "./useMasterOptions";
import opsAccountingService from "../../services/opsAccountingService";

jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const rows = [
  { code: "LAP-OTHER", name: "Other", context: "lapse", sortOrder: 290, status: "Active" },
  { code: "LAP-FUNDS", name: "Insufficient Funds", context: "lapse", requiresNote: true, sortOrder: 240, status: "Active" },
  { code: "REP-LATE", name: "Late notification", context: "repudiation", sortOrder: 120, status: "Active" },
  { code: "LAP-OLD", name: "Retired", context: "lapse", sortOrder: 1, status: "Inactive" },
];

describe("options of an operational master", () => {
  beforeEach(() => opsAccountingService.masterRecords.mockResolvedValue({ rows }));

  it("offers the active records of the context in the master's order, by code", async () => {
    const { result } = renderHook(() => useMasterOptions("reason-code", { filter: (r) => r.context === "lapse" }));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active" });
    expect(result.current.map((o) => [o.label, o.value])).toEqual([["Insufficient Funds", "LAP-FUNDS"], ["Other", "LAP-OTHER"]]);
    expect(result.current[0].record.requiresNote).toBe(true);
  });

  it("stores another field when asked (lead sources by name)", async () => {
    const { result } = renderHook(() => useMasterOptions("lead-source", { value: (r) => r.name }));
    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(result.current[0]).toMatchObject({ label: "Late notification", value: "Late notification" });
  });

  it("offers nothing when the master cannot be read", async () => {
    opsAccountingService.masterRecords.mockRejectedValue(new Error("403"));
    const { result } = renderHook(() => useMasterOptions("reason-code"));
    await waitFor(() => expect(opsAccountingService.masterRecords).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
