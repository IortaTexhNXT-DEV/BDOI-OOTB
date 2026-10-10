import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import accessControlService from "../../services/accessControlService";
import AuthorityMatrix from "./AuthorityMatrix";

jest.mock("../../services/accessControlService", () => ({
  __esModule: true,
  default: {
    authorityMatrix: jest.fn(), proposeAuthorityChange: jest.fn(), accessChanges: jest.fn(), decideAccessChange: jest.fn(), withdrawAccessChange: jest.fn(),
    decideLimit: jest.fn(), withdrawLimit: jest.fn(), limits: jest.fn(), downloadAuthorityMatrix: jest.fn(), downloadLimitHistory: jest.fn(),
    authorityUploadTarget: (label) => ({ label, templatePath: "/t", uploadPath: "/u" }),
  },
}));

const uploadResult = {
  message: "Checked 3 rows: 1 change ready to review, 2 unchanged.", rowsRead: 3, unchanged: 2, updated: 1, file: { key: "authority-matrix/1-a.xlsx", name: "limits.xlsx" },
  changes: [{ row: 2, transactionType: "journal_voucher", transactionName: "Journal voucher approval", measure: "amount", roleCode: "tis-finance", who: "TIS Finance",
    maxAmount: 2500000, unlimited: false, effectiveFrom: "2026-10-10", referenceNo: "BR-2026-020", referenceDate: "2026-10-01", before: { set: true, maxAmount: 1000000 } }],
};
jest.mock("../../components/ImportDialog", () => ({
  __esModule: true,
  default: ({ visible, onDone }) => (visible ? <button type="button" onClick={() => onDone(uploadResult)}>finish upload</button> : null),
}));

// the first render of a suite loads the PrimeReact styles, which takes a few seconds on a loaded machine
jest.setTimeout(20000);

const pending = (over = {}) => ({ source: "change", changeId: 7, ref: "CFG-7", lines: 1, maxAmount: 500000, unlimited: false, removes: false, effectiveFrom: "2026-10-10",
  referenceNo: "BR-2026-014", referenceDate: "2026-09-25", remarks: null, requestedBy: "it.one", requestedById: "u1", requestedAt: "2026-10-09T02:00:00Z",
  canDecide: true, canWithdraw: true, ...over });
const notSet = { set: false, maxAmount: null, unlimited: false, pending: null, scheduled: null };
const matrix = (over = {}) => ({
  asOf: "2026-10-10", withoutLimit: "allow", referenceRequired: true, pendingCount: 1, userLimits: [], abilities: { edit: true, approve: true },
  departments: [{ name: "Sales", order: 1 }, { name: "Finance and Accounting", order: 4 }],
  roles: [
    { code: "tis-sales-officer", name: "TIS Sales Officer", department: "Sales", platform: false, fullAccess: false, approves: [] },
    { code: "tis-finance", name: "TIS Finance", department: "Finance and Accounting", platform: false, fullAccess: false, approves: ["journal_voucher", "payment_voucher"] },
    { code: "accounting", name: "Accounting", department: null, platform: true, fullAccess: false, approves: ["journal_voucher", "payment_voucher"] },
  ],
  rows: [
    { code: "quotation_discount", name: "Quotation discount", measure: "percent", checked: false, step: null, cells: {
      "tis-sales-officer": { set: true, maxAmount: 10, unlimited: false, effectiveFrom: "2026-01-01", pending: null, scheduled: null }, "tis-finance": notSet, accounting: notSet } },
    { code: "journal_voucher", name: "Journal voucher approval", measure: "amount", checked: true, step: "Accounts > Journal Vouchers > Approve", cells: {
      "tis-sales-officer": notSet,
      "tis-finance": { set: true, maxAmount: 1000000, unlimited: false, effectiveFrom: "2026-10-01", referenceNo: "BR-2026-014", approvedBy: "it.two", pending: null, scheduled: null },
      accounting: { set: true, maxAmount: null, unlimited: true, pending: null, scheduled: null } } },
    { code: "payment_voucher", name: "Payment voucher and cheque release", measure: "amount", checked: true, step: "Accounts > Disbursements", cells: {
      "tis-sales-officer": notSet, "tis-finance": { ...notSet, pending: pending() },
      accounting: { set: true, maxAmount: 2000000, unlimited: false, pending: null, scheduled: { maxAmount: 3000000, unlimited: false, effectiveFrom: "2026-11-01" } } } },
  ],
  ...over,
});

const renderAt = (path = "/master/generals/usermanagement/authority-matrix") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/master/generals/usermanagement/authority-matrix" element={<AuthorityMatrix />} />
    </Routes>
  </MemoryRouter>,
);
const signInAs = (roles, permissions) => {
  window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const cellOf = (role, transaction) => screen.getByRole("button", { name: new RegExp(`^Approval limit of ${role} for ${transaction}`) });
const panel = () => screen.getByRole("dialog");

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  signInAs(["tis-it-admin"], ["read:access-control", "write:access-control", "approve:access-control"]);
  accessControlService.authorityMatrix.mockResolvedValue(matrix());
  accessControlService.accessChanges.mockResolvedValue([]);
  accessControlService.proposeAuthorityChange.mockResolvedValue({ message: "Change CFG-8 sent for approval", data: { id: 8 } });
});

describe("Authority Matrix", () => {
  it("groups the TISPH roles by department and adds the base platform roles only when asked", async () => {
    renderAt();
    expect(await screen.findByRole("columnheader", { name: "Finance and Accounting" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TIS Finance" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Accounting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "TIS Sales Officer" })).not.toBeInTheDocument();
    expect(screen.queryByText(/A role with no limit/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include base platform roles"));
    expect(await screen.findByRole("columnheader", { name: "Base platform roles" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Accounting" })).toBeInTheDocument();
  });

  it("shows each limit by its measure and the state of the cell", async () => {
    renderAt();
    expect(await screen.findByRole("button", { name: /^Approval limit of TIS Finance for Journal voucher approval: ₱1,000,000.00$/ })).toBeInTheDocument();
    expect(within(cellOf("TIS Finance", "Payment voucher")).getByText("Pending")).toBeInTheDocument();
    expect(cellOf("TIS Finance", "Payment voucher")).toHaveAttribute("title", expect.stringContaining("CFG-7"));
    expect(screen.getByText("Without a limit: approvals not restricted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approver limit/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include base platform roles"));
    expect(within(await screen.findByRole("button", { name: /^Approval limit of Accounting for Journal voucher approval/ })).getByText("No limit")).toBeInTheDocument();
    expect(within(cellOf("Accounting", "Payment voucher")).getByText("From 01/11/2026")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include transactions not checked yet"));
    expect(await screen.findByRole("button", { name: "Approval limit of TIS Sales Officer for Quotation discount: 10%" })).toBeInTheDocument();
    expect(screen.getByText("Not checked by an approval step")).toBeInTheDocument();
    expect(screen.getAllByTitle("This role has no access to this approval step").length).toBe(2);
    const notSetCell = cellOf("TIS Finance", "Quotation discount");
    expect(notSetCell).toHaveTextContent("Not set");
    expect(notSetCell).toHaveAttribute("title", "No limit for this role. Approvals are not restricted");
  });

  it("counts the approver cells without a limit and filters the matrix to them", async () => {
    const data = matrix();
    data.rows[2].cells["tis-finance"] = notSet;
    accessControlService.authorityMatrix.mockResolvedValue(data);
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "1 approver limit not set" }));
    expect(await screen.findByRole("button", { name: /^Approval limit of TIS Finance for Payment voucher/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approval limit of TIS Finance for Journal voucher/ })).not.toBeInTheDocument();
  });

  it("asks for a percent up to 100 with its suffix, and No limit disables the field beside it", async () => {
    window.localStorage.setItem("bv.access.authorityFilters", JSON.stringify({ unchecked: true, scope: "all" }));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /^Approval limit of TIS Sales Officer for Quotation discount/ }));
    const input = within(panel()).getByLabelText("Approval limit (% of premium)");
    expect(input).toHaveValue("10%");
    fireEvent.click(within(panel()).getByLabelText("No limit"));
    expect(within(panel()).getByLabelText("Approval limit (% of premium)")).toBeDisabled();
  });

  it("sends a limit for approval once the reference is given, keeping the matrix on screen while it reloads", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /^Approval limit of TIS Finance for Journal voucher approval/ }));
    expect(within(panel()).getByLabelText("Approval limit (PHP)")).toHaveValue("₱1,000,000.00");
    fireEvent.click(within(panel()).getByLabelText("No limit"));
    fireEvent.click(within(panel()).getByRole("button", { name: "Submit for approval" }));
    expect(within(panel()).getByText("Enter the authority reference")).toBeInTheDocument();
    expect(accessControlService.proposeAuthorityChange).not.toHaveBeenCalled();
    fireEvent.change(within(panel()).getByLabelText(/Authority reference/), { target: { value: "BR-2026-030" } });
    fireEvent.input(within(panel()).getByLabelText("Reference date"), { target: { value: "05/10/2026" } });
    fireEvent.blur(within(panel()).getByLabelText("Reference date"));
    accessControlService.authorityMatrix.mockReturnValue(new Promise(() => {}));
    fireEvent.click(within(panel()).getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(accessControlService.proposeAuthorityChange).toHaveBeenCalledWith({ lines: [expect.objectContaining({
      transactionType: "journal_voucher", roleCode: "tis-finance", unlimited: true, maxAmount: null, effectiveFrom: "2026-10-10", referenceNo: "BR-2026-030", referenceDate: "2026-10-05" })] }));
    await waitFor(() => expect(accessControlService.authorityMatrix).toHaveBeenCalledTimes(2));
    expect(cellOf("TIS Finance", "Journal voucher approval")).toBeInTheDocument();
  });

  it("offers approve and reject to another approver, and only withdraw to the proposer", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /^Approval limit of TIS Finance for Payment voucher/ }));
    const block = within(panel()).getByRole("region", { name: "Pending approval" });
    expect(within(block).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
  });

  it("shows the proposer the withdraw action only", async () => {
    const data = matrix();
    data.rows[2].cells["tis-finance"] = { ...notSet, pending: pending({ canDecide: false }) };
    accessControlService.authorityMatrix.mockResolvedValue(data);
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /^Approval limit of TIS Finance for Payment voucher/ }));
    const block = within(panel()).getByRole("region", { name: "Pending approval" });
    expect(within(block).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(block).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it("reviews an uploaded file and sends its changes for approval together", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.click(screen.getByRole("button", { name: "finish upload" }));
    const review = await screen.findByRole("dialog");
    expect(within(review).getByText("Review upload")).toBeInTheDocument();
    expect(within(review).getByText("1 change")).toBeInTheDocument();
    expect(within(review).getByText("₱2,500,000.00")).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(accessControlService.proposeAuthorityChange).toHaveBeenCalledWith(expect.objectContaining({
      file: uploadResult.file, rowsRead: 3, unchanged: 2, lines: [expect.objectContaining({ transactionType: "journal_voucher", roleCode: "tis-finance", maxAmount: 2500000 })] })));
  });

  it("shows the technical names switch to administrators of access only, and no write actions without write access", async () => {
    signInAs(["tis-general-manager"], ["read:access-control"]);
    accessControlService.authorityMatrix.mockResolvedValue(matrix({ abilities: { edit: false, approve: false } }));
    renderAt();
    expect(await screen.findByRole("columnheader", { name: "TIS Finance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More options" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    fireEvent.click(cellOf("TIS Finance", "Journal voucher approval"));
    expect(within(panel()).queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
    expect(within(panel()).getByText("BR-2026-014")).toBeInTheDocument();
  });
});
