import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import accessControlService from "../../services/accessControlService";
import RolePermissions from "./RolePermissions";
import { overview } from "./roleAccess.fixture";

jest.mock("../../services/accessControlService", () => ({
  __esModule: true,
  default: {
    roleAccess: jest.fn(), checkRoleAccess: jest.fn(), proposeRoleAccess: jest.fn(), downloadRoleAccess: jest.fn(), accessChanges: jest.fn(),
    decideAccessChange: jest.fn(), withdrawAccessChange: jest.fn(),
  },
}));

// the first render of a suite loads the PrimeReact styles, which takes a few seconds on a loaded machine
jest.setTimeout(20000);

const renderAt = (path = "/master/generals/usermanagement/role-permissions") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/master/generals/usermanagement/role-permissions" element={<RolePermissions />} />
      <Route path="*" element={<div data-testid="elsewhere" />} />
    </Routes>
  </MemoryRouter>,
);
const signInAs = (roles, permissions) => {
  window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  signInAs(["tis-it-admin"], ["read:access-control", "write:roles", "approve:access-control"]);
  accessControlService.roleAccess.mockResolvedValue(overview());
  accessControlService.checkRoleAccess.mockResolvedValue({ grant: [], revoke: [], warnings: [], blocked: false, affected: { users: 1, throughUsers: 0, throughRoles: [] } });
  accessControlService.accessChanges.mockResolvedValue([overview().roles.find((r) => r.code === "tis-finance").pending]);
});

describe("Role Permissions", () => {
  it("lists the TISPH roles by department and shows the base platform roles only when asked", async () => {
    renderAt();
    const list = await screen.findByRole("listbox");
    expect(within(list).getByText("TIS Sales Associate")).toBeInTheDocument();
    expect(within(list).getByText("Cash Control")).toBeInTheDocument();
    expect(within(list).queryByText("Accounting Manager")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include base platform roles"));
    expect(await within(screen.getByRole("listbox")).findByText("Accounting Manager")).toBeInTheDocument();
    expect(within(screen.getByRole("listbox")).getByText("Base platform roles")).toBeInTheDocument();
  });

  it("shows the access of a role like the menu, in business words", async () => {
    renderAt("/master/generals/usermanagement/role-permissions?role=tis-sales-officer");
    expect(await screen.findByRole("heading", { name: "TIS Sales Officer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sales & Marketing" })).toBeInTheDocument();
    expect(screen.getByText("Quotations and placement")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Approve, Quotations and placement, TIS Sales Officer: Granted" })).toBeInTheDocument();
    expect(screen.queryByText("approve:quotations")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Find a module or screen"), { target: { value: "placement slips" } });
    expect(screen.queryByText("Marketing campaigns")).not.toBeInTheDocument();
    expect(screen.getByText("Quotations and placement")).toBeInTheDocument();
  });

  it("shows a change waiting for approval and why the access cannot be edited", async () => {
    renderAt("/master/generals/usermanagement/role-permissions?role=tis-finance");
    expect(await screen.findByText("Waiting for approval", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/\+1 −1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit access" })).toBeDisabled();
    expect(screen.getByText("Pending: added")).toBeInTheDocument();
    expect(screen.getByText("Pending: removed")).toBeInTheDocument();
  });

  it("stages changes with their View dependency and checks segregation of duties", async () => {
    renderAt("/master/generals/usermanagement/role-permissions?role=tis-ccd-bp");
    fireEvent.click(await screen.findByRole("button", { name: "Edit access" }));
    const approve = screen.getByRole("switch", { name: "Approve, Bank reconciliation, CCD-BP / QRPh (Receipting)" });
    fireEvent.click(approve);
    expect(await screen.findByText("2 changes")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "View, Bank reconciliation, CCD-BP / QRPh (Receipting)" })).toBeChecked();
    await waitFor(() => expect(accessControlService.checkRoleAccess).toHaveBeenCalledWith("tis-ccd-bp",
      { grant: ["approve:bank-reconciliation", "read:bank-reconciliation"], revoke: [] }));
    expect(screen.getByRole("button", { name: /Review and submit/ })).toBeEnabled();
    // Basic access stays on
    expect(screen.queryByRole("switch", { name: "View, Basic access, CCD-BP / QRPh (Receipting)" })).not.toBeInTheDocument();
  });

  it("hides the technical names from a user who may not see them", async () => {
    signInAs(["tis-general-manager"], ["read:access-control"]);
    renderAt();
    await screen.findByRole("listbox");
    expect(screen.queryByRole("button", { name: "More options" })).not.toBeInTheDocument();
  });

  it("compares roles side by side and lists the changes waiting for approval", async () => {
    renderAt("/master/generals/usermanagement/role-permissions?view=compare&roles=tis-sales-associate,tis-sales-officer");
    expect(await screen.findByText("Marketing campaigns")).toBeInTheDocument();
    expect(screen.getAllByText("TIS Sales Officer").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: /Waiting for approval/ }));
    expect(await screen.findByText("CFG-12")).toBeInTheDocument();
    expect(accessControlService.accessChanges).toHaveBeenCalledWith({ kind: "role-access", status: "pending" });
  });
});
