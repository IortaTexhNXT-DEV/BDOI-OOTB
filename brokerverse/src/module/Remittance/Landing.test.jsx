import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import { remittanceService } from "../../services/remittanceService";
import Landing from "./Landing";

jest.mock("../../services/remittanceService", () => ({ __esModule: true, remittanceService: { summary: jest.fn() }, default: {} }));

const open = () => render(
  <MemoryRouter initialEntries={["/finance/remittance"]}>
    <Routes>
      <Route path="/finance/remittance" element={<Landing />} />
      <Route path="/finance/remittance/approvals" element={<div>Approvals page</div>} />
      <Route path="/finance/remittance/remittances" element={<div>Remittances page</div>} />
    </Routes>
  </MemoryRouter>
);

describe("Remittance landing", () => {
  it("opens the page the summary names for the user", async () => {
    remittanceService.summary.mockResolvedValue({ counts: { approvals: 2 }, landing: { code: "approvals", link: "/finance/remittance/approvals" } });
    open();
    expect(await screen.findByText("Approvals page")).toBeInTheDocument();
  });

  it("offers Try again when the summary cannot be read", async () => {
    remittanceService.summary.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ landing: { link: "/finance/remittance/remittances?segment=my-work" } });
    open();
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not open Remittance.");
    fireEvent.click(retry);
    expect(await screen.findByText("Remittances page")).toBeInTheDocument();
  });
});
