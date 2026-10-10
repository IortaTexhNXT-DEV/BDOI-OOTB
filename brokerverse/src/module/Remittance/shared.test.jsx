import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { REMITTANCE_ROUTES, money, statusChip, useUrlState } from "./shared";

const Probe = () => {
  const [state, update] = useUrlState({ segment: "my-work", page: "1" });
  const { search } = useLocation();
  return (
    <>
      <output data-testid="state">{JSON.stringify(state)}</output>
      <output data-testid="search">{search}</output>
      <button type="button" onClick={() => update({ segment: "drafts", insurerId: 3 })}>drafts</button>
      <button type="button" onClick={() => update({ page: 2 })}>page 2</button>
      <button type="button" onClick={() => update({ insurerId: null })}>clear</button>
    </>
  );
};

describe("Remittance shared helpers", () => {
  it("colours the R1 statuses on their chips, the label staying the text", () => {
    expect(statusChip("rejected", "Returned")).toEqual({ code: "rejected", label: "Returned", severity: "warning" });
    expect(statusChip("settled", "Settled (voucher raised)").severity).toBe("success");
    expect(statusChip("failed", "Failed").severity).toBe("danger");
    expect(statusChip("unknown", "Odd").severity).toBeUndefined();
    expect(money(409141.43)).toBe("PHP 409,141.43");
    expect(money(null)).toBe("");
    expect(REMITTANCE_ROUTES.setup()).toBe("/finance/remittance/setup/schedules");
  });

  it("keeps the segment, filters and page in the address and returns to page 1 on a filter change", () => {
    render(<MemoryRouter initialEntries={["/finance/remittance/remittances?page=3"]}><Probe /></MemoryRouter>);
    expect(JSON.parse(screen.getByTestId("state").textContent)).toEqual({ segment: "my-work", page: "3" });
    fireEvent.click(screen.getByText("drafts"));
    expect(screen.getByTestId("search")).toHaveTextContent("?segment=drafts&insurerId=3");
    fireEvent.click(screen.getByText("page 2"));
    expect(screen.getByTestId("search")).toHaveTextContent("?segment=drafts&insurerId=3&page=2");
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("search")).toHaveTextContent(/^\?segment=drafts$/);
  });
});
