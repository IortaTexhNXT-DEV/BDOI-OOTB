import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import CreditLifeQuoteDialog from "./CreditLifeQuoteDialog";
import CreditLifePanel from "./CreditLifePanel";
import quotationService from "../../../services/quotationService";
import placementService from "../../../services/placementService";

jest.mock("../../../services/quotationService", () => ({ __esModule: true, default: { getInsuranceCompanyOptions: jest.fn(), createQuotationStrict: jest.fn() } }));
jest.mock("../../../services/placementService", () => ({ __esModule: true, default: { journey: jest.fn(), searchLeads: jest.fn(), searchClients: jest.fn() } }));

const VOL = { id: 20, code: "CL-VOL", name: "Credit Life - Voluntary", lob: "LIFE" };
const wrap = (product, onHide = jest.fn()) => render(
  <MemoryRouter initialEntries={["/agent/Quotation"]}>
    <Routes>
      <Route path="/agent/Quotation" element={<CreditLifeQuoteDialog product={product} lead="ld_1" onHide={onHide} />} />
      <Route path="/placement/placement-slips/new" element={<p>direct placement</p>} />
      <Route path="/agent/quotedetailview/:id" element={<p>quotation detail</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  quotationService.getInsuranceCompanyOptions.mockResolvedValue([{ id: 2, label: "Malayan Insurance Co., Inc." }]);
});

describe("Credit Life quotation", () => {
  it("new business (no quotation in its journey) opens the direct placement", async () => {
    placementService.journey.mockResolvedValue({ quotationSlip: "skip" });
    wrap({ ...VOL, id: 19, code: "CL-COMP" });
    expect(await screen.findByText("direct placement")).toBeInTheDocument();
  });

  it("asks for the insurer before anything is created", async () => {
    placementService.journey.mockResolvedValue({ quotationSlip: "required" });
    wrap(VOL);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create quotation" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose the insurer");
    expect(quotationService.createQuotationStrict).not.toHaveBeenCalled();
  });

  it("the panel shows the Credit Life terms of a quotation", () => {
    render(<CreditLifePanel quotation={{ currency: "PHP", netPremium: 3680, creditLife: { loanAccountNo: "TFS-0098812", borrowerAge: 40, accountCount: 2, loanTermYears: 3, sumInsured: 1000000, ratePerThousand: 3.68 } }} />);
    expect(screen.getByText("TFS-0098812")).toBeInTheDocument();
    expect(screen.getByText("3.68")).toBeInTheDocument();
  });
});
