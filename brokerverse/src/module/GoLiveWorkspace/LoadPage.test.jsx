import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoadPage, { POLL_MS } from "./LoadPage";
import { resolutionProblems } from "./DuplicatesTab";
import { WorkspaceContext } from "./shared";
import goLiveService from "../../services/goLiveService";
import { APPROVE, WRITE, batchResponse, duplicateRow, signIn } from "./testData";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../services/goLiveService", () => {
  const real = jest.requireActual("../../services/goLiveService");
  const fns = Object.fromEntries(Object.keys(real.default).filter((k) => typeof real.default[k] === "function").map((k) => [k, jest.fn()]));
  return { __esModule: true, saveFile: jest.fn(), default: { ...fns, paths: real.default.paths } };
});
jest.mock("../../services/opsAccountingService", () => ({ masterRecords: jest.fn(() => Promise.resolve({ rows: [] })) }));
jest.mock("../../services/auditService", () => ({ getRecordHistory: jest.fn(() => Promise.resolve({ events: [] })) }));

const notify = jest.fn();
const renderPage = (overview = { locked: false }) => render(
  <WorkspaceContext.Provider value={{ notify, overview, reloadOverview: jest.fn() }}>
    <MemoryRouter initialEntries={["/master/configuration/go-live/loads/12"]}>
      <Routes><Route path="/master/configuration/go-live/loads/:id" element={<LoadPage />} /></Routes>
    </MemoryRouter>
  </WorkspaceContext.Provider>,
);
const page = (rows) => Promise.resolve({ rows, total: rows.length, extra: {} });
const button = (name) => screen.getByRole("button", { name });
const openTab = (name) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  jest.clearAllMocks();
  goLiveService.batchRows.mockImplementation(() => page([]));
  goLiveService.batchDuplicates.mockImplementation(() => page([]));
});
afterEach(() => jest.useRealTimers());

describe("load page", () => {
  it("follows the job of a load every few seconds, also when the page is opened while it runs, and stops once it is loaded", async () => {
    jest.useFakeTimers();
    signIn(WRITE);
    goLiveService.batch
      .mockResolvedValueOnce(batchResponse({ status: "running", progress: { stage: "queued", step: "load", behind: "MIG-000011", done: 0, total: 480 } }, { queue: { jobStatus: "waiting", ahead: 1, behind: "MIG-000011" } }))
      .mockResolvedValueOnce(batchResponse({ status: "running", progress: { stage: "running", step: "load", sheet: "Clients", done: 200, total: 480 } }))
      .mockResolvedValue(batchResponse({ status: "loaded", loadedAt: "2026-10-28T09:10:00Z" }));
    renderPage();
    expect(await screen.findByText("goLive.load.queuedBehind")).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(POLL_MS); });
    expect(await screen.findByText("goLive.load.step.load · Clients")).toBeInTheDocument();
    expect(screen.getByTestId("progress-meter")).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(POLL_MS); });
    await waitFor(() => expect(screen.queryByTestId("progress-meter")).toBeNull());
    expect(goLiveService.batch).toHaveBeenCalledTimes(3);
    await act(async () => { jest.advanceTimersByTime(POLL_MS * 3); });
    expect(goLiveService.batch).toHaveBeenCalledTimes(3);
  });

  it("warns when the file is the file of another load", async () => {
    signIn(WRITE);
    goLiveService.batch.mockResolvedValue(batchResponse({ sameFileAs: { loadNumber: "MIG-000010", status: "loaded" } }));
    renderPage();
    expect(await screen.findByText("goLive.load.sameFile")).toBeInTheDocument();
  });

  it("submits a validated load after a confirmation that names it", async () => {
    signIn(WRITE);
    goLiveService.batch.mockResolvedValue(batchResponse());
    goLiveService.submitBatch.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.load.submit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("goLive.load.submitMessage")).toBeInTheDocument();
    expect(goLiveService.submitBatch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.load.submit" }));
    await waitFor(() => expect(goLiveService.submitBatch).toHaveBeenCalledWith(12, false));
  });

  it("blocks the approval for a maker of the load and lets another approver load it after the confirmation", async () => {
    goLiveService.batch.mockResolvedValue(batchResponse({ status: "pending-approval", submittedById: "usr_loader" }, { makers: { load: ["usr_loader", "usr_resolver"], undo: [] } }));
    signIn(APPROVE, { userId: "usr_resolver" });
    const { unmount } = renderPage();
    expect(await screen.findByRole("button", { name: "goLive.load.approveLoad" })).toBeDisabled();
    expect(button("goLive.load.rejectLoad")).toBeDisabled();
    expect(screen.getByText("makerChecker.ownRecord")).toBeInTheDocument();
    unmount();

    signIn(APPROVE, { userId: "usr_approver" });
    goLiveService.approveBatch.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.load.approveLoad" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("goLive.load.approveMessage")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.load.approveLoad" }));
    await waitFor(() => expect(goLiveService.approveBatch).toHaveBeenCalledWith(12));
  });

  it("rejects a load only with a reason of the list", async () => {
    signIn(APPROVE, { userId: "usr_approver" });
    goLiveService.batch.mockResolvedValue(batchResponse({ status: "pending-approval", submittedById: "usr_loader" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "goLive.load.rejectLoad" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.load.rejectLoad" }));
    expect(await within(dialog).findByText("reasonPicker.reasonRequired")).toBeInTheDocument();
    expect(goLiveService.rejectBatch).not.toHaveBeenCalled();
  });

  it("resolves duplicate rows with a resolution and a reason, the insurer suffix only for a policy number of another insurer", async () => {
    signIn(WRITE);
    goLiveService.batch.mockResolvedValue(batchResponse({ rowsDuplicate: 1 }));
    goLiveService.batchDuplicates.mockImplementation(() => page([duplicateRow()]));
    goLiveService.resolveDuplicates.mockResolvedValue({ resolved: 1 });
    renderPage();
    await screen.findByText("MIG-000012");
    openTab("goLive.load.tabs.duplicates");
    expect(await screen.findByText("C-000881 Andrea Lim")).toBeInTheDocument();
    expect(button("goLive.duplicates.resolveSelected")).toBeDisabled();
    const row = screen.getByRole("row", { name: /C-000990/ });
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(button("goLive.duplicates.resolveSelected"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("goLive.duplicates.insurerSuffix")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.duplicates.resolve" }));
    expect(await within(dialog).findByText("goLive.duplicates.chooseResolution")).toBeInTheDocument();
    expect(within(dialog).getByText("goLive.duplicates.reasonRequired")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText("goLive.duplicates.useExisting"));
    fireEvent.change(within(dialog).getByLabelText(/goLive.duplicates.reason/), { target: { value: "Same client, TIN verified" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.duplicates.resolve" }));
    await waitFor(() => expect(goLiveService.resolveDuplicates).toHaveBeenCalledWith(12, { rows: [9013], resolution: "use-existing", targetCode: null, reason: "Same client, TIN verified" }));
  }, 20000);

  it("checks a resolution form", () => {
    const t = (k) => k;
    const policyRow = duplicateRow({ duplicates: [{ rule: "policy-number", kind: "stored", number: "P-1", name: "x" }] });
    expect(resolutionProblems({ resolution: undefined, reason: "" }, [duplicateRow()], t)).toEqual({ resolution: "goLive.duplicates.chooseResolution", reason: "goLive.duplicates.reasonRequired" });
    expect(resolutionProblems({ resolution: "insurer-suffix", reason: "Other insurer" }, [duplicateRow()], t)).toEqual({ resolution: "goLive.duplicates.suffixOnlyPolicy" });
    expect(resolutionProblems({ resolution: "insurer-suffix", reason: "Other insurer" }, [policyRow], t)).toEqual({});
    expect(resolutionProblems({ resolution: "use-existing", needsTarget: true, targetCode: null, reason: "Same client" }, [duplicateRow()], t))
      .toEqual({ targetCode: "goLive.duplicates.chooseRecord" });
    expect(resolutionProblems({ resolution: null, reason: "Fix the file" }, [duplicateRow()], t)).toEqual({});
  });

  it("requests the undo only after the dependents check and with a reason", async () => {
    signIn(WRITE);
    goLiveService.batch.mockResolvedValue(batchResponse({ status: "loaded", loadedAt: "2026-10-28T09:10:00Z" }));
    goLiveService.dependents.mockResolvedValueOnce([{ object: "policy", key: "P-1", dependent: "Receipts", count: 1 }]).mockResolvedValue([]);
    goLiveService.requestUndo.mockResolvedValue({});
    renderPage();
    await screen.findByText("MIG-000012");
    openTab("goLive.load.tabs.undo");
    fireEvent.click(await screen.findByRole("button", { name: "goLive.undo.requestUndo" }));
    const dialog = await screen.findByRole("dialog");
    const request = within(dialog).getByRole("button", { name: "goLive.undo.requestUndo" });
    expect(request).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.undo.check" }));
    expect(await within(dialog).findByText("Receipts")).toBeInTheDocument();
    expect(request).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.undo.check" }));
    expect(await within(dialog).findByText("goLive.undo.noDependents")).toBeInTheDocument();
    expect(request).toBeEnabled();
    fireEvent.click(request);
    expect(await within(dialog).findByText("goLive.undo.reasonRequired")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/goLive.undo.reason/), { target: { value: "Wrong extract loaded" } });
    fireEvent.click(request);
    await waitFor(() => expect(goLiveService.requestUndo).toHaveBeenCalledWith(12, "Wrong extract loaded"));
  });

  it("keeps the undo approval from its requester and removes the records after the confirmation of another approver", async () => {
    const pendingUndo = batchResponse({ status: "undo-pending", undoRequestedById: "usr_req", undoRequestedBy: "Requester", undoReason: "Wrong extract" },
      { makers: { load: ["usr_loader"], undo: ["usr_req"] } });
    goLiveService.batch.mockResolvedValue(pendingUndo);
    signIn(APPROVE, { userId: "usr_req" });
    const { unmount } = renderPage();
    await screen.findByText("MIG-000012");
    openTab("goLive.load.tabs.undo");
    expect(await screen.findByRole("button", { name: "goLive.undo.approveUndo" })).toBeDisabled();
    unmount();

    signIn(APPROVE, { userId: "usr_approver" });
    goLiveService.approveUndo.mockResolvedValue({});
    renderPage();
    await screen.findByText("MIG-000012");
    openTab("goLive.load.tabs.undo");
    fireEvent.click(await screen.findByRole("button", { name: "goLive.undo.approveUndo" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("goLive.undo.approveMessage")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.undo.approveUndo" }));
    await waitFor(() => expect(goLiveService.approveUndo).toHaveBeenCalledWith(12));
  });

  it("offers no undo once go-live is locked", async () => {
    signIn(WRITE);
    goLiveService.batch.mockResolvedValue(batchResponse({ status: "loaded" }));
    renderPage({ locked: true });
    await screen.findByText("MIG-000012");
    openTab("goLive.load.tabs.undo");
    await screen.findByRole("button", { name: "goLive.undo.check" });
    expect(screen.queryByRole("button", { name: "goLive.undo.requestUndo" })).toBeNull();
  });
});
