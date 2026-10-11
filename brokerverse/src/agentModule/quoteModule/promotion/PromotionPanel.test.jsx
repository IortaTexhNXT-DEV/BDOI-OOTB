import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../../i18n";
import PromotionPanel from "./PromotionPanel";
import promotionService from "../../../services/promotionService";
import quotationService from "../../../services/quotationService";

jest.mock("../../../services/promotionService", () => ({ __esModule: true, default: { open: jest.fn(), choices: jest.fn() } }));
jest.mock("../../../services/quotationService", () => ({ __esModule: true, default: { updateQuotation: jest.fn() } }));

const QUOTE = { quotationId: "qt_1", quotationStatus: "Draft", lob: "MOTOR", version: 1, currency: "PHP", insuranceCompanyId: 2, leadId: "ld_1" };
const PROMO = { code: "PRM-FORTUNER26", version: 1, name: "Fortuner launch rate", benefit: "rate", validUntil: "2026-12-31", odRate: 1.6, promoOd: 1.6, minOd: 1.5, promoAon: 0.4,
  excess: 2000, standardGrossPremium: 52340.5, promoDiscount: 9018, promoDiscountPct: 19.5, totalDiscountPct: 19.5, cap: { minPct: 0, maxPct: 25 }, rateChange: null };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations"]));
});

describe("promotion of a quotation", () => {
  it("finds the promotions open to the vehicle and applies one", async () => {
    promotionService.open.mockResolvedValue({ promotions: [{ code: "PRM-FORTUNER26", version: 1, name: "Fortuner launch rate", promoOd: 1.6, promoAon: 0.4, periodTo: "2026-12-31" }] });
    quotationService.updateQuotation.mockResolvedValue({});
    const changed = jest.fn();
    render(<PromotionPanel quotation={QUOTE} onChanged={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Find promotion" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(quotationService.updateQuotation).toHaveBeenCalledWith("qt_1", { promotion: { code: "PRM-FORTUNER26" }, version: 1 });
  });

  it("says why no promotion is open", async () => {
    promotionService.open.mockResolvedValue({ promotions: [], reason: "Promotions apply to brand-new vehicles only" });
    render(<PromotionPanel quotation={QUOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Find promotion" }));
    expect(await screen.findByText("Promotions apply to brand-new vehicles only")).toBeInTheDocument();
  });

  it("shows the terms; only a holder of write:promotion-rates changes the rate", () => {
    const { rerender } = render(<PromotionPanel quotation={{ ...QUOTE, promotion: PROMO }} />);
    expect(screen.getByText("PRM-FORTUNER26 v1")).toBeInTheDocument();
    expect(screen.getByText(/9,018\.00 \(19\.50%\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change promo rate" })).toBeNull();
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations", "write:promotion-rates"]));
    rerender(<PromotionPanel quotation={{ ...QUOTE, promotion: { ...PROMO } }} />);
    expect(screen.getByRole("button", { name: "Change promo rate" })).toBeInTheDocument();
  });

  it("is read only on the policy and hidden when the policy has no promotion", () => {
    const { container, rerender } = render(<PromotionPanel quotation={{ ...QUOTE, promotion: PROMO }} readOnly />);
    expect(screen.queryByRole("button", { name: "Remove promotion" })).toBeNull();
    rerender(<PromotionPanel quotation={QUOTE} readOnly />);
    expect(container).toBeEmptyDOMElement();
  });
});
