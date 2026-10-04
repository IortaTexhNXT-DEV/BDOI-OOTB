import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { isPathAllowed } from "../../utils/menuPermissions";
import { menuList } from "../../components/SideBar/list";
import { helpSectionFor } from "../../components/HelpPanel/helpRoutes";
import { canViewFullIdentifiers, revealHeaders, setRevealOn } from "../../utility/piiReveal";
import complianceService from "../../services/complianceService";
import LicenceRegister from "./LicenceRegister";
import BreachRegister from "./BreachRegister";

jest.mock("../../services/complianceService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => fallback,
  default: {
    licences: jest.fn(), licenceDashboard: jest.fn(), licenceHolders: jest.fn(), breaches: jest.fn(), breachOptions: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && o.defaultValue && !k.includes(".") ? o.defaultValue : k) }),
}));

const SCREENS = ["/compliance/licences", "/compliance/fit-and-proper", "/compliance/insurer-authority", "/compliance/complaints",
  "/compliance/ic-annual-statement", "/compliance/ic-production-report", "/compliance/breaches"];

describe("Compliance menu", () => {
  it("is open to the administrator and Operations; Accounting gets the licences and IC reports; Claims and Sales the complaints", () => {
    for (const p of SCREENS) {
      expect(isPathAllowed(p, menuList, ["system-admin"])).toBe(true);
      expect(isPathAllowed(p, menuList, ["operations"])).toBe(true);
      expect(helpSectionFor(p).matched).toBe(true);
    }
    expect(isPathAllowed("/compliance/ic-annual-statement", menuList, ["accounting-manager", "accounting"])).toBe(true);
    expect(isPathAllowed("/compliance/licences", menuList, ["accounting"])).toBe(true);
    expect(isPathAllowed("/compliance/breaches", menuList, ["accounting"])).toBe(false);
    expect(isPathAllowed("/compliance/complaints", menuList, ["claims"])).toBe(true);
    expect(isPathAllowed("/compliance/complaints", menuList, ["sales"])).toBe(true);
    expect(isPathAllowed("/compliance/licences", menuList, ["sales"])).toBe(false);
    expect(isPathAllowed("/compliance/licences", menuList, ["processing"])).toBe(false);
  });
});

describe("Show full identifiers", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it("sends X-Unmask-PII only for a holder of view:pii who switched it on", () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:clients"]));
    localStorage.setItem("USER_ROLES", JSON.stringify(["processing"]));
    setRevealOn(true);
    expect(canViewFullIdentifiers()).toBe(false);
    expect(revealHeaders()).toEqual({});
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["view:pii"]));
    expect(revealHeaders()).toEqual({ "X-Unmask-PII": "1" });
    setRevealOn(false);
    expect(revealHeaders()).toEqual({});
  });
});

describe("Licence Register screen", () => {
  it("shows the licences with their state and the referrers whose commission is held", async () => {
    complianceService.licences.mockResolvedValue({ items: [{ id: "lic_1", holderType: "referrer", holderName: "Juan Dela Cruz", referrerType: "Agent", licenceType: "Non-life Insurance Agent",
      licenceNumber: "NL-2026-1", expiryDate: "2026-10-20", daysToExpiry: 16, state: "expiring", renewalStatus: "due", status: "active" }],
    summary: { valid: 0, expiring: 1, expired: 0, noExpiry: 0 } });
    complianceService.licenceDashboard.mockResolvedValue({ expiringDays: 90, firmLicenceInForce: false, referrersWithoutLicence: [{ id: "r1", name: "Pedro Penduko" }], checkMode: "block",
      calendar: [], expired: [] });
    complianceService.licenceHolders.mockResolvedValue({ referrers: [], users: [], licenceTypes: [] });
    render(<MemoryRouter><LicenceRegister /></MemoryRouter>);
    expect(await screen.findByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("NL-2026-1")).toBeTruthy();
    expect(screen.getByText("compliance.lic.noFirmLicence")).toBeTruthy();
    expect(screen.getByText("compliance.lic.referrersBlocked")).toBeTruthy();
  });
});

describe("Breach Register screen", () => {
  it("shows the hours left before the NPC deadline", async () => {
    complianceService.breaches.mockResolvedValue({ items: [{ id: "pdb_1", breachNumber: "PDB-2026-00001", incidentType: "personal-data-breach", title: "Wrong recipient",
      discoveredAt: "2026-10-03T01:00:00.000Z", npcDueAt: "2026-10-06T01:00:00.000Z", hoursLeft: 20, status: "open", nature: [], dataCategories: [] }],
    summary: { open: 1, pendingNpc: 1, npcOverdue: 0 } });
    complianceService.breachOptions.mockResolvedValue({ incidentTypes: [], natures: [], dataCategories: [], team: [] });
    render(<MemoryRouter><BreachRegister /></MemoryRouter>);
    expect(await screen.findByText("PDB-2026-00001")).toBeTruthy();
    expect(screen.getByText("compliance.br.hoursLeft")).toBeTruthy();
  });
});
