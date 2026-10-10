import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import auditService from "../../services/auditService";
import ActivityLog from "./ActivityLog";
import RecordActivityLog from "./RecordActivityLog";
import { actionText, actionTone } from "./actions";
import { setDateFormat, setTimeZone } from "../../utility/dateFormat";

jest.mock("../../services/auditService", () => ({ __esModule: true, default: { getRecordHistory: jest.fn() } }));

const entries = [
  { id: "1", at: "2026-10-09T02:10:00Z", actionCode: "create", user: { displayName: "Rosa Finance", username: "r.finance", role: "Finance Officer" }, toStatus: "Draft" },
  { id: "2", at: "2026-10-10T01:03:00Z", actionCode: "submit", user: { displayName: "Rosa Finance", username: "r.finance", role: "Finance Officer" },
    fromStatus: "Draft", toStatus: "Pending Approval", source: { channel: "screen", label: "Screen", name: "Accounts > Remittance > Tracking" },
    changes: [{ field: "batchId", label: "Batch ID", before: null, after: "BLK-2026-00001" }] },
  { id: "3", at: "2026-10-10T05:30:00Z", actionCode: "approve", user: { displayName: "Fe Head", roles: ["Finance Manager"] },
    fromStatus: "Pending Approval", toStatus: "Approved", remarks: "Checked against the statement",
    changes: [{ field: "currentLevel", label: "Approval level", before: "1 of 2", after: "2 of 2" }, { field: "tin", label: "TIN", before: "123", after: "456", masked: true }] },
];

beforeEach(() => {
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
});
afterEach(() => setTimeZone(null));

describe("action dictionary", () => {
  it("turns action codes, and their past forms, into words and a tone", () => {
    expect(actionText("submit")).toBe("Submitted");
    expect(actionText("Approved")).toBe("Approved");
    expect(actionText("send_bill")).toBe("Send bill");
    expect(actionText("create-settlement")).toBe("Create settlement");
    expect(actionTone("reject")).toBe("negative");
    expect(actionTone("post")).toBe("positive");
    expect(actionTone("submit")).toBe("status");
    expect(actionTone("update")).toBe("neutral");
  });
});

describe("ActivityLog", () => {
  it("lists entries newest first by day in the business time zone, with the action in words, the user and role, never the raw code", () => {
    render(<ActivityLog entries={entries} />);
    const days = screen.getAllByRole("region");
    expect(days.map((d) => d.getAttribute("aria-label"))).toEqual(["10/10/2026", "09/10/2026"]);
    const items = within(days[0]).getAllByRole("listitem");
    expect(within(items[0]).getByText("Approved", { selector: ".bv-activity-log__action" })).toBeInTheDocument();
    expect(within(items[0]).getByText("10/10/2026 13:30")).toBeInTheDocument();
    expect(within(items[0]).getByText("Fe Head")).toBeInTheDocument();
    expect(within(items[0]).getByText("Finance Manager")).toBeInTheDocument();
    expect(within(items[1]).getByText("Submitted")).toBeInTheDocument();
    expect(within(items[1]).getByText("10/10/2026 09:03")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Accounts > Remittance > Tracking")).toBeNull();
    expect(screen.queryByText(/^submit/)).toBeNull();
  });

  it("shows the status move as chips and the remarks", () => {
    render(<ActivityLog entries={entries} />);
    const move = screen.getByRole("group", { name: "Status changed from Pending Approval to Approved" });
    expect(within(move).getByText("Pending Approval")).toBeInTheDocument();
    expect(within(move).getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Checked against the statement")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Draft" })).toBeInTheDocument();
  });

  it("folds the changed fields under What changed, with before and after and secrets hidden", () => {
    render(<ActivityLog entries={entries} />);
    expect(screen.queryByRole("table")).toBeNull();
    const toggles = screen.getAllByRole("button", { name: "What changed" });
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /Approval level/ })).toHaveTextContent("1 of 22 of 2");
    expect(within(table).getByRole("row", { name: /TIN/ })).toHaveTextContent("HiddenHidden");
    fireEvent.click(toggles[1]);
    expect(within(screen.getAllByRole("table")[1]).getByRole("row", { name: /Batch ID/ })).toHaveTextContent("—BLK-2026-00001");
  });

  it("names the system when no user acted, and keeps the order asked for", () => {
    render(<ActivityLog order="asc" entries={[{ id: "a", at: "2026-10-10T00:00:00Z", actionCode: "run" }, { id: "b", at: "2026-10-09T00:00:00Z", actionCode: "settle" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Settled")).toBeInTheDocument();
    expect(within(items[1]).getByText("System")).toBeInTheDocument();
  });

  it("shows the empty, loading and error states", () => {
    const onRetry = jest.fn();
    const { rerender } = render(<ActivityLog entries={[]} />);
    expect(screen.getByText("No activity has been recorded for this record.")).toBeInTheDocument();
    rerender(<ActivityLog entries={[]} loading />);
    expect(screen.queryByText("No activity has been recorded for this record.")).toBeNull();
    rerender(<ActivityLog entries={[]} error="You do not have access to the history of this record" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("You do not have access to the history of this record");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<ActivityLog entries={[]} error />);
    expect(screen.getByRole("alert")).toHaveTextContent("The activity log could not be loaded.");
  });
});

describe("RecordActivityLog", () => {
  it("loads the audit trail of a record and retries after an error", async () => {
    auditService.getRecordHistory
      .mockRejectedValueOnce(new Error("Request failed (500)"))
      .mockResolvedValueOnce({ events: [{ id: "9", at: "2026-10-10T01:03:00Z", day: "2026-10-10", date: "10/10/2026", time: "09:03", action: "approve", title: "Journal voucher approved",
        user: { username: "f.head", displayName: "Fe Head", roles: ["Finance Manager"] }, note: "OK to post",
        changes: [{ key: "status", label: "Status", from: "Pending", to: "Posted" }] }], today: "2026-10-10" });
    render(<RecordActivityLog entity="journal_voucher" recordId="jv_1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Journal voucher approved")).toBeInTheDocument();
    expect(auditService.getRecordHistory).toHaveBeenLastCalledWith("journal_voucher", "jv_1");
    expect(screen.getByRole("group", { name: "Status changed from Pending to Posted" })).toBeInTheDocument();
    expect(screen.getByText("OK to post")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "What changed" })).toBeNull());
  });
});
