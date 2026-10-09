import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import ActivityPanel from "../../components/SalesActivities/ActivityPanel";
import ProductCovers from "../../agentModule/quoteModule/coverageDetails/coverageDetailsCard/ProductCovers";
import RiskFactsFields from "../../agentModule/quoteModule/policyDetails/policyDetailsCard/RiskFactsFields";
import { ageOn, missingRiskFields } from "../../agentModule/quoteModule/utils/useQuoteSetup";
import { AssetDisposals } from "../OpsAccounting/AssetDisposals";
import SalesActivities from "./SalesActivities";
import service from "../../services/salesActivityService";
import opsService from "../../services/opsAccountingService";
import { isPathAllowed } from "../../utils/menuPermissions";
import { menuList } from "../../components/SideBar/list";
import { helpSectionFor } from "../../components/HelpPanel/helpRoutes";

jest.mock("../../services/salesActivityService", () => ({
  __esModule: true,
  default: { options: jest.fn(), timeline: jest.fn(), list: jest.fn(), report: jest.fn(), log: jest.fn(), update: jest.fn(), cancel: jest.fn(), quoteSetup: jest.fn() },
}));
jest.mock("../../services/opsAccountingService", () => ({
  __esModule: true,
  default: { disposals: jest.fn(), cancelDisposal: jest.fn(), printDisposal: jest.fn(), downloadDisposals: jest.fn(), bankAccounts: jest.fn(), disposalPreview: jest.fn() },
}));

const OPTIONS = { types: [{ code: "CALL", name: "Phone call", channel: "call", followUpDays: 3 }], outcomes: [{ code: "INTERESTED", name: "Interested, wants a quotation", result: "positive" }], channels: [] };
const ACTIVITY = { id: "sac_1", entity: "lead", entityId: "lead_1", recordNumber: "LD-2026-00012", activityType: "CALL", activityTypeName: "Phone call", channel: "call",
  subject: "Introductory call", activityAt: "2026-10-02T02:30:00Z", accountExecutiveName: "Maria Rivera", outcome: "INTERESTED", outcomeName: "Interested, wants a quotation",
  nextStep: "Send the motor quotation", nextStepDate: "2026-10-06", taskStatus: "open", status: "logged", link: "/agent/leaddetail/lead_1" };
const QUOTE_ACTIVITY = { ...ACTIVITY, id: "sac_2", entity: "quote", entityId: "qt_1", recordNumber: "QT-2026-00031", subject: "Presented the quotation", nextStep: null, taskStatus: null };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["sales"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:sales-activities", "write:sales-activities"]));
  service.options.mockResolvedValue(OPTIONS);
  service.timeline.mockResolvedValue({ record: { entity: "lead", id: "lead_1" }, activities: [QUOTE_ACTIVITY, ACTIVITY],
    nextStep: { activityId: "sac_1", nextStep: "Send the motor quotation", dueDate: "2026-10-06", taskId: "tsk_1" } });
});

describe("activities of a prospect, quotation or client", () => {
  it("shows the timeline with the activities of its quotations, the open next step and its My Work follow-up", async () => {
    render(<ActivityPanel entity="lead" recordId="lead_1" />);
    expect(await screen.findByText("Introductory call")).toBeInTheDocument();
    expect(screen.getByText("Presented the quotation")).toBeInTheDocument();
    expect(screen.getByText("QT-2026-00031")).toBeInTheDocument();
    expect(screen.getAllByText(/Send the motor quotation/).length).toBeGreaterThan(0);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(service.timeline).toHaveBeenCalledWith("lead", "lead_1");
    expect(screen.getByRole("button", { name: "Log activity" })).toBeInTheDocument();
  });

  it("logs nothing without write:sales-activities", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:sales-activities"]));
    render(<ActivityPanel entity="client" recordId="cl_1" />);
    expect(await screen.findByText("Introductory call")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log activity" })).not.toBeInTheDocument();
  });

  it("shows nothing and calls nothing for a role that does not read the activities (the IT administrator on a client)", () => {
    localStorage.setItem("USER_ROLES", JSON.stringify(["tis-it-admin"]));
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:clients", "read:leads"]));
    const { container } = render(<ActivityPanel entity="client" recordId="cl_1" />);
    expect(container).toBeEmptyDOMElement();
    expect(service.timeline).not.toHaveBeenCalled();
    expect(service.options).not.toHaveBeenCalled();
  });

  it("lists the activities and the report by account executive", async () => {
    service.list.mockResolvedValue([ACTIVITY]);
    service.report.mockResolvedValue({ from: "2026-10-01", to: "2026-10-31", totals: { activities: 1, accountExecutives: 1, positive: 1, followUpsOpen: 1, followUpsOverdue: 0 },
      rows: [{ accountExecutive: "usr_1", accountExecutiveName: "Maria Rivera", total: 1, call: 1, meeting: 0, email: 0, visit: 0, other: 0, prospects: 1, clients: 0, quotations: 0,
        positive: 1, nextSteps: 1, followUpsDone: 0, followUpsOpen: 1, followUpsOverdue: 0 }], byType: [{ activityType: "CALL", activityTypeName: "Phone call", total: 1 }], byOutcome: [] });
    render(<MemoryRouter><SalesActivities /></MemoryRouter>);
    expect(await screen.findByText("Introductory call")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Activity Report"));
    expect(await screen.findAllByText("Maria Rivera")).not.toHaveLength(0);
    expect(screen.getByText("By activity type")).toBeInTheDocument();
  });
});

describe("the quote wizard follows the product template", () => {
  const setup = { templateCode: "MOT-003-2025", templateName: "Motor Insurance Basic Plan",
    covers: [{ code: "OD", name: "Own Damage", type: "Mandatory", quoteField: "lossAndDamageCoveragePremium" }, { code: "AOG", name: "Acts of Nature", type: "Optional", quoteField: "actsOfNaturePremium" }],
    riskFields: [{ field: "driverAge", label: "Driver age", type: "number", acceptanceRule: true }, { field: "claimsLast3Years", label: "Claims in the last 3 years", type: "number", acceptanceRule: true },
      { field: "modified", label: "Vehicle has modifications", type: "boolean", acceptanceRule: true }, { field: "ncbYears", label: "Claim-free years (NCB)", type: "number", acceptanceRule: false },
      { field: "vehicleAge", label: "Vehicle age (years)", type: "number", acceptanceRule: true }] };

  it("offers the template's covers: mandatory ones locked, optional ones added or removed", () => {
    const onToggle = jest.fn();
    render(<ProductCovers setup={setup} isSelected={(c) => c.code === "OD"} onToggle={onToggle} />);
    expect(screen.getByText("Own Damage")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Own Damage" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Acts of Nature" }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ code: "AOG" }), true);
  });

  it("asks for the risk fields the acceptance rules test and knows which are missing", () => {
    render(<RiskFactsFields setup={setup} value={{}} onChange={() => {}} missing={["claimsLast3Years"]} />);
    expect(screen.getByText("Driver's date of birth *")).toBeInTheDocument();
    expect(screen.getByText("Claims in the last 3 years *")).toBeInTheDocument();
    expect(screen.getByText("Claim-free years (NCB)")).toBeInTheDocument();
    // captured on the vehicle details already
    expect(screen.queryByText(/Vehicle age/)).not.toBeInTheDocument();
    expect(screen.getByText("Required by the acceptance rules of the product")).toBeInTheDocument();
    expect(missingRiskFields(setup, { modified: false })).toEqual(["driverAge", "claimsLast3Years"]);
    expect(missingRiskFields(setup, { driverDateOfBirth: "2000-05-01", claimsLast3Years: 0, modified: false })).toEqual([]);
    expect(ageOn("2000-05-01", new Date(2026, 9, 4))).toBe(26);
  });
});

describe("asset disposal register", () => {
  it("lists the disposals with the gain or loss and the sales invoice", async () => {
    opsService.disposals.mockResolvedValue({ summary: { disposals: 1, cost: 120000, bookValue: 60000, proceeds: 50000, outputVat: 6000, gain: 0, loss: 10000 },
      rows: [{ id: "fad_1", disposalNumber: "FAD-2026-00001", disposalDate: "2026-10-04", disposalType: "sale", assetNumber: "FA-2026-00001", assetName: "Laptops",
        buyerName: "Juan dela Cruz Trading Inc.", bookValue: 60000, proceeds: 50000, outputVat: 6000, gainLoss: -10000, salesInvoiceNumber: "SI-2026-00031", journalNumber: "JV-2026-00610",
        status: "posted" }] });
    render(<AssetDisposals />);
    expect(await screen.findByText("FAD-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Juan dela Cruz Trading Inc.")).toBeInTheDocument();
    expect(screen.getByText("SI-2026-00031")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel disposal" })).toBeInTheDocument();
  });
});

describe("menus and help", () => {
  it("Sales, Operations and the Processing Team reach Sales Activities; Claims does not", () => {
    for (const role of ["sales", "operations", "processing"]) expect(isPathAllowed("/sales/activities", menuList, [role])).toBe(true);
    expect(isPathAllowed("/sales/activities", menuList, ["claims"])).toBe(false);
  });
  it("Accounting reaches the supplier 2307 and the disposal register", () => {
    expect(isPathAllowed("/accounts/payables/2307", menuList, ["accounting"])).toBe(true);
    expect(isPathAllowed("/accounts/fixed-assets/disposals", menuList, ["accounting"])).toBe(true);
    expect(isPathAllowed("/accounts/fixed-assets/disposals", menuList, ["sales"])).toBe(false);
    expect(isPathAllowed("/master/organization/sales-activity-types", menuList, ["system-admin"])).toBe(true);
  });
  it("every new screen has its user manual section", () => {
    expect(helpSectionFor("/sales/activities").id).toBe("sales-activities");
    expect(helpSectionFor("/master/organization/sales-activity-outcomes").id).toBe("sales-activities");
    expect(helpSectionFor("/accounts/payables/2307").id).toBe("bir-form-2307-for-suppliers");
    expect(helpSectionFor("/accounts/fixed-assets/disposals").id).toBe("asset-disposal");
  });
});
