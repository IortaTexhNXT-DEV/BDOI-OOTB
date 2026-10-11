import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GoLive from "./GoLive";
import { approverProblems, noGoProblems } from "./DecisionBlock";
import { timeLeft, unlockProblems } from "./LockBlock";
import { settingText, settingsProblems } from "./SettingsBlock";
import { WorkspaceContext } from "./shared";
import goLiveService from "../../services/goLiveService";
import { APPROVE, WRITE, decision, goLiveState, runRecord, signIn } from "./testData";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../services/goLiveService", () => {
  const real = jest.requireActual("../../services/goLiveService");
  const fns = Object.fromEntries(Object.keys(real.default).filter((k) => typeof real.default[k] === "function").map((k) => [k, jest.fn()]));
  return { __esModule: true, saveFile: jest.fn(), default: { ...fns, paths: real.default.paths } };
});

const renderPage = () => render(
  <WorkspaceContext.Provider value={{ notify: jest.fn(), overview: null, reloadOverview: jest.fn() }}>
    <MemoryRouter><GoLive /></MemoryRouter>
  </WorkspaceContext.Provider>,
);
const t = (k) => k;
const lockRequest = (patch = {}) => ({ id: 3, action: "unlock", status: "pending", reason: "Late legacy claim", decisionRef: null, scope: ["migration"], scopeLabels: ["Migration workbook"],
  hours: 4, requestedBy: "Requester", requestedById: "usr_req", requestedAt: "2026-11-03T02:00:00Z", ...patch });

beforeEach(() => {
  jest.clearAllMocks();
  goLiveService.goLive.mockResolvedValue(goLiveState());
  goLiveService.lockRequests.mockResolvedValue([]);
  goLiveService.runs.mockResolvedValue({ rows: [runRecord({ restorePoint: "2026-10-31T14:00:00Z" })], total: 1, extra: {} });
  goLiveService.sapOpening.mockResolvedValue({ enabled: false, journal: null, requests: [] });
  goLiveService.decisions.mockResolvedValue([decision()]);
  goLiveService.users.mockResolvedValue([]);
});

describe("Go / No-Go voting", () => {
  it("lets a named approver vote Go with a remark", async () => {
    signIn(APPROVE, { userId: "usr_me" });
    goLiveService.vote.mockResolvedValue(decision({ status: "go" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.decision.voteGo" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Trial balance agrees" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.decision.voteGo" }));
    await waitFor(() => expect(goLiveService.vote).toHaveBeenCalledWith(2, { vote: "go", remarks: "Trial balance agrees" }));
  });

  it("asks a No-Go voter for the reason, the actions and the new date", async () => {
    signIn(APPROVE, { userId: "usr_me" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.decision.voteNoGo" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.decision.voteNoGo" }));
    expect(await within(dialog).findByText("goLive.decision.reasonRequired")).toBeInTheDocument();
    expect(within(dialog).getByText("goLive.decision.actionsRequired")).toBeInTheDocument();
    expect(within(dialog).getByText("goLive.decision.newDateRequired")).toBeInTheDocument();
    expect(goLiveService.vote).not.toHaveBeenCalled();
  });

  it("offers no vote to a user who is not a named approver, or who voted", async () => {
    signIn(APPROVE, { userId: "usr_other" });
    const { unmount } = renderPage();
    await screen.findByText("goLive.decision.titleOf");
    expect(screen.queryByRole("button", { name: "goLive.decision.voteGo" })).toBeNull();
    unmount();
    signIn(APPROVE, { userId: "usr_me" });
    goLiveService.decisions.mockResolvedValue([decision({ approvers: [{ userId: "usr_me", name: "Me", roleLabel: "Finance Head", vote: "go", remarks: "OK", votedAt: "2026-11-01T08:00:00Z" }] })]);
    renderPage();
    await screen.findByText("goLive.decision.titleOf");
    expect(screen.queryByRole("button", { name: "goLive.decision.voteGo" })).toBeNull();
  });

  it("checks the approvers of a new decision and a No-Go vote", () => {
    expect(approverProblems([{ userId: "a", roleLabel: "Finance Head" }], t)).toEqual({ approvers: "goLive.decision.minApprovers" });
    expect(approverProblems([{ userId: "a", roleLabel: "Finance Head" }, { userId: "a", roleLabel: "GM" }], t)).toEqual({ approvers: "goLive.decision.approverTwice" });
    expect(approverProblems([{ userId: "a", roleLabel: "IT Head" }, { userId: "b", roleLabel: "GM" }], t)).toEqual({ approvers: "goLive.decision.financeHeadRequired" });
    expect(approverProblems([{ userId: "a", roleLabel: "Finance Head" }, { userId: "b", roleLabel: "General Manager" }], t)).toEqual({});
    expect(noGoProblems({ reason: "TB differs", actions: "Explain", newDate: "2026-11-09" }, t)).toEqual({});
  });
});

describe("go-live lock", () => {
  it("requests the lock with a reason once every condition is met", async () => {
    signIn(WRITE, { userId: "usr_me" });
    goLiveService.requestLock.mockResolvedValue(lockRequest({ action: "lock" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.lock.requestLock" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Go decision taken on 01/11" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.lock.requestLock" }));
    await waitFor(() => expect(goLiveService.requestLock).toHaveBeenCalledWith({ action: "lock", reason: "Go decision taken on 01/11" }));
  });

  it("keeps the lock request closed while a condition is not met", async () => {
    signIn(WRITE, { userId: "usr_me" });
    goLiveService.goLive.mockResolvedValue(goLiveState({ conditions: [{ code: "go-decision", label: "Go", met: false, detail: null }] }));
    renderPage();
    expect(await screen.findByRole("button", { name: "goLive.lock.requestLock" })).toBeDisabled();
  });

  it("validates an unlock request: imports, hours within the limit, reason, steering committee reference after the window", async () => {
    signIn(WRITE, { userId: "usr_me" });
    goLiveService.goLive.mockResolvedValue(goLiveState({ locked: true, lockedAt: "2026-11-01T14:00:00Z", unlockWindowEndsAt: "2026-11-08T14:00:00Z" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.lock.requestUnlock" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.lock.requestUnlock" }));
    expect(await within(dialog).findByText("goLive.lock.scopeRequired")).toBeInTheDocument();
    expect(within(dialog).getByText("goLive.lock.reasonRequired")).toBeInTheDocument();
    expect(goLiveService.requestLock).not.toHaveBeenCalled();

    const limits = { maxHours: 4, windowEndsAt: "2026-11-08T14:00:00Z" };
    const inWindow = Date.parse("2026-11-03T00:00:00Z");
    const ok = { scope: ["migration"], hours: 4, reason: "Late legacy claim", decisionRef: "" };
    expect(unlockProblems(ok, limits, t, inWindow)).toEqual({});
    expect(unlockProblems({ ...ok, hours: 5 }, limits, t, inWindow)).toEqual({ hours: "goLive.lock.hoursRange" });
    expect(unlockProblems(ok, limits, t, Date.parse("2026-11-09T00:00:00Z"))).toEqual({ decisionRef: "goLive.lock.decisionRefRequired" });
    expect(unlockProblems({ ...ok, decisionRef: "SC-2026-11" }, limits, t, Date.parse("2026-11-09T00:00:00Z"))).toEqual({});
  });

  it("shows the time left before an unlock relocks itself", async () => {
    signIn(WRITE, { userId: "usr_me" });
    const expiresAt = new Date(Date.now() + 2 * 3600000 + 14 * 60000).toISOString();
    goLiveService.goLive.mockResolvedValue(goLiveState({ locked: true, lockedAt: "2026-11-01T14:00:00Z", unlock: { id: 3, scope: ["migration"], expiresAt } }));
    renderPage();
    expect(await screen.findByText("goLive.lock.relocksIn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "goLive.lock.requestUnlock" })).toBeNull();
    expect(timeLeft(expiresAt)).toMatch(/^2 h 1[45] min$/);
    expect(timeLeft("2026-01-01T00:00:00Z")).toBe("0 min");
  });

  it("keeps the approval of a lock request from its requester", async () => {
    goLiveService.goLive.mockResolvedValue(goLiveState({ locked: true, lockedAt: "2026-11-01T14:00:00Z", pendingRequest: lockRequest() }));
    signIn(APPROVE, { userId: "usr_req" });
    const { unmount } = renderPage();
    expect(await screen.findByRole("button", { name: "goLive.lock.approve.unlock" })).toBeDisabled();
    unmount();
    signIn(APPROVE, { userId: "usr_gm" });
    goLiveService.approveLock.mockResolvedValue(lockRequest({ status: "approved" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.lock.approve.unlock" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("goLive.lock.approveUnlockMessage")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.lock.approve.unlock" }));
    await waitFor(() => expect(goLiveService.approveLock).toHaveBeenCalledWith(3));
  });
});

describe("settings of the Go-Live tab", () => {
  const defs = [
    { field: "kpiIncludeMigrated", label: "KPIs", type: "boolean", beforeLock: false },
    { field: "unlockMaxHours", label: "Hours", type: "integer", min: 1, max: 24, allowZero: false, beforeLock: false },
    { field: "evidenceRetentionYears", label: "Years", type: "integer", min: 10, max: 50, allowZero: true, beforeLock: false },
    { field: "documentTypes", label: "Types", type: "codes", beforeLock: false },
  ];
  it("checks the bounds, the lists and the reason of a change", () => {
    expect(settingsProblems(defs, { kpiIncludeMigrated: true, unlockMaxHours: 4, evidenceRetentionYears: 0, documentTypes: ["COC"] }, "Steering committee", t)).toEqual({});
    expect(Object.keys(settingsProblems(defs, { unlockMaxHours: 720, evidenceRetentionYears: 5, documentTypes: [] }, "", t)).sort())
      .toEqual(["documentTypes", "evidenceRetentionYears", "reason", "unlockMaxHours"]);
    expect(settingText(t, defs[0], true)).toBe("goLive.common.yes");
    expect(settingText(t, defs[2], 0)).toBe("goLive.settings.forEver");
  });

  it("asks another approver to approve a settings change; the requester only withdraws it", async () => {
    signIn(APPROVE, { userId: "usr_req" });
    goLiveService.goLive.mockResolvedValue(goLiveState({ settingDefinitions: defs, settings: { kpiIncludeMigrated: false, unlockMaxHours: 4, evidenceRetentionYears: 10, documentTypes: ["COC"] },
      pendingRequest: lockRequest({ action: "settings", scope: [], scopeLabels: [], hours: null, settings: [{ field: "kpiIncludeMigrated", label: "KPIs", before: false, after: true }] }) }));
    renderPage();
    expect(await screen.findByText("goLive.settings.title")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "goLive.lock.withdrawRequest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "goLive.settings.requestChange" })).toBeDisabled();
  });
});
