import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import ComparisonReports, { slipOptions } from "./ComparisonReports";
import service from "../../services/distributionService";
import placementService from "../../services/placementService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: { comparisonReports: jest.fn(), comparisonDefaults: jest.fn(), createComparisonReport: jest.fn() },
}));
jest.mock("../../services/placementService", () => ({ __esModule: true, default: { listSlips: jest.fn() } }));
jest.mock("../../services/quotationService", () => ({ __esModule: true, default: { getAllQuotations: jest.fn() } }));

const SLIPS = [
  { id: "bs_2", slipNumber: "BS-2026-90002", insuredName: "Davao Agro Processing Corp.", offersReceived: 0 },
  { id: "bs_1", slipNumber: "BS-2026-90001", insuredName: "Cebu Cold Storage Corp.", offersReceived: 2 },
];

beforeEach(() => {
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations"]));
  service.comparisonReports.mockResolvedValue([]);
  service.comparisonDefaults.mockResolvedValue({ reasons: [] });
  placementService.listSlips.mockResolvedValue({ data: SLIPS });
});

describe("New comparison report", () => {
  it("lists the requests for quotation with their offers, those with fewer than two disabled and last", () => {
    expect(slipOptions(SLIPS).map((o) => [o.slipNumber, o.offers, o.disabled])).toEqual([["BS-2026-90001", 2, false], ["BS-2026-90002", 0, true]]);
  });

  it("does not prepare a report from a request for quotation with fewer than two offers", async () => {
    render(<MemoryRouter initialEntries={["/sales/comparison-reports?brokerSlipId=bs_2&slipNumber=BS-2026-90002"]}><ComparisonReports /></MemoryRouter>);
    expect(await screen.findByText("BS-2026-90002 has 0 insurer offer(s); a comparison needs at least two")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare" })).toBeDisabled();
    expect(placementService.listSlips).toHaveBeenCalledWith({ status: "submitted,responses-in,closed", pageSize: 200 });
    fireEvent.click(screen.getByText("Quotations"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Prepare" })).toBeDisabled());
    expect(service.createComparisonReport).not.toHaveBeenCalled();
  });
});
