import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import accessControlService from "../../services/accessControlService";
import opsAccountingService from "../../services/opsAccountingService";
import UserAccessMatrix from "./UserAccessMatrix";
import Delegations from "./Delegations";
import SodRules from "./SodRules";
import AccessReviews from "./AccessReviews";

jest.mock("../../services/accessControlService", () => ({
  __esModule: true,
  default: {
    directory: jest.fn(), userMatrix: jest.fn(), userAccess: jest.fn(), userAuthority: jest.fn(), downloadUserMatrix: jest.fn(), signOutUser: jest.fn(),
    delegations: jest.fn(), delegationOptions: jest.fn(), previewDelegation: jest.fn(), requestDelegation: jest.fn(), endDelegation: jest.fn(), downloadDelegations: jest.fn(),
    sodRules: jest.fn(), sodConflicts: jest.fn(), requestSodRule: jest.fn(), checkSodRule: jest.fn(), requestSodException: jest.fn(), endSodException: jest.fn(), downloadSod: jest.fn(),
    roleAccess: jest.fn(), accessChanges: jest.fn(), decideAccessChange: jest.fn(), withdrawAccessChange: jest.fn(),
    reviews: jest.fn(), review: jest.fn(), previewReview: jest.fn(), startReview: jest.fn(), decideReviewItem: jest.fn(), keepReviewItems: jest.fn(), submitReview: jest.fn(),
    closeReview: jest.fn(), downloadReviews: jest.fn(), downloadReview: jest.fn(),
  },
}));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

jest.setTimeout(20000);

const BASE = "/master/generals/usermanagement";
const departments = [{ name: "Cash Control", order: 1 }, { name: "Finance and Accounting", order: 2 }, { name: "IT", order: 3 }];
const roles = [
  { code: "tis-ccd-bp", name: "CCD-BP / QRPh (Receipting)", department: "Cash Control", platform: false, fullAccess: false, status: "active" },
  { code: "tis-ccd-recon", name: "CCD-Recon", department: "Cash Control", platform: false, fullAccess: false, status: "active" },
  { code: "tis-finance", name: "TIS Finance & General Accounting", department: "Finance and Accounting", platform: false, fullAccess: false, status: "active" },
  { code: "tis-it-admin", name: "TIS IT AppSupport / Admin", department: "IT", platform: false, fullAccess: false, status: "active" },
  { code: "accounting", name: "Accounting", department: null, platform: true, fullAccess: false, status: "active" },
];
const directory = { asOf: "2026-10-10", approval: true, departments, roles, settings: { delegationMaxDays: 90, sodExceptionMaxDays: 365, reviewDueDays: 14, dormantDays: 90 },
  abilities: { edit: true, approve: true, signOut: true } };
const user = (over) => ({
  id: "u1", username: "gene", displayName: "Gene Jaen", designation: "Cashier", status: "active", department: "Cash Control", roles: ["tis-ccd-bp", "tis-ccd-recon"],
  roleNames: ["CCD-BP / QRPh (Receipting)", "CCD-Recon"], effectiveRoles: ["tis-ccd-bp", "tis-ccd-recon"], platformRoles: [], included: [], branch: "HO", branchName: "Head Office",
  lastLoginAt: "2026-10-09T01:00:00Z", daysSinceLogin: 1, dormant: false, twoFactor: false, passwordAgeDays: 30, pending: [], lastReview: null,
  sodConflicts: [{ ruleId: 6, ruleCode: "SOD-TIS-BP-RECON", name: "Receipting and reversals", action: "warn", state: "open", heldTogether: ["CCD-BP", "CCD-Recon"] }],
  ...over,
});
const matrix = () => ({ asOf: "2026-10-10", dormantDays: 90, departments, roles, rows: [
  user(),
  user({ id: "u2", username: "mariela", displayName: "Mariela Valentino", department: "Finance and Accounting", roles: ["tis-finance"], roleNames: ["TIS Finance & General Accounting"],
    effectiveRoles: ["tis-finance"], twoFactor: true, sodConflicts: [], pending: [{ ref: "CFG-4", id: 4, kind: "delegation", kindLabel: "Delegation", title: "x", link: "/x" }] }),
  user({ id: "u3", username: "old", displayName: "Old Account", status: "inactive", department: null, roles: [], roleNames: [], effectiveRoles: [], sodConflicts: [] }),
] });

const renderAt = (path, element, route) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={route} element={element} />
      <Route path="*" element={<div data-testid="elsewhere" />} />
    </Routes>
  </MemoryRouter>,
);
const signInAs = (roleCodes, permissions, userId = "me") => {
  window.localStorage.setItem("USER_ROLES", JSON.stringify(roleCodes));
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
  window.localStorage.setItem("user", JSON.stringify({ userId }));
};

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  signInAs(["tis-it-admin"], ["read:access-control", "write:access-control", "approve:access-control", "write:users"]);
  accessControlService.directory.mockResolvedValue(directory);
  accessControlService.userMatrix.mockResolvedValue(matrix());
  accessControlService.accessChanges.mockResolvedValue([]);
  opsAccountingService.masterRecords.mockResolvedValue({ rows: [{ code: "DLG-LEAVE", name: "Vacation or annual leave", context: "delegation", status: "Active", sortOrder: 1 }] });
});

describe("User Access Matrix", () => {
  it("shows active users by default with roles by name, filters on a stat card and keeps the figures while refreshing", async () => {
    renderAt(`${BASE}/access-matrix`, <UserAccessMatrix />, `${BASE}/access-matrix`);
    expect(await screen.findByText("Gene Jaen")).toBeInTheDocument();
    expect(screen.getByText("Mariela Valentino")).toBeInTheDocument();
    expect(screen.queryByText("Old Account")).not.toBeInTheDocument();
    expect(screen.queryByText("tis-ccd-bp")).not.toBeInTheDocument();
    const conflicts = screen.getByRole("button", { name: /Duty conflicts/ });
    expect(within(conflicts).getByText("1")).toBeInTheDocument();
    fireEvent.click(conflicts);
    await waitFor(() => expect(screen.queryByText("Mariela Valentino")).not.toBeInTheDocument());
    expect(screen.getByText("Gene Jaen")).toBeInTheDocument();
    let resolve;
    accessControlService.userMatrix.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    expect(within(screen.getByRole("button", { name: /^Active users/ })).getByText("2")).toBeInTheDocument();
    resolve(matrix());
  });

  it("offers Sign out everywhere only with the permission to manage users", async () => {
    signInAs(["tis-general-manager"], ["read:access-control"]);
    renderAt(`${BASE}/access-matrix`, <UserAccessMatrix />, `${BASE}/access-matrix`);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Gene Jaen" }));
    expect(await screen.findByText("View access")).toBeInTheDocument();
    expect(screen.queryByText("Sign out everywhere")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More options" })).not.toBeInTheDocument();
  });
});

describe("Delegations", () => {
  const options = { asOf: "2026-10-10", maxDays: 90, approval: true, withoutLimit: "allow", departments,
    types: [{ code: "journal_voucher", name: "Journal voucher approval", measure: "amount" }, { code: "payment_voucher", name: "Payment voucher", measure: "amount" }],
    people: [
      { id: "m", name: "Mariela Valentino", department: "Finance and Accounting", roleNames: ["TIS Finance"], approves: ["journal_voucher", "payment_voucher"], platformOnly: false,
        authority: { journal_voucher: { set: true, limit: 750000 }, payment_voucher: { set: false } } },
      { id: "c", name: "Chrystal Malinay", department: "Finance and Accounting", roleNames: ["TIS Finance"], approves: ["journal_voucher"], platformOnly: false, authority: {} },
    ] };

  beforeEach(() => {
    accessControlService.delegations.mockResolvedValue({ asOf: "2026-10-10", approval: true, counts: {}, rows: [] });
    accessControlService.delegationOptions.mockResolvedValue(options);
    accessControlService.previewDelegation.mockResolvedValue({ asOf: "2026-10-10", lines: [] });
  });

  it("shows the empty state with its action and checks a new delegation before sending it", async () => {
    renderAt(`${BASE}/delegations`, <Delegations />, `${BASE}/delegations`);
    expect(await screen.findByText("No delegation in effect or planned")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "New delegation" })[0]);
    expect(await screen.findByText("Include base platform roles")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
    const alerts = (await screen.findAllByRole("alert")).map((a) => a.textContent);
    expect(alerts).toEqual(expect.arrayContaining(["Choose the approver who is away", "Choose the person who covers", "Enter the last day", "Choose the reason"]));
    expect(accessControlService.requestDelegation).not.toHaveBeenCalled();
  });
});

describe("Segregation of Duties", () => {
  it("lists the conflicts by user and offers an exception", async () => {
    accessControlService.sodRules.mockResolvedValue({ rows: [{ id: 6, code: "SOD-TIS-BP-RECON", name: "Receipting and reversals", kind: "roles", roleA: "tis-ccd-bp", roleB: "tis-ccd-recon",
      roleAName: "CCD-BP", roleBName: "CCD-Recon", accessA: [], accessB: [], accessANames: [], accessBNames: [], action: "warn", active: true, users: 1, platform: false, canEdit: true }],
    pendingNew: [], approval: true, maxExceptionDays: 365, asOf: "2026-10-10", abilities: { edit: true, approve: true } });
    accessControlService.sodConflicts.mockResolvedValue({ asOf: "2026-10-10", rows: [{ key: "6:u1", ruleId: 6, ruleCode: "SOD-TIS-BP-RECON", ruleName: "Receipting and reversals",
      action: "warn", userId: "u1", username: "gene", userName: "Gene Jaen", department: "Cash Control", heldTogether: ["CCD-BP", "CCD-Recon"], state: "open", exception: null,
      change: null, canRequest: true, canEnd: false }] });
    renderAt(`${BASE}/segregation-of-duties`, <SodRules />, `${BASE}/segregation-of-duties`);
    expect(await screen.findByText("Gene Jaen")).toBeInTheDocument();
    expect(screen.getByText("CCD-BP + CCD-Recon")).toBeInTheDocument();
    expect(screen.queryByText("SOD-TIS-BP-RECON")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for Gene Jaen" }));
    fireEvent.click(await screen.findByText("Request exception"));
    expect(await screen.findByText("Valid until")).toBeInTheDocument();
  });
});

describe("Access Reviews", () => {
  const review = { id: 3, name: "Access review October 2026", scopeText: "All active users", dueDate: "2026-10-24", status: "open", overdue: false, users: 2, pending: 2, kept: 0,
    removeRoles: 0, deactivate: 0, removals: 0, applied: 0, createdBy: "IT One", createdAt: "2026-10-10T01:00:00Z", approval: true, canSubmit: false, canClose: false, change: null,
    abilities: { edit: true, approve: true },
    items: [
      { id: 41, userId: "me", username: "it.one", displayName: "IT One", department: "IT", decision: "pending", rolesAtStart: ["tis-it-admin"], rolesNow: ["tis-it-admin"],
        roleNamesAtStart: ["TIS IT AppSupport / Admin"], roleNamesNow: ["TIS IT AppSupport / Admin"], removeRoles: [], removeRoleNames: [], conflicts: [], openConflicts: 0,
        rolesChanged: false, needsNote: false, blocked: "own", canDecide: false },
      { id: 42, userId: "u1", username: "gene", displayName: "Gene Jaen", department: "Cash Control", decision: "pending", rolesAtStart: ["tis-ccd-bp", "tis-ccd-recon"],
        rolesNow: ["tis-ccd-bp", "tis-ccd-recon"], roleNamesAtStart: ["CCD-BP", "CCD-Recon"], roleNamesNow: ["CCD-BP", "CCD-Recon"], removeRoles: [], removeRoleNames: [],
        conflicts: [{ ruleName: "Receipting and reversals", action: "warn", state: "open" }], openConflicts: 1, rolesChanged: false, needsNote: true, blocked: null, canDecide: true },
    ] };

  it("opens a review from the address, groups the users by department and asks for a note to keep a user with a conflict", async () => {
    accessControlService.review.mockResolvedValue(review);
    renderAt(`${BASE}/access-reviews?review=3`, <AccessReviews />, `${BASE}/access-reviews`);
    expect(await screen.findByRole("heading", { name: "Access review October 2026" })).toBeInTheDocument();
    expect(screen.getByText("Cash Control")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Gene Jaen"));
    fireEvent.click(await screen.findByRole("button", { name: "Keep access" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This user is dormant or has a conflict: say why the access is kept")).toBeInTheDocument();
    expect(accessControlService.decideReviewItem).not.toHaveBeenCalled();
  });

  it("shows why one's own line cannot be decided", async () => {
    accessControlService.review.mockResolvedValue(review);
    renderAt(`${BASE}/access-reviews?review=3`, <AccessReviews />, `${BASE}/access-reviews`);
    fireEvent.click(await screen.findByText("IT One", { selector: "strong" }));
    expect(await screen.findByText("You cannot review your own access.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save and next" })).not.toBeInTheDocument();
  });
});
