import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import { remittanceService, masterService } from "../../../services/remittanceService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import Remittances from ".";
import { mondayOf, recentWeeks, segmentOf, sortOf, sortParam, submittable, weekParam, weekText } from "./worklist";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    listRegister: jest.fn(), summary: jest.fn(), listSchedules: jest.fn(), submitRemittances: jest.fn(), download: jest.fn(),
    exportRegisterPath: jest.fn(() => "/remittance/remittances/export.xlsx"), listImports: jest.fn(), importLimits: jest.fn(), getImport: jest.fn(),
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ rows: [] }) } }));

const VIEW = { code: "view", label: "View", allowed: true, link: "/finance/remittance/remittances/rm_1" };
const DOWNLOADS = [
  { code: "download-schedule-xlsx", label: "Download schedule (XLSX)", allowed: true, href: "/remittance/remittances/rm_1/schedule.xlsx" },
  { code: "download-schedule-pdf", label: "Download schedule (PDF)", allowed: true, href: "/remittance/remittances/rm_1/schedule.pdf" },
];
const SUBMIT = { code: "submit", label: "Submit for approval", allowed: true };
const row = (n, extra = {}) => ({
  id: `rm_${n}`, remittanceNo: `REM-2026-000${n}`, kind: "direct-bill", status: "draft", statusLabel: "Draft", version: 2,
  insurer: { id: 3, code: "PIONEER", name: "Pioneer Insurance & Surety Corp.", shortName: "Pioneer" }, productLine: "Motor", basisLabel: "Net",
  coverageWeek: { from: "2026-10-05", to: "2026-10-09" }, source: { code: "weekly-run", label: "Weekly run" }, offCycleReason: null, policyCount: 12, heldCount: null,
  dueToInsurer: 100000 * n, dueDate: "2026-10-16", overdue: false, flags: { offCycle: false, overdue: false, openExceptions: 0 },
  nextStep: { code: "submit", label: "Submit for approval" }, actions: [VIEW, SUBMIT, ...DOWNLOADS], voucher: null, link: `/finance/remittance/remittances/rm_${n}`,
  submittedBy: null, createdBy: { id: null, name: "System" }, createdAt: "2026-10-12T01:00:00.000Z",
  ...extra,
});
const pending = (n, label) => row(n, { status: "for-approval", statusLabel: "Pending approval", nextStep: { code: "approve", label }, actions: [VIEW, ...DOWNLOADS] });
const kpis = { toSubmit: { count: 3, amount: 600000 }, awaitingApproval: { count: 2, amount: 900000 }, approvedNotPaid: { count: 1, amount: 50000, oldestDays: 4 }, overdue: { count: 0, amount: 0 } };
const page = (rows, extra = {}) => ({
  data: rows, total: rows.length, segment: "my-work", kpis, segments: { "my-work": 3, drafts: 3, "in-approval": 2, "in-payment": 1, all: 6 },
  totals: { count: rows.length, dueToInsurer: 1234567.89 }, ...extra,
});
const strip = { lastRun: { scheduleCode: "TIS-WEEKLY", text: "12/10/2026 06:15", counts: { created: 3, held: 0, exceptions: 0 }, failed: false },
  nextRun: { scheduleCode: "TIS-WEEKLY", text: "Mon 19/10/2026 06:15" }, automation: { on: true } };

const show = (path = "/finance/remittance/remittances") => render(
  <MemoryRouter initialEntries={[path]}><Remittances /><ConfirmDialogHost /></MemoryRouter>
);
const signIn = (roles, permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const lastParams = () => remittanceService.listRegister.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  signIn(["tis-finance"], ["read:remittance", "write:remittance", "read:disbursements"]);
  masterService.options.mockResolvedValue([{ label: "Pioneer Insurance & Surety Corp.", code: "PIONEER", id: 3 }]);
  remittanceService.summary.mockResolvedValue({ runStrip: strip });
  remittanceService.listSchedules.mockResolvedValue({ schedules: [{ id: 7, code: "TIS-WEEKLY", name: "Weekly remittance", isActive: true }] });
  remittanceService.download.mockResolvedValue();
});

describe("Remittances worklist", () => {
  it("opens My work for a preparer; pending rows have no tick box and name who they wait on", async () => {
    remittanceService.listRegister.mockResolvedValue(page([row(1), pending(2, "Awaiting J. Cruz"), pending(3, "Awaiting remittance approver (2)")]));
    show();
    expect(await screen.findByText("Awaiting J. Cruz")).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ segment: "my-work", week: undefined, perPage: 50 });
    expect(screen.getByText("Awaiting remittance approver (2)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select REM-2026-0001" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select REM-2026-0002" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select REM-2026-0003" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select drafts to submit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import policy list" })).toBeInTheDocument();
    expect(screen.getByText("My work (3)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekly run: 12/10/2026 06:15 · 3 created · 0 held · 0 exception(s)" })).toBeInTheDocument();
    expect(screen.getByText("Mon 19/10/2026 06:15")).toBeInTheDocument();
  });

  it("submits 3 drafts after the confirmation; a draft that fails a guard shows its reason in its row while the others submit", async () => {
    remittanceService.listRegister.mockResolvedValue(page([row(1), row(2), row(3)]));
    remittanceService.submitRemittances.mockResolvedValue({ submitted: 2, refused: 1, results: [
      { id: "rm_1", reference: "REM-2026-0001", ok: true, message: "Submitted" },
      { id: "rm_2", reference: "REM-2026-0002", ok: false, code: "INVALID", message: "Not submitted: Due to insurer must be greater than zero" },
      { id: "rm_3", reference: "REM-2026-0003", ok: true, message: "Submitted" },
    ] });
    show();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select every draft on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval (3)" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Submit 3 remittances totalling PHP 600,000.00 for approval? Another user with remittance authority approves them.")).toBeInTheDocument();
    expect(remittanceService.submitRemittances).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit 3 remittances" }));
    await waitFor(() => expect(remittanceService.submitRemittances).toHaveBeenCalledWith([{ id: "rm_1", version: 2 }, { id: "rm_2", version: 2 }, { id: "rm_3", version: 2 }]));
    expect(await screen.findByText("2 submitted · 1 not submitted")).toBeInTheDocument();
    expect(screen.getAllByText("Not submitted: Due to insurer must be greater than zero")).toHaveLength(2);
    expect(screen.getAllByText("Submitted").length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(remittanceService.listRegister).toHaveBeenCalledTimes(2));
  });

  it("shows in the row that another user submitted the draft meanwhile", async () => {
    remittanceService.listRegister.mockResolvedValue(page([row(21)]));
    remittanceService.submitRemittances.mockResolvedValue({ submitted: 0, refused: 1, results: [
      { id: "rm_21", reference: "REM-2026-00021", ok: false, code: "ALREADY_SUBMITTED", message: "REM-2026-00021 was submitted by J. Cruz at 10:12." },
    ] });
    show();
    const menu = await screen.findByRole("button", { name: "Actions for REM-2026-00021" });
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: "Submit for approval" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit 1 remittance" }));
    expect(await screen.findAllByText("REM-2026-00021 was submitted by J. Cruz at 10:12.")).not.toHaveLength(0);
  });

  it("a General Manager views only: no tick box, primary button, Run now or Import; the row menu has View and downloads", async () => {
    signIn(["tis-general-manager"], ["read:remittance", "read:disbursements"]);
    remittanceService.listRegister.mockResolvedValue(page([row(1, { actions: [VIEW, ...DOWNLOADS] })], { segment: "all" }));
    show();
    expect(await screen.findByText("REM-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ segment: "all", week: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit for approval|Select drafts to submit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import policy list" })).not.toBeInTheDocument();
    expect(screen.queryByText(/My work/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const overflow = within(screen.getByRole("menu")).getAllByRole("menuitem").map((m) => m.textContent);
    expect(overflow).toEqual(["Run history", "Import history", "Export XLSX"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Actions for REM-2026-0001" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["View", "Download schedule (XLSX)", "Download schedule (PDF)"]);
  });

  it("takes the KPI figures and the total from the server; a card filters the list over the same filters", async () => {
    remittanceService.listRegister.mockResolvedValue(page([row(1)]));
    show();
    expect(await screen.findByText("PHP 1,234,567.89")).toBeInTheDocument();
    expect(screen.getByText("PHP 600,000.00")).toBeInTheDocument();
    expect(screen.getByText("oldest 4 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Awaiting approval/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ segment: "all", kpi: "awaiting-approval", week: undefined }));
  });

  it("shows no setting key, menu path or explanatory sentence", async () => {
    remittanceService.listRegister.mockResolvedValue(page([row(1)]));
    const { container } = show();
    await screen.findByText("REM-2026-0001");
    const text = container.textContent;
    expect(text).not.toMatch(/\b[a-z]+(_[a-z]+)*\.[a-z_]+\.[a-z_]+/);
    expect(text).not.toMatch(/ > /);
    expect(text).not.toMatch(/remittance\.(status_labels|bulk_upload_enabled|import_max_rows)/);
  });

  it("says why a segment is empty, and offers Try again when the list cannot load", async () => {
    remittanceService.listRegister.mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([row(1)]));
    show();
    expect(await screen.findByText("Nothing needs your action. Next run Mon 19/10/2026 06:15.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Drafts (3)"));
    expect(await screen.findByText("Could not load remittances.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("REM-2026-0001")).toBeInTheDocument();
  });

  it("marks an overdue due date and an off-cycle week; the Source column chosen earlier names the import", async () => {
    localStorage.setItem("bv.remittances.columns", JSON.stringify(["source"]));
    remittanceService.listRegister.mockResolvedValue(page([row(4, { overdue: true, flags: { offCycle: true, overdue: true, openExceptions: 0 },
      offCycleReason: { text: "Go-live opening" }, source: { code: "import", label: "Import IMP-2026-0004" } })]));
    show();
    expect(await screen.findByText("16/10/2026 · Overdue")).toBeInTheDocument();
    expect(screen.getByTitle("Go-live opening")).toHaveTextContent("Off-cycle");
    expect(screen.getByText("Import IMP-2026-0004")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
  });
});

describe("worklist helpers", () => {
  it("defaults to My work for a preparer and All for a reader", () => {
    expect(segmentOf(undefined, true)).toBe("my-work");
    expect(segmentOf(undefined, false)).toBe("all");
    expect(segmentOf("my-work", false)).toBe("all");
    expect(segmentOf("in-payment", false)).toBe("in-payment");
  });

  it("asks for the current week on All and every week elsewhere", () => {
    expect(mondayOf("2026-10-10")).toBe("2026-10-05");
    expect(weekParam(undefined, "all", "2026-10-10")).toBe("2026-10-05");
    expect(weekParam(undefined, "drafts", "2026-10-10")).toBeUndefined();
    expect(weekParam("all", "all", "2026-10-10")).toBeUndefined();
    expect(weekText({ from: "2026-10-05", to: "2026-10-09" })).toBe("05/10–09/10/2026");
    expect(recentWeeks("2026-10-10", 2)).toEqual([{ from: "2026-10-05", to: "2026-10-09" }, { from: "2026-09-28", to: "2026-10-02" }]);
  });

  it("only drafts with an allowed submit can be ticked; sorting reads and writes the server's parameter", () => {
    expect(submittable([row(1), pending(2, "x"), row(3, { actions: [VIEW, { ...SUBMIT, allowed: false, blockedReason: "No policies" }] })]).map((r) => r.id)).toEqual(["rm_1"]);
    expect(sortOf("-dueDate")).toEqual({ sortField: "dueDate", sortOrder: -1 });
    expect(sortParam("dueToInsurer", 1)).toBe("dueToInsurer");
    expect(sortParam("dueToInsurer", -1)).toBe("-dueToInsurer");
    expect(sortParam(null, 0)).toBeNull();
  });
});
