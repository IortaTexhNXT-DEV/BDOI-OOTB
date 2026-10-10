import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import i18n from "../../i18n";
import ReassignDialog, { assigneeGroups } from "./ReassignDialog";
import LeadAssignment, { moveRule } from "./LeadAssignment";
import service from "../../services/distributionService";
import opsAccountingService from "../../services/opsAccountingService";
import systemSettingsService from "../../services/systemSettingsService";
import mastersService from "../../services/mastersService";
import addressService from "../../services/addressService";
import placementService from "../../services/placementService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: {
    assignees: jest.fn(), reassign: jest.fn(), sendToQueue: jest.fn(), teamView: jest.fn(), assignmentQueue: jest.fn(), assignmentRules: jest.fn(),
    channelOptions: jest.fn(), takeFromQueue: jest.fn(), runRules: jest.fn(),
  },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));
jest.mock("../../services/addressService", () => ({ __esModule: true, default: { getProvincesByCountry: jest.fn(), getCitiesByProvince: jest.fn() } }));
jest.mock("../../services/placementService", () => ({ __esModule: true, default: { productLines: jest.fn() } }));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));
jest.mock("../../services/systemSettingsService", () => ({ __esModule: true, default: { getConfiguration: jest.fn() } }));

const LEADS = [{ id: "ld_1", leadNumber: "LD-2026-95015", name: "Ricardo Salazar", ownerUserId: "usr_admin" }];
const ASSIGNEES = [
  { id: "usr_ana", name: "Ana Garcia", branchCode: "CEB", designation: "Account Executive", open: 2, suggested: true, rules: ["Cebu motor"] },
  { id: "usr_juan", name: "Juan Dela Cruz", branchCode: "HO", open: 0, suggested: false, rules: [] },
];
const REASONS = [
  { code: "REA-TERRITORY", name: "Territory or branch change", context: "reassignment", requiresNote: false, sortOrder: 420, status: "Active" },
  { code: "REA-OTHER", name: "Other", context: "reassignment", requiresNote: true, sortOrder: 490, status: "Active" },
  { code: "LAP-FUNDS", name: "Insufficient Funds", context: "lapse", requiresNote: true, sortOrder: 240, status: "Active" },
];

beforeEach(() => {
  jest.clearAllMocks();
  service.assignees.mockResolvedValue(ASSIGNEES);
  service.reassign.mockResolvedValue({ message: "1 prospect(s) reassigned to Ana Garcia" });
  service.sendToQueue.mockResolvedValue({ message: "1 prospect(s) sent to the queue" });
  opsAccountingService.masterRecords.mockResolvedValue({ rows: REASONS });
  systemSettingsService.getConfiguration.mockResolvedValue([{ key: "leads.reassignment_reason_required", value: true }]);
});

const pick = async (label, option) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  // the overlay is still entering (hidden to the accessibility tree) when it is clicked
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option), hidden: true }));
};

describe("Reassign prospects", () => {
  it("groups the account executives of the matching rule first", () => {
    const groups = assigneeGroups(ASSIGNEES, i18n.t.bind(i18n));
    expect(groups.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      ["Suggested by the assignment rules", ["Ana Garcia"]], ["Other account executives", ["Juan Dela Cruz"]],
    ]);
    expect(assigneeGroups([ASSIGNEES[1]], i18n.t.bind(i18n))[0].label).toBe("Account executives");
  });

  it("asks for the account executive from the list and a reason of the reassignment reason codes", async () => {
    const onDone = jest.fn();
    render(<ReassignDialog leads={LEADS} onHide={jest.fn()} onDone={onDone} onError={jest.fn()} />);
    await waitFor(() => expect(service.assignees).toHaveBeenCalledWith(["ld_1"]));
    const button = screen.getByRole("button", { name: "Reassign" });
    expect(button).toBeDisabled();
    await pick(/To account executive/, "Ana Garcia");
    expect(button).toBeDisabled();
    await pick(/^Reason/, "Territory or branch change");
    expect(screen.queryByRole("option", { name: /Insufficient Funds/ })).not.toBeInTheDocument();
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(service.reassign).toHaveBeenCalledWith({ leadIds: ["ld_1"], toUserId: "usr_ana", reasonCode: "REA-TERRITORY", reason: undefined }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("needs the note of a reason that asks for one", async () => {
    render(<ReassignDialog leads={LEADS} onHide={jest.fn()} onDone={jest.fn()} onError={jest.fn()} />);
    await pick(/To account executive/, "Juan Dela Cruz");
    await pick(/^Reason/, "Other");
    const button = screen.getByRole("button", { name: "Reassign" });
    expect(button).toBeDisabled();
    expect(screen.getByText("This reason needs a note")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: "Customer moved to Davao" } });
    expect(button).toBeEnabled();
  });

  it("sends prospects to the queue with a note alone", async () => {
    render(<ReassignDialog leads={LEADS} mode="queue" onHide={jest.fn()} onDone={jest.fn()} onError={jest.fn()} />);
    expect(screen.queryByText(/To account executive/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: "On leave until Monday" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to queue" }));
    await waitFor(() => expect(service.sendToQueue).toHaveBeenCalledWith({ leadIds: ["ld_1"], reasonCode: undefined, reason: "On leave until Monday" }));
    expect(service.assignees).not.toHaveBeenCalled();
  });
});

describe("Assignment rules order", () => {
  it("swaps a rule with its neighbour, not past either end", () => {
    const rules = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moveRule(rules, 2, -1)).toEqual([2, 1, 3]);
    expect(moveRule(rules, 2, 1)).toEqual([1, 3, 2]);
    expect(moveRule(rules, 1, -1)).toBeNull();
    expect(moveRule(rules, 3, 1)).toBeNull();
  });
});

// the whole screen renders slowly in jsdom
describe("Lead Assignment screen", () => {
  const QUEUED = { id: "ld_9", leadNumber: "LD-2026-00009", name: "Jose Reyes", status: "New", lob: null, ownerName: "Ana Garcia", assignmentStatus: "queued", queueReason: "Account executive on leave" };

  beforeEach(() => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:lead-assignment", "write:lead-assignment", "read:leads"]));
    mastersService.options.mockResolvedValue([]);
    addressService.getProvincesByCountry.mockResolvedValue({ success: true, data: [] });
    placementService.productLines.mockResolvedValue([]);
    service.teamView.mockResolvedValue({ members: [], leads: [] });
    service.assignmentQueue.mockResolvedValue([QUEUED]);
    service.assignmentRules.mockResolvedValue([]);
    service.channelOptions.mockResolvedValue([]);
    service.takeFromQueue.mockResolvedValue({ message: "1 prospect(s) taken from the queue" });
    service.runRules.mockResolvedValue({ data: { dryRun: true, assigned: [{ leadId: "ld_9", leadNumber: "LD-2026-00009", name: "Jose Reyes", ruleName: "Untagged", toName: "Ana Garcia" }], unmatched: 0 } });
  });

  it("opens the Reassignment Queue tab, takes a prospect and previews the run of the queue through the rules", async () => {
    render(<LeadAssignment />);
    fireEvent.click(await screen.findByText("Reassignment Queue"));
    expect(await screen.findByText("Jose Reyes")).toBeInTheDocument();
    expect(screen.getByText("Product not yet tagged")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take" }));
    await waitFor(() => expect(service.takeFromQueue).toHaveBeenCalledWith(["ld_9"]));
    fireEvent.click(screen.getByRole("button", { name: "Assign by rules" }));
    expect(await screen.findByText("Assign 1 prospect(s)")).toBeInTheDocument();
    expect(service.runRules).toHaveBeenCalledWith(true);
  }, 20000);

  it("opens the Assignment Rules tab", async () => {
    render(<LeadAssignment />);
    fireEvent.click(await screen.findByText("Assignment Rules"));
    expect(await screen.findByText("No rule yet: prospects stay with the user who creates them")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add rule" })).toBeInTheDocument();
  }, 20000);
});
