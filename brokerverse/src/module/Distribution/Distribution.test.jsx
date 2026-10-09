import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import Campaigns from "./Campaigns";
import FleetSchedules from "./FleetSchedules";
import ReportBuilder from "./ReportBuilder";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: {
    campaigns: jest.fn(),
    segments: jest.fn(),
    campaignTemplates: jest.fn(),
    channelOptions: jest.fn(),
    campaignResults: jest.fn(),
    previewSegment: jest.fn(),
    createCampaignTemplate: jest.fn(),
    previewCampaignTemplateDraft: jest.fn(),
    marketingConsents: jest.fn(),
    recordMarketingConsent: jest.fn(),
    fleets: jest.fn(),
    createFleet: jest.fn(),
    datasets: jest.fn(),
    savedReports: jest.fn(),
    biRuns: jest.fn(),
    runReport: jest.fn(),
  },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));
jest.mock("../../services/userService", () => ({ __esModule: true, default: { getRoles: jest.fn(() => Promise.resolve([])) } }));

const SEGMENT = { id: 1, name: "Metro Manila clients", criteria: { partyType: "client", province: "Metro Manila" }, status: "active" };
const TEMPLATE = { id: 1, code: "MOTOR-RENEW", name: "Motor renewal reminder", subject: "Your car insurance renews soon", bodyHtml: "<p>Hi</p>", status: "active" };
const CAMPAIGN = { id: "cpg_1", campaignNumber: "CPG-2026-0001", name: "October renewals", segmentName: SEGMENT.name, templateName: TEMPLATE.name, status: "sent", recipients: 3, excluded: 2, sentAt: "2026-10-01T02:00:00Z" };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["sales"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:campaigns", "write:campaigns", "read:reports", "write:reports", "read:fleet", "write:fleet"]));
  service.campaigns.mockResolvedValue([CAMPAIGN]);
  service.segments.mockResolvedValue([SEGMENT]);
  service.campaignTemplates.mockResolvedValue([TEMPLATE]);
  service.channelOptions.mockResolvedValue([]);
  service.datasets.mockResolvedValue([{ key: "policies", label: "Policies", columns: [
    { key: "insurer", label: "Insurer", type: "text", operators: ["eq", "contains"] },
    { key: "grossPremium", label: "Gross Premium", type: "money", operators: ["gt"] },
  ] }]);
  service.savedReports.mockResolvedValue([{ id: "rbr_1", name: "Premium by insurer", dataset: "policies", columns: ["insurer", "grossPremium"], filters: [], groupBy: ["insurer"], sort: [], sharedRoles: ["sales"], ownerName: "Ana Garcia" }]);
  service.biRuns.mockResolvedValue([]);
});

describe("Campaigns", () => {
  it("lists campaigns and shows the results of a sent one, with the excluded and opted-out counts", async () => {
    service.campaignResults.mockResolvedValue({
      campaign: CAMPAIGN, conversionWindowDays: 30, excludedByReason: { "No marketing consent recorded": 2 },
      totals: { recipients: 3, sent: 2, queued: 0, failed: 1, excluded: 2, optedOut: 1, quoted: 1, insured: 0 },
      recipients: [{ id: 1, partyType: "client", partyName: "Maria Santos", email: "maria@example.ph", status: "opted-out", delivery: "sent" }],
    });
    render(<Campaigns />);
    expect(await screen.findByText("October renewals")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Opted out", { selector: ".pe-kpi-label" })).toBeInTheDocument();
    expect(service.campaignResults).toHaveBeenCalledWith("cpg_1");
  });

  it("previews who a segment reaches before saving it", async () => {
    service.previewSegment.mockResolvedValue({ success: true, data: { total: 10, eligible: 7, excluded: { "Marketing consent refused or withdrawn": 3 } } });
    render(<Campaigns />);
    await screen.findByText("October renewals");
    fireEvent.click(screen.getByRole("tab", { name: "Segments" }));
    fireEvent.click(await screen.findByRole("button", { name: "New segment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Who is reached" }));
    expect(await screen.findByText("Marketing consent refused or withdrawn")).toBeInTheDocument();
    expect(service.previewSegment).toHaveBeenCalledWith({ partyType: "both" });
  });
});

describe("Campaign templates and marketing consents", () => {
  it("checks a new template on the client and previews it before it is saved", async () => {
    service.previewCampaignTemplateDraft.mockResolvedValue({ success: true, data: { subject: "Insure your new Toyota, Maria", html: "<div data-bv-layout=\"1\"><p>Dear Maria,</p></div>" } });
    render(<Campaigns />);
    await screen.findByText("October renewals");
    fireEvent.click(screen.getByRole("tab", { name: "Templates" }));
    fireEvent.click(await screen.findByRole("button", { name: "New template" }));
    expect(await screen.findByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Opt-out link" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter the subject of the e-mail")).toBeInTheDocument();
    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(service.createCampaignTemplate).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "Insure your new Toyota, {{firstName}}" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" }).at(-1));
    expect(await screen.findByText("Insure your new Toyota, Maria")).toBeInTheDocument();
    expect(service.previewCampaignTemplateDraft).toHaveBeenCalledWith(expect.objectContaining({ subject: "Insure your new Toyota, {{firstName}}" }));
  });

  it("records the marketing consent a client gave", async () => {
    service.marketingConsents.mockResolvedValue([{ partyType: "client", partyId: "cl_1", name: "Maria Santos", code: "CL-1", email: "maria@example.ph", status: "not-recorded" }]);
    service.recordMarketingConsent.mockResolvedValue({ success: true, message: "Marketing consent of Maria Santos recorded", data: {} });
    render(<Campaigns />);
    await screen.findByText("October renewals");
    fireEvent.click(screen.getByRole("tab", { name: "Marketing consents" }));
    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agreed to receive offers" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await screen.findAllByText("Maria Santos");
    expect(service.recordMarketingConsent).toHaveBeenCalledWith({ partyType: "client", partyId: "cl_1", granted: true, channel: "Form", evidence: null });
  });
});

describe("Fleet Schedules", () => {
  it("starts a new fleet schedule with the period ending a year after it starts and asks for the client first", async () => {
    service.fleets.mockResolvedValue([]);
    mastersService.options.mockResolvedValue([{ id: 3, label: "Malayan Insurance Co., Inc." }]);
    render(<MemoryRouter><FleetSchedules /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "New fleet schedule" }));
    await screen.findByText("Period to");
    const [from, to] = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/).map((e) => e.value);
    expect(Number(to.slice(0, 4))).toBe(Number(from.slice(0, 4)) + 1);
    expect(to.slice(4)).toBe(from.slice(4));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Choose the client")).toBeInTheDocument();
    expect(service.createFleet).not.toHaveBeenCalled();
  });
});

describe("Report Builder", () => {
  it("opens a saved report and runs it, showing the totals of the numeric columns", async () => {
    service.runReport.mockResolvedValue({ success: true, data: {
      columns: [{ key: "insurer", label: "Insurer", type: "text" }, { key: "grossPremium", label: "Gross Premium", type: "money" }],
      rows: [{ insurer: "Malayan Insurance Co., Inc.", grossPremium: 1250400.5 }], totals: { grossPremium: 1250400.5 }, total: 1, truncated: false,
    } });
    render(<ReportBuilder />);
    fireEvent.click(await screen.findByRole("tab", { name: "Saved reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByDisplayValue("Premium by insurer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Malayan Insurance Co., Inc.")).toBeInTheDocument();
    expect(service.runReport).toHaveBeenCalledWith({ dataset: "policies", columns: ["insurer", "grossPremium"], filters: [], groupBy: ["insurer"], sort: [] });
    expect(screen.queryByRole("tab", { name: "BI extract" })).not.toBeInTheDocument();
  });
});
