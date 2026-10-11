import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClaimTable from "../../agentModule/claimModule/claimTable";
import ClientListingCard from "../../agentModule/quoteModule/clientListing/clientListingCard";
import claimsService from "../../services/claimsService";
import clientService from "../../services/clientService";
import policyService from "../../services/policyService";
import collectionService from "../../services/collectionService";
import renewalsWorkspaceService from "../../services/renewalsWorkspaceService";
import { getRequest } from "../../utility/commonServices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, o) => {
      const text = typeof o === "string" ? o : (o && o.defaultValue) || key;
      return typeof o === "object" ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k] ?? "") : text;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-redux", () => ({ useDispatch: () => jest.fn(), useSelector: () => ({}) }));
jest.mock("../../services/claimsService", () => ({ __esModule: true, default: { getClaimsList: jest.fn() } }));
jest.mock("../../services/clientService", () => ({ __esModule: true, default: { getClients: jest.fn() } }));
jest.mock("../../utility/commonServices", () => ({ ...jest.requireActual("../../utility/commonServices"), getRequest: jest.fn() }));

const migrated = { kind: "migrated", label: "Migrated", legacyNumber: "LEG-CLM-1", loadId: 12, loadNumber: "MIG-000012" };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe("Origin filter of the lists", () => {
  it("claims: the origin goes to the API and migrated claims, or claims on migrated policies, are marked", async () => {
    claimsService.getClaimsList.mockResolvedValue({ success: true, data: { data: { claims: [
      { id: "c1", claimNumber: "LEG-CLM-1", policyNumber: "PC-1", status: "Registered", origin: migrated, policyOrigin: "migrated", policyLegacyNumber: "PC-1" },
      { id: "c2", claimNumber: "CLM-2026-0001", policyNumber: "PC-1", status: "Registered", origin: { kind: "issued" }, policyOrigin: "migrated", policyLegacyNumber: "PC-1" },
    ], pagination: { total: 2 } } } });
    render(<MemoryRouter><ClaimTable state={{ search: "", status: "", origin: "migrated" }} patch={jest.fn()} /></MemoryRouter>);
    await waitFor(() => expect(claimsService.getClaimsList).toHaveBeenCalled());
    expect(claimsService.getClaimsList.mock.calls[0][2]).toMatchObject({ origin: "migrated" });
    const chips = await screen.findAllByTestId("origin-chip");
    expect(chips.map((c) => within(c).getByText(/^Migrated/).textContent)).toEqual(["Migrated", "Migrated policy"]);
  });

  it("clients: the origin kept with the list goes to the API, the Origin column marks migrated clients only", async () => {
    sessionStorage.setItem("bv-list:clients", JSON.stringify({ tab: 0, search: "", origin: "migrated" }));
    clientService.getClients.mockResolvedValue({ success: true, data: { data: { clients: [
      { clientId: "cl1", generatedClientId: "LEG-C-0001", displayName: "Andrea Lim", origin: { ...migrated, legacyNumber: "LEG-C-0001" } },
      { clientId: "cl2", generatedClientId: "CL-0002", displayName: "Nina Cruz", origin: { kind: "issued" } },
    ], pagination: { totalCount: 2 } } } });
    render(<MemoryRouter><ClientListingCard /></MemoryRouter>);
    await waitFor(() => expect(clientService.getClients).toHaveBeenCalled());
    expect(clientService.getClients.mock.calls[0][2]).toMatchObject({ origin: "migrated" });
    expect(await screen.findByText("Andrea Lim")).toBeInTheDocument();
    expect(screen.getAllByTestId("origin-chip")).toHaveLength(1);
  });

  it("policies, collections and the renewal queue send origin on their requests", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: [] }) });
    try {
      await policyService.getPolicies(1, 10, { origin: "migrated" });
      expect(fetchMock.mock.calls[0][0]).toMatch(/\/policies\?.*origin=migrated/);
      fetchMock.mockClear();
      await policyService.getPolicies(1, 10, { origin: "" });
      expect(fetchMock.mock.calls[0][0]).not.toMatch(/origin=/);
    } finally {
      fetchMock.mockRestore();
    }
    getRequest.mockResolvedValue({ data: { success: true, data: [], pagination: { total: 0 } } });
    await collectionService.getCollections({ page: 1, pageSize: 20, origin: "issued" });
    expect(getRequest.mock.calls[0][0]).toMatch(/^collections\?.*origin=issued/);
    const requests = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: [], dashboard: {} }) });
    try {
      await renewalsWorkspaceService.getQueue({ origin: "migrated" });
      expect(requests.mock.calls[0][0]).toMatch(/renewals\/queue\?.*origin=migrated/);
    } finally {
      requests.mockRestore();
    }
  });
});
