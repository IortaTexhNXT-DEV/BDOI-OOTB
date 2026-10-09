import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import RoleChecklist, { groupRoles } from "./index";

const ROLES = [
  { value: "system-admin", label: "System Administrator" },
  { value: "accounting", label: "Accounting" },
  { value: "accounting-manager", label: "Accounting Manager" },
  { value: "tis-sales-officer", label: "TIS Sales Officer" },
  { value: "tis-finance", label: "TIS Finance" },
  { value: "tis-ccd-pdu", label: "CCD-PDU" },
  { value: "sales", label: "Sales" },
  { value: "claims", label: "Claims" },
  { value: "operations", label: "Operations" },
  { value: "processing", label: "Processing" },
];

describe("RoleChecklist", () => {
  it("groups a family of roles that share a code prefix after the standard roles", () => {
    const groups = groupRoles(ROLES);
    expect(groups.map((g) => g.key)).toEqual(["", "tis"]);
    expect(groups[0].roles.map((r) => r.value)).toContain("accounting-manager");
    expect(groups[1].roles).toHaveLength(3);
  });

  it("ticks and unticks roles and shows how many are chosen", () => {
    const onChange = jest.fn();
    const { rerender } = render(<RoleChecklist roles={ROLES} value={["sales"]} onChange={onChange} />);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("TIS roles")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Claims"));
    expect(onChange).toHaveBeenLastCalledWith(["sales", "claims"]);
    rerender(<RoleChecklist roles={ROLES} value={["sales", "claims"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Sales"));
    expect(onChange).toHaveBeenLastCalledWith(["claims"]);
  });

  it("filters the roles by the search text", () => {
    render(<RoleChecklist roles={ROLES} value={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "tis" } });
    expect(screen.queryByLabelText("Claims")).toBeNull();
    expect(screen.getByLabelText("TIS Finance")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "zzz" } });
    expect(screen.getByText("No role matches the search")).toBeInTheDocument();
  });
});
