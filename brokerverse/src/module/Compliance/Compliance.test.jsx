import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import amlService from "../../services/amlService";
import ClientDueDiligence from "./ClientDueDiligence";
import AmlDashboard from "./AmlDashboard";
import ScreeningHits from "./ScreeningHits";
import { validateOnboarding, PH_MOBILE, PH_TIN } from "../../agentModule/quoteModule/clientOnboarding";
import { menuList } from "../../components/SideBar/list";
import { filterMenuForRoles, isPathAllowed } from "../../utils/menuPermissions";
import { helpSectionFor } from "../../components/HelpPanel/helpRoutes";

jest.mock("../../services/amlService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => fallback,
  fieldErrors: () => ({}),
  default: { clients: jest.fn(), dashboard: jest.fn(), hits: jest.fn(), cases: jest.fn() },
}));

const t = (k) => k;

describe("client onboarding checks", () => {
  it("accepts Philippine mobile numbers and TINs only", () => {
    expect(PH_MOBILE.test("09171234567")).toBe(true);
    expect(PH_MOBILE.test("+639171234567")).toBe(true);
    expect(PH_MOBILE.test("0217123456")).toBe(false);
    expect(PH_TIN.test("123-456-789-000")).toBe(true);
    expect(PH_TIN.test("123456789")).toBe(true);
    expect(PH_TIN.test("12-345")).toBe(false);
  });
  it("requires the identification of an individual and the registration of a juridical client", () => {
    const ind = validateOnboarding({ clientType: "individual", contactNumber: "0917 123 4567", City: "Makati City" }, t);
    expect(Object.keys(ind).sort()).toEqual(["DOB", "firstName", "idNumber", "idType", "lastName", "nationality"]);
    const jur = validateOnboarding({ clientType: "corporate", contactNumber: "123", companyName: "Acme Inc.", taxNumber: "bad" }, t);
    expect(Object.keys(jur).sort()).toEqual(["City", "contactNumber", "registrationAuthority", "registrationNumber", "taxNumber"]);
  });
});

describe("Compliance menu", () => {
  it("is open to the compliance officer and the administrator, with EDD Reviews for Operations", () => {
    const items = (roles) => filterMenuForRoles(menuList, roles).find((m) => m.name === "Compliance")?.submenu.map((i) => i.name) || [];
    expect(items(["compliance-officer"])).toEqual(["AML Dashboard", "Client Due Diligence", "EDD Reviews", "KYC Refresh", "Screening Hits", "Screening Lists",
      "Transaction Alerts", "AML Cases", "AMLC Reports", "AML Settings"]);
    expect(items(["system-admin"])).toHaveLength(10);
    expect(items(["operations"])).toEqual(["EDD Reviews"]);
    expect(items(["sales"])).toEqual([]);
    expect(isPathAllowed("/compliance/aml/clients/cl_1", menuList, ["compliance-officer"])).toBe(true);
    expect(isPathAllowed("/compliance/aml/hits", menuList, ["accounting"])).toBe(false);
  });
  it("lets the client roles open the onboarding screen", () => {
    for (const role of ["sales", "operations", "compliance-officer"]) expect(isPathAllowed("/agent/client-onboarding/cl_1", menuList, [role])).toBe(true);
    expect(isPathAllowed("/agent/client-onboarding", menuList, ["accounting"])).toBe(false);
  });
  it("maps every Compliance screen to its user manual section", () => {
    expect(helpSectionFor("/compliance/aml/hits").id).toBe("screening-hits");
    expect(helpSectionFor("/agent/client-onboarding/cl_1").id).toBe("onboard-a-client-before-the-first-policy");
  });
});

describe("Compliance screens", () => {
  it("lists the clients with their rating and KYC status", async () => {
    amlService.clients.mockResolvedValue([
      { clientId: "cl_1", clientCode: "CL-2026-00001", clientName: "Ramon Villanueva", clientType: "individual", riskRating: "high", riskScore: 9, kycStatus: "edd-required",
        openHits: 1, isPep: true, nextReviewOn: "2027-10-01", onboardedVia: "onboarding" },
    ]);
    render(<MemoryRouter><ClientDueDiligence /></MemoryRouter>);
    expect(await screen.findByText("Ramon Villanueva")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("EDD required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onboard client/ })).toBeInTheDocument();
  });
  it("shows the dashboard counts", async () => {
    amlService.dashboard.mockResolvedValue({ ratings: { high: 2, normal: 3, low: 4, unrated: 1 }, openHits: 5, listsWithoutVersion: 2, coveredOpen: 1 });
    render(<MemoryRouter><AmlDashboard /></MemoryRouter>);
    await screen.findByText("5");
    expect(screen.getByText("Screening hits open")).toBeInTheDocument();
    expect(screen.getByText(/2 active screening list\(s\) have no version loaded/)).toBeInTheDocument();
  });
  it("queues the screening hits with the list and score", async () => {
    amlService.hits.mockResolvedValue([{ id: 1, partyName: "Ramon Villanueva", partyType: "client", clientCode: "CL-2026-00001", matchedName: "RAMON B. VILLANUEVA",
      listCode: "PEP", listName: "Politically exposed persons", entryRef: "PEP-001", score: 0.93, status: "open", event: "rescreen", createdAt: "2026-10-01T00:00:00Z" }]);
    render(<MemoryRouter><ScreeningHits /></MemoryRouter>);
    expect(await screen.findByText("RAMON B. VILLANUEVA")).toBeInTheDocument();
    expect(screen.getByText("0.93")).toBeInTheDocument();
    expect(screen.getByText("Politically exposed persons · PEP-001")).toBeInTheDocument();
  });
});
