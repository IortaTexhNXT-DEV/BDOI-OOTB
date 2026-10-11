import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GoLiveWorkspace, { TABS, tabOf } from "./index";
import goLiveService from "../../services/goLiveService";
import { READ, ALL, batchResponse, decision, goLiveState, overview, reconciliation, runRecord, signIn, step, steps } from "./testData";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../services/goLiveService", () => {
  const real = jest.requireActual("../../services/goLiveService");
  const fns = Object.fromEntries(Object.keys(real.default).filter((k) => typeof real.default[k] === "function").map((k) => [k, jest.fn()]));
  return { __esModule: true, saveFile: jest.fn(), default: { ...fns, paths: real.default.paths } };
});
jest.mock("../../services/opsAccountingService", () => ({ masterRecords: jest.fn(() => Promise.resolve({ rows: [] })) }));
jest.mock("../../services/auditService", () => ({ getRecordHistory: jest.fn(() => Promise.resolve({ events: [] })) }));

const ROOT = "/master/configuration/go-live";
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/master/configuration/go-live/*" element={<GoLiveWorkspace />} /></Routes>
  </MemoryRouter>,
);
const page = (rows) => Promise.resolve({ rows, total: rows.length, extra: {} });

beforeEach(() => {
  jest.clearAllMocks();
  goLiveService.overview.mockResolvedValue(overview);
  goLiveService.kits.mockResolvedValue({ kits: [{ kit: "migration", title: "Migration", sheets: [{ key: "clients", name: "Clients", keyColumns: ["clientCode"], dependsOn: [],
    columns: [{ key: "clientCode", header: "Client Code" }] }] }], naming: { pattern: "<RecordType>_<RecordNumber>", example: "POL_X_POLSCH_20260225.pdf",
    recordTypes: [{ code: "POL", label: "Policy" }], documentTypes: ["POLSCH"], extensions: ["pdf"] } });
  goLiveService.valueMaps.mockResolvedValue({ rows: [], total: 0, extra: { objects: [{ key: "insurer", label: "Insurer" }] } });
  goLiveService.batches.mockImplementation(() => page([batchResponse().batch]));
  goLiveService.batch.mockResolvedValue(batchResponse({ status: "pending-approval", submittedById: "usr_loader" }));
  goLiveService.batchRows.mockImplementation(() => page([]));
  goLiveService.batchDuplicates.mockImplementation(() => page([]));
  goLiveService.reconciliations.mockImplementation(() => page([]));
  goLiveService.reconciliation.mockResolvedValue(reconciliation());
  goLiveService.runs.mockImplementation(() => page([runRecord()]));
  goLiveService.run.mockResolvedValue({ ...runRecord(), loadsList: [], steps: [], reconciliations: [], decisions: [], defectsByStatus: {},
    timings: { validateMs: 0, loadMs: 0, undoMs: 0, rowsLoaded: 0, stepsDone: 0, steps: 0, lateSteps: [], elapsedMs: null } });
  goLiveService.defects.mockResolvedValue([]);
  goLiveService.steps.mockResolvedValue(steps([step({ status: "in-progress", actualStart: "2026-10-31T14:02:00Z" })]));
  goLiveService.evidence.mockResolvedValue([]);
  goLiveService.users.mockResolvedValue([]);
  goLiveService.goLive.mockResolvedValue(goLiveState());
  goLiveService.lockRequests.mockResolvedValue([]);
  goLiveService.sapOpening.mockResolvedValue({ enabled: false, journal: null, requests: [] });
  goLiveService.decisions.mockResolvedValue([decision()]);
  goLiveService.hypercare.mockResolvedValue({ started: false, hypercareDays: 28, cutoverDate: "2026-11-02" });
});

describe("Data Migration & Go-Live workspace", () => {
  it("maps every address to its tab, a record page to the tab of its list", () => {
    expect(TABS.map((t) => t.key)).toEqual(["overview", "templates", "loads", "reconciliation", "runs", "cutover", "decision", "hypercare"]);
    expect(tabOf(ROOT)).toBe(0);
    expect(tabOf(`${ROOT}/loads/12`)).toBe(2);
    expect(tabOf(`${ROOT}/runs/3`)).toBe(4);
    expect(tabOf(`${ROOT}/hypercare`)).toBe(7);
  });

  it.each([
    ["", "goLive.overview.latestLoads"],
    ["/templates", "goLive.templates.valueMaps"],
    ["/loads", "goLive.loads.title"],
    ["/loads/12", "MIG-000012"],
    ["/reconciliation", "goLive.recon.title"],
    ["/reconciliation/7", "REC-000007"],
    ["/runs", "goLive.runs.title"],
    ["/runs/3", "RUN-000003 · Production cutover"],
    ["/cutover", "goLive.cutover.checklist"],
    ["/decision", "goLive.lock.title"],
    ["/hypercare", "goLive.hypercare.notStarted"],
  ])("opens the tab at %s", async (path, heading) => {
    signIn(ALL);
    renderAt(`${ROOT}${path}`);
    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "goLive.title" })).toBeInTheDocument();
    expect(await screen.findByText("goLive.header.cutover: 02/11/2026")).toBeInTheDocument();
  });

  it.each([
    ["/loads", "goLive.loads.title", ["goLive.loads.upload"]],
    ["/loads/12", "MIG-000012", ["goLive.load.approveLoad", "goLive.load.rejectLoad", "goLive.load.submit", "goLive.load.withdrawLoad", "goLive.load.validateAgain"]],
    ["/reconciliation/7", "REC-000007", ["goLive.recon.sign", "goLive.recon.recompute", "goLive.recon.uploadControlTotals"]],
    ["/runs/3", "RUN-000003 · Production cutover", ["goLive.runs.completeRun", "goLive.runs.cancelRun", "goLive.runs.editRun"]],
    ["/cutover", "goLive.cutover.checklist", ["goLive.cutover.markDone", "goLive.cutover.start"]],
    ["/decision", "goLive.lock.title", ["goLive.lock.requestLock", "goLive.decision.voteGo", "goLive.decision.voteNoGo", "goLive.cutoverDate.change"]],
    ["/templates", "goLive.templates.valueMaps", ["goLive.templates.addMap", "common.upload"]],
  ])("shows a read-only user %s without an action button", async (path, heading, hidden) => {
    signIn(READ, { roles: ["tis-auditor"], userId: "usr_auditor" });
    renderAt(`${ROOT}${path}`);
    expect(await screen.findByText(heading)).toBeInTheDocument();
    await waitFor(() => expect(goLiveService.overview).toHaveBeenCalled());
    for (const name of hidden) expect(screen.queryByRole("button", { name })).toBeNull();
  }, 15000);
});
