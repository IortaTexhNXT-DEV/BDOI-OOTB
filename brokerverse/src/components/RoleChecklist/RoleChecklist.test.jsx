import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import RoleChecklist, { groupRoles } from "./index";

const ROLES = [
  { value: "system-admin", label: "System Administrator", platform: true },
  { value: "sales", label: "Sales & Marketing", platform: true },
  { value: "claims", label: "Claims", platform: true },
  { value: "tis-ops-associate", label: "TIS Operations Associate", department: "Operations", groupOrder: 100, description: "Placements and policies" },
  { value: "tis-sales-officer", label: "TIS Sales Officer", department: "Sales", groupOrder: 1, description: "As the Sales Associate, plus approvals" },
  { value: "tis-sales-associate", label: "TIS Sales Associate", department: "Sales", groupOrder: 0, description: "Leads to renewals" },
  { value: "tis-finance", label: "TIS Finance", department: "Finance and Accounting", groupOrder: 300 },
  { value: "tis-ccd-pdu", label: "CCD-PDU", department: "Cash Control", groupOrder: 200 },
  { value: "branch-desk", label: "Branch desk" },
  { value: "tis-ccd-bp", label: "CCD-BP", department: "Cash Control", groupOrder: 201 },
  { value: "tis-it-admin", label: "TIS IT", department: "IT", groupOrder: 400 },
];

describe("RoleChecklist", () => {
  it("groups the roles by department in the order of the setting, other roles last, platform roles left out", () => {
    const groups = groupRoles(ROLES);
    expect(groups.map((g) => g.key)).toEqual(["Sales", "Operations", "Cash Control", "Finance and Accounting", "IT", ""]);
    expect(groups[0].roles.map((r) => r.value)).toEqual(["tis-sales-associate", "tis-sales-officer"]);
    expect(groups[5].roles.map((r) => r.value)).toEqual(["branch-desk"]);
  });

  it("lists a platform role the user holds under Other roles, so it can be taken off", () => {
    const onChange = jest.fn();
    const { rerender } = render(<RoleChecklist roles={ROLES} value={["sales", "tis-sales-associate"]} onChange={onChange} />);
    expect(screen.getByText("Other roles")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Claims/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Sales & Marketing/));
    expect(onChange).toHaveBeenLastCalledWith(["tis-sales-associate"]);
    rerender(<RoleChecklist roles={ROLES} value={["tis-sales-associate"]} onChange={onChange} />);
    expect(screen.getByLabelText(/Sales & Marketing/)).not.toBeChecked();
  });

  it("shows each role's one-line description and how many are chosen", () => {
    render(<RoleChecklist roles={ROLES} value={["tis-sales-associate"]} onChange={() => {}} />);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Leads to renewals")).toHaveAttribute("title", "Leads to renewals");
    expect(screen.getByText("Cash Control")).toBeInTheDocument();
  });

  it("filters the roles by the search text once the list is long", () => {
    render(<RoleChecklist roles={ROLES} value={["sales", "claims"]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "ccd" } });
    expect(screen.queryByLabelText(/TIS Finance/)).toBeNull();
    expect(screen.getByLabelText(/CCD-BP/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "zzz" } });
    expect(screen.getByText("No role matches the search")).toBeInTheDocument();
  });
});
