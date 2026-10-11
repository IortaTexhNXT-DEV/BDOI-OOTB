import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReconciliationPage from "./ReconciliationPage";
import { WorkspaceContext } from "./shared";
import goLiveService from "../../services/goLiveService";
import { APPROVE, reconciliation, signIn } from "./testData";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../services/goLiveService", () => {
  const real = jest.requireActual("../../services/goLiveService");
  const fns = Object.fromEntries(Object.keys(real.default).filter((k) => typeof real.default[k] === "function").map((k) => [k, jest.fn()]));
  return { __esModule: true, saveFile: jest.fn(), default: { ...fns, paths: real.default.paths } };
});
jest.mock("../../services/auditService", () => ({ getRecordHistory: jest.fn(() => Promise.resolve({ events: [] })) }));

const renderPage = () => render(
  <WorkspaceContext.Provider value={{ notify: jest.fn(), overview: null, reloadOverview: jest.fn() }}>
    <MemoryRouter initialEntries={["/master/configuration/go-live/reconciliation/7"]}>
      <Routes><Route path="/master/configuration/go-live/reconciliation/:id" element={<ReconciliationPage />} /></Routes>
    </MemoryRouter>
  </WorkspaceContext.Provider>,
);
const openTab = (name) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => jest.clearAllMocks());

describe("reconciliation sign-off", () => {
  it("signs a slot with a remark after the confirmation", async () => {
    signIn(APPROVE, { userId: "usr_owner" });
    goLiveService.reconciliation.mockResolvedValue(reconciliation());
    goLiveService.sign.mockResolvedValue(reconciliation());
    renderPage();
    await screen.findByText("REC-000007");
    openTab("goLive.recon.tabs.signoff");
    const row = await screen.findByRole("row", { name: /^Data owner/ });
    fireEvent.click(within(row).getByRole("button", { name: "goLive.recon.sign" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("goLive.recon.signMessage")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.recon.signAs" }));
    expect(goLiveService.sign).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Agrees with the legacy listing" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.recon.signAs" }));
    await waitFor(() => expect(goLiveService.sign).toHaveBeenCalledWith(7, "data-owner", "Agrees with the legacy listing"));
  });

  it("keeps the signature and the acceptance from a user who loaded the loads, and the signature from one who signed another slot", async () => {
    signIn(APPROVE, { userId: "usr_approver" });
    goLiveService.reconciliation.mockResolvedValue(reconciliation({ differences: [{ id: 9, kind: "extra", description: "DN-OLD-77 outside the loads", amount: null, status: "explained",
      explanation: "Single-object import", action: null, owner: null }], summary: { lines: 1, matched: 1, differences: 1, openDifferences: 0, missingLegacy: [], signed: 0, slots: 2 } }));
    let { unmount } = renderPage();
    await screen.findByText("REC-000007");
    openTab("goLive.recon.tabs.signoff");
    const signs = await screen.findAllByRole("button", { name: "goLive.recon.sign" });
    signs.forEach((b) => expect(b).toBeDisabled());
    openTab("goLive.recon.tabs.differencesOpen");
    expect(await screen.findByRole("button", { name: "goLive.recon.acceptDifference" })).toBeDisabled();
    unmount();

    signIn(APPROVE, { userId: "usr_owner" });
    goLiveService.reconciliation.mockResolvedValue(reconciliation({ signoffs: [
      { slot: "data-owner", label: "Data owner", signedBy: "Owner", signedById: "usr_owner", signedAt: "2026-11-01T03:00:00Z", remarks: "OK" },
      { slot: "finance-head", label: "Finance Head", signedBy: null, signedById: null, signedAt: null, remarks: null }], summary: { lines: 1, matched: 1, differences: 0,
      openDifferences: 0, missingLegacy: [], signed: 1, slots: 2 } }));
    ({ unmount } = renderPage());
    await screen.findByText("REC-000007");
    openTab("goLive.recon.tabs.signoff");
    expect(await screen.findByRole("button", { name: "goLive.recon.sign" })).toBeDisabled();
    unmount();

    // a slot named for a role the user does not hold, and a difference the user explained
    signIn(APPROVE, { userId: "usr_other", roles: ["tis-ops-unit-head"] });
    goLiveService.reconciliation.mockResolvedValue(reconciliation({
      signoffs: [{ slot: "finance-head", label: "Finance Head", roles: ["tis-finance"], signedBy: null, signedById: null, signedAt: null, remarks: null }],
      differences: [{ id: 9, kind: "extra", description: "DN-OLD-77 outside the loads", amount: null, status: "explained", explanation: "Single-object import",
        explainedById: "usr_other", action: null, owner: null }],
      summary: { lines: 1, matched: 1, differences: 1, openDifferences: 0, missingLegacy: [], signed: 0, slots: 1 } }));
    renderPage();
    await screen.findByText("REC-000007");
    openTab("goLive.recon.tabs.signoff");
    expect(await screen.findByRole("button", { name: "goLive.recon.sign" })).toBeDisabled();
    openTab("goLive.recon.tabs.differencesOpen");
    expect(await screen.findByRole("button", { name: "goLive.recon.acceptDifference" })).toBeDisabled();
  });

  it("asks for the reason of a tolerance other than zero", async () => {
    signIn(["read:data-load", "write:data-load", "approve:data-load"], { userId: "usr_finance" });
    goLiveService.reconciliation.mockResolvedValue(reconciliation());
    goLiveService.updateLine.mockResolvedValue(reconciliation());
    renderPage();
    await screen.findByText("REC-000007");
    fireEvent.click(await screen.findByRole("button", { name: "goLive.recon.editLine" }));
    const dialog = await screen.findByRole("dialog");
    const tolerance = within(dialog).getByLabelText("goLive.recon.tolerance");
    fireEvent.change(tolerance, { target: { value: "0.50" } });
    fireEvent.blur(tolerance);
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.recon.saveLine" }));
    expect(await within(dialog).findByText("goLive.recon.toleranceReasonRequired")).toBeInTheDocument();
    expect(goLiveService.updateLine).not.toHaveBeenCalled();
  });
});
