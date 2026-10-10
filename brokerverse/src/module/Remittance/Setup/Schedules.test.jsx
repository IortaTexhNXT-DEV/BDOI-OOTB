import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import { remittanceService, masterService } from "../../../services/remittanceService";
import adminService from "../../../services/adminService";
import opsAccountingService from "../../../services/opsAccountingService";
import { setDateFormat } from "../../../utility/dateFormat";
import Schedules from "./Schedules";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    listSchedules: jest.fn(), previewRun: jest.fn(), runSchedule: jest.fn(), scheduleRuns: jest.fn(), scheduleActivity: jest.fn(),
    setScheduleStatus: jest.fn(), updateSchedule: jest.fn(), createSchedule: jest.fn(),
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../services/adminService", () => ({ __esModule: true, default: { updateSchedule: jest.fn() } }));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const MSG_RMT_007 = "The payment window \"Previous Monday to Friday\" needs a weekly schedule. Choose Weekly, or the window \"Cut-off days\".";
const WINDOW_DONE = "This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15.";
const WRITE_ACTIONS = [{ code: "view", label: "View", allowed: true }, { code: "edit", label: "Edit", allowed: true }, { code: "preview", label: "Preview run", allowed: true },
  { code: "run-now", label: "Run now…", allowed: true }, { code: "pause", label: "Pause", allowed: true }];
const weekly = (actions = WRITE_ACTIONS) => ({
  id: 7, code: "TIS-WEEKLY", name: "Weekly remittance", kind: "Remittance run", frequency: "Weekly", paymentWindow: "Previous Monday to Friday", cutOffDays: 0,
  groupBy: "Insurer and product line", runTime: "06:15", allInsurers: true, insurers: [], nextRun: "2026-10-19", nextRunText: "Mon 19/10/2026 06:15",
  covers: { allActive: true, count: 2, insurers: [{ id: 3, code: "PIONEER", name: "Pioneer Insurance" }, { id: 4, code: "MALAYAN", name: "Malayan Insurance" }], label: "All active (2)" },
  runs: "Mondays 06:15", status: "Active", isActive: true, timeZone: "Asia/Manila", actions,
  lastRun: { at: "2026-10-11T22:15:00.000Z", text: "12/10/2026 06:15", result: "success", resultLabel: "Success", counts: { created: 6, held: 3, exceptions: 1 } },
});
const automation = (extra = {}) => ({ jobEnabled: false, checkedDaily: "06:15", timeZone: "Asia/Manila", lastCheckAt: null, lastStatus: null, ...extra });
const PREVIEW = {
  schedule: { id: 7, code: "TIS-WEEKLY", name: "Weekly remittance" }, runDate: "2026-10-12", paused: false,
  window: { from: "2026-10-05", to: "2026-10-09", text: "05/10/2026 – 09/10/2026" }, windowDone: { done: false },
  rows: [{ insurer: { id: 3, name: "Pioneer Insurance" }, productLine: "Motor", basis: "Net", ready: 12, held: 0, exceptions: 0, dueToInsurer: 409141.43,
    result: { code: "draft", label: "Draft will be created" } }],
  totals: { insurers: 1, drafts: 1, ready: 12, held: 0, exceptions: 0, dueToInsurer: 409141.43 },
};

const as = (roles, permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const show = () => render(<MemoryRouter><Schedules /><ConfirmDialogHost /></MemoryRouter>);
const openMenu = async (code) => fireEvent.click(await screen.findByRole("button", { name: `Actions for ${code}` }));
const rowMenu = () => screen.getByRole("menu", { name: "Actions for TIS-WEEKLY" });
const menuItem = (text) => within(rowMenu()).getByText(text);
const menuItems = () => within(rowMenu()).getAllByRole("menuitem");
const choose = async (label, option) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  fireEvent.click(await screen.findByRole("option", { name: option, hidden: true }));
};

beforeEach(() => {
  jest.clearAllMocks();
  setDateFormat("DD/MM/YYYY");
  masterService.options.mockResolvedValue([{ label: "Pioneer Insurance", code: "PIONEER", id: 3 }]);
  remittanceService.scheduleRuns.mockResolvedValue({ data: [], total: 0 });
  remittanceService.scheduleActivity.mockResolvedValue([]);
  remittanceService.previewRun.mockResolvedValue(PREVIEW);
  opsAccountingService.masterRecords.mockResolvedValue({ rows: [{ code: "ROC-MISSED", name: "Missed run", context: "remittance_off_cycle", status: "Active", sortOrder: 1 }] });
});

describe("Setup > Schedules", () => {
  it("shows the schedules, Automation Off as a danger chip, and Turn on with the cron for an administrator", async () => {
    as(["system-admin"], []);
    remittanceService.listSchedules.mockResolvedValue({ automation: automation({ cron: "15 6 * * *", jobCode: "remittance-schedules", link: "/master/configuration/schedules" }), schedules: [weekly()] });
    adminService.updateSchedule.mockResolvedValue({});
    show();
    expect(await screen.findByText("TIS-WEEKLY")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: "Automation: Off" });
    expect(chip).toHaveClass("bv-config-status--danger");
    expect(chip).toHaveTextContent("AutomationOff");
    expect(screen.getByText("Checked daily 06:15 (Asia/Manila)")).toBeInTheDocument();
    expect(screen.getByText("6 created · 3 held · 1 exception(s)")).toBeInTheDocument();
    expect(screen.getByText("Mon 19/10/2026 06:15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Technical details/ }));
    expect(screen.getByText("15 6 * * *")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    const confirm = within(await screen.findByRole("dialog"));
    expect(confirm.getByText("Turn on the daily remittance job?")).toBeInTheDocument();
    fireEvent.click(confirm.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(adminService.updateSchedule).toHaveBeenCalledWith("remittance-schedules", { enabled: true }));
    await waitFor(() => expect(remittanceService.listSchedules).toHaveBeenCalledTimes(2));
  });

  it("shows a read-only user no setting key, cron or menu path, a View only chip and a menu with View only", async () => {
    as(["tis-general-manager"], ["read:remittance"]);
    remittanceService.listSchedules.mockResolvedValue({ automation: automation(), schedules: [weekly([{ code: "view", label: "View", allowed: true }])] });
    const { container } = show();
    expect(await screen.findByText("TIS-WEEKLY")).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(container.textContent).not.toMatch(/\* \* \*|remittance\.\w|remittance-schedules|Master >|\/master\//);
    await openMenu("TIS-WEEKLY");
    expect(menuItems().map((i) => i.textContent)).toEqual(["View"]);
  });

  it("refuses Monthly with the Monday to Friday window under Frequency (MSG-RMT-007), as the server does", async () => {
    as(["tis-finance"], ["read:remittance", "write:remittance"]);
    remittanceService.listSchedules.mockResolvedValue({ automation: automation(), schedules: [weekly()] });
    show();
    await openMenu("TIS-WEEKLY");
    fireEvent.click(menuItem("Edit"));
    await screen.findByText("Edit TIS-WEEKLY");
    await choose("Frequency", "Monthly");
    expect(await screen.findByText(MSG_RMT_007)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(remittanceService.updateSchedule).not.toHaveBeenCalled();
    await choose("Frequency", "Weekly");
    await waitFor(() => expect(screen.queryByText(MSG_RMT_007)).toBeNull());
    remittanceService.updateSchedule.mockRejectedValueOnce(Object.assign(new Error("Validation failed"), { errors: [{ path: "frequency", code: "MSG-RMT-007", message: MSG_RMT_007 }] }));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(remittanceService.updateSchedule).toHaveBeenCalledWith(7, expect.objectContaining({ frequency: "Weekly", paymentWindow: "Previous Monday to Friday" })));
    expect(await screen.findByText(MSG_RMT_007)).toBeInTheDocument();
  });

  it("Run now previews the window and creates nothing until the verb is pressed with a reason", async () => {
    as(["tis-finance"], ["read:remittance", "write:remittance"]);
    remittanceService.listSchedules.mockResolvedValue({ automation: automation(), schedules: [weekly()] });
    remittanceService.runSchedule.mockResolvedValue({ message: "Weekly run done: 1 remittance(s) created, 0 policies held, 0 exceptions.",
      data: { drafts: [{ id: "rm_21", remittanceNo: "REM-2026-00021", insurer: "Pioneer Insurance", dueToInsurer: 409141.43, link: "/finance/remittance/remittances/rm_21" }] } });
    show();
    await openMenu("TIS-WEEKLY");
    fireEvent.click(menuItem("Run now…"));
    expect(await screen.findByText("05/10/2026 – 09/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Draft will be created")).toBeInTheDocument();
    expect(screen.getAllByText(/409,141\.43/).length).toBeGreaterThan(0);
    const verb = screen.getByRole("button", { name: "Create 1 draft remittance" });
    fireEvent.click(verb);
    expect(await screen.findByText("Choose the reason")).toBeInTheDocument();
    expect(remittanceService.runSchedule).not.toHaveBeenCalled();
    await choose(/Reason/, "Missed run");
    fireEvent.click(verb);
    await waitFor(() => expect(remittanceService.runSchedule).toHaveBeenCalledWith(7, { reasonCode: "ROC-MISSED", note: undefined }));
    expect(await screen.findByText("Weekly run done: 1 remittance(s) created, 0 policies held, 0 exceptions.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "REM-2026-00021" })).toHaveAttribute("href", "/finance/remittance/remittances/rm_21");
    expect(screen.getByRole("button", { name: "Go to drafts" })).toBeInTheDocument();
  });

  it("once the window has run, Run now is disabled with the reason and the next run, in the menu and in the dialog", async () => {
    as(["tis-finance"], ["read:remittance", "write:remittance"]);
    const blocked = WRITE_ACTIONS.map((a) => (a.code === "run-now" ? { ...a, allowed: false, blockedCode: "WINDOW_DONE", blockedReason: WINDOW_DONE } : a));
    remittanceService.listSchedules.mockResolvedValue({ automation: automation({ jobEnabled: true }), schedules: [weekly(blocked)] });
    remittanceService.previewRun.mockResolvedValue({ ...PREVIEW, windowDone: { done: true, message: WINDOW_DONE } });
    show();
    expect(await screen.findByRole("status", { name: "Automation: On" })).not.toHaveClass("bv-config-status--danger");
    await openMenu("TIS-WEEKLY");
    const runNow = menuItems()[3];
    expect(runNow).toHaveAttribute("aria-disabled", "true");
    expect(runNow).toHaveTextContent(WINDOW_DONE);
    fireEvent.click(menuItem("Preview run"));
    expect(await screen.findByText("Preview run · TIS-WEEKLY")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create/ })).toBeNull();
    expect(remittanceService.runSchedule).not.toHaveBeenCalled();
  });

  it("pauses a schedule after the confirmation that names the consequence", async () => {
    as(["tis-finance"], ["read:remittance", "write:remittance"]);
    remittanceService.listSchedules.mockResolvedValue({ automation: automation(), schedules: [weekly()] });
    remittanceService.setScheduleStatus.mockResolvedValue({});
    show();
    await openMenu("TIS-WEEKLY");
    fireEvent.click(menuItem("Pause"));
    const confirm = within(await screen.findByRole("dialog"));
    expect(confirm.getByText("Pause TIS-WEEKLY?")).toBeInTheDocument();
    expect(confirm.getByText("No remittance is created until it is resumed.")).toBeInTheDocument();
    fireEvent.click(confirm.getByRole("button", { name: "Pause schedule" }));
    await waitFor(() => expect(remittanceService.setScheduleStatus).toHaveBeenCalledWith(7, "Paused"));
  });
});
