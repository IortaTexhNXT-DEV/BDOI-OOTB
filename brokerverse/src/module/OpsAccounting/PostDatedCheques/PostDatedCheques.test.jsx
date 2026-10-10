import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import PostDatedCheques from "./index";
import { chequeActions, clearable, forwardable } from "./model";
import { nextCheque } from "./EncodeDialog";
import service from "../../../services/opsAccountingService";

jest.mock("../../../services/opsAccountingService", () => ({
  __esModule: true,
  default: {
    pdcs: jest.fn(), pdcFollowUp: jest.fn(), pdcTransmittals: jest.fn(), banks: jest.fn(), insurers: jest.fn(), pdcEncode: jest.fn(), encodePdcSet: jest.fn(),
    forwardPdcs: jest.fn(), pdc: jest.fn(), pdcSet: jest.fn(), pdcAction: jest.fn(), downloadPdcs: jest.fn(), masterRecords: jest.fn(),
  },
}));

const cheque = (over = {}) => ({
  id: "pdc_1", pdcNumber: "PDC-2026-00121", setId: "pds_1", setNumber: "PCS-2026-00031", clientName: "Andrea Villanueva", policyNumber: "POL-2026-90004", instalmentText: "1 of 4",
  payee: "insurance-partner", payeeText: "Insurance Partner", insurerId: 3, insurerName: "Standard Insurance Co., Inc.", bankName: "BPI", chequeNumber: "0045121",
  chequeDate: "2026-10-15", amount: 12787.5, custody: "tis-vault", custodyText: "TIS vault, Vault A-12", status: "on-hand", statusText: "Received at TIS",
  ageing: { code: "current", label: "Current" }, receiptNumber: null, ...over,
});
const LOG = (rows) => ({
  asOf: "2026-10-12", summary: { atTis: 2, atTisAmount: 25575, withPartners: 0, withPartnersAmount: 0, dueThisWeek: 1, dueThisWeekAmount: 12787.5, awaiting: 0, awaitingAmount: 0,
    bounced: 0, bouncedAmount: 0 }, counts: { open: 2, "at-tis": 2, "with-partners": 0, awaiting: 0, bounced: 0, "cancellation-pending": 0, closed: 0, "deposit-due": 0 },
  ageing: { buckets: [30, 60, 90], amounts: { current: 25575, b1: 0, b2: 0, b3: 0, b4: 0 } }, depositAccount: "ACC-MBT-001", rows,
});
const can = (perms) => (p) => perms.includes(p);

describe("post-dated cheque log", () => {
  beforeEach(() => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:pdc", "write:pdc", "write:receipts"]));
    localStorage.setItem("USER_ROLES", JSON.stringify(["tis-ccd-pdu"]));
    service.banks.mockResolvedValue([{ label: "BPI", value: "2" }]);
    service.insurers.mockResolvedValue([{ label: "Standard Insurance Co., Inc.", value: 3 }]);
    service.pdcs.mockResolvedValue(LOG([cheque(), cheque({ id: "pdc_2", pdcNumber: "PDC-2026-00122", instalmentText: "2 of 4", chequeNumber: "0045122", chequeDate: "2026-11-15" })]));
  });
  afterEach(() => localStorage.clear());

  it("offers each action by status, payee and permission; the requester never decides the cancellation", () => {
    const codes = (c, perms, me = "usr_1") => chequeActions(c, { can: can(perms), me }).map((a) => a.code);
    expect(codes(cheque(), ["write:pdc"])).toEqual(["view", "edit", "request-cancellation", "return"]);
    expect(codes(cheque({ payee: "tisph" }), ["write:pdc", "write:receipts"])).toContain("deposit");
    expect(codes(cheque({ status: "warehoused", custody: "partner" }), ["write:pdc", "write:receipts"])).toEqual(["view", "partner-cleared", "partner-bounced", "request-cancellation"]);
    expect(codes(cheque({ status: "warehoused" }), ["write:pdc"])).not.toContain("partner-cleared");
    expect(codes(cheque({ status: "cleared", receiptNumber: "OR-1" }), ["write:pdc"])).toEqual(["view", "partner-bounced"]);
    const pending = cheque({ status: "cancellation-pending", cancellation: { requestedById: "usr_1", approvedAt: null } });
    expect(codes(pending, ["approve:pdc"], "usr_1")).toEqual(["view"]);
    expect(codes(pending, ["approve:pdc"], "usr_2")).toEqual(["view", "approve-cancellation", "return-cancellation"]);
    expect(codes(cheque({ status: "cancelled", cancellation: { replacementFollows: "cheque" } }), ["write:pdc"])).toEqual(["view", "replace", "return"]);
    expect(codes(cheque({ status: "warehoused" }), ["read:pdc"])).toEqual(["view"]);
  });

  it("forwards only cheques received at TIS for one partner, and numbers the cheques of a set on from row 1", () => {
    expect(forwardable([cheque(), cheque({ id: "x" })])).toBe(true);
    expect(forwardable([cheque(), cheque({ id: "x", insurerId: 9 })])).toBe(false);
    expect(forwardable([cheque({ payee: "tisph" })])).toBe(false);
    expect(clearable([cheque({ status: "warehoused" }), cheque({ status: "forwarded" })])).toBe(true);
    expect(nextCheque("0045121", 3)).toBe("0045124");
    expect(nextCheque("abc")).toBe("");
  });

  it("lists the cheques with their set, instalment, partner, custody and ageing, and forwards the ticked ones", async () => {
    service.forwardPdcs.mockResolvedValue({ transmittal: { transmittalNumber: "PT-2026-00008", insurerName: "Standard Insurance Co., Inc." } });
    render(<MemoryRouter initialEntries={["/accounts/post-dated-cheques"]}><PostDatedCheques /></MemoryRouter>);
    expect(await screen.findByText("PDC-2026-00121")).toBeInTheDocument();
    expect(screen.getAllByText("PCS-2026-00031", { selector: "div" })).toHaveLength(2);
    expect(screen.getAllByText("TIS vault, Vault A-12")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "All open (2)" })).toBeInTheDocument();
    const forward = screen.getByRole("button", { name: "Forward to Insurance Partner" });
    expect(forward).toBeDisabled();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1]);
    fireEvent.click(boxes[2]);
    await waitFor(() => expect(forward).toBeEnabled());
    fireEvent.click(forward);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Forward" }));
    expect(await within(dialog).findByText("Required")).toBeInTheDocument();
    expect(service.forwardPdcs).not.toHaveBeenCalled();
  });

  it("shows no action that changes a cheque to a reader", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:pdc"]));
    render(<MemoryRouter initialEntries={["/accounts/post-dated-cheques"]}><PostDatedCheques /></MemoryRouter>);
    expect(await screen.findByText("PDC-2026-00121")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Encode PDCs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forward to Insurance Partner" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
