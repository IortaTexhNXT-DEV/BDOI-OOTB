import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "../../../i18n";
import MotorRatingPanel from "./MotorRatingPanel";
import quotationService from "../../../services/quotationService";

jest.mock("../../../services/quotationService", () => ({ __esModule: true, default: { motorRating: jest.fn() } }));
jest.mock("../../../components/ReasonPicker", () => ({
  __esModule: true,
  default: ({ label }) => <div data-testid="reason-picker">{label}</div>,
  reasonPayload: (v) => ({ reasonCode: v?.reasonCode, note: v?.note }),
}));

const RATING = {
  fmv: { referenceValue: 1000000, referenceBasis: "previous-fmv", depreciationPct: 10, computedFmv: 900000 },
  depreciationOptions: [8, 10, 15, 20], rates: { OD: 2, AON: 0.5, source: "rule" }, minimumRates: { OD: 1.4, AON: null },
  excess: { pct: 5, basis: "sum-insured", amount: 45000 }, canChangeRates: false, canEditFmv: false,
};
const DRAFT = { leadRefId: "ld_1", productType: "Motor" };
const grant = (perms) => localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations", ...perms]));

beforeEach(() => {
  jest.clearAllMocks();
  quotationService.motorRating.mockResolvedValue(RATING);
});

describe("market value and rates of a motor quotation", () => {
  it("fills the computed FMV and the issuing rates; read only for an associate", async () => {
    grant([]);
    const changed = jest.fn();
    render(<MotorRatingPanel draft={DRAFT} values={{ fmv: "", odRate: "", aonRate: "" }} onChange={changed} />);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(changed.mock.calls[0][0]).toMatchObject({ fmv: 900000, odRate: 2, aonRate: 0.5, fmvRating: { referenceValue: 1000000, depreciationPct: 10 } });
    expect(screen.getByText("Commission rule")).toBeInTheDocument();
    expect(screen.getByLabelText("Fair market value")).toBeDisabled();
    expect(screen.getByLabelText("Own Damage rate")).toBeDisabled();
    expect(screen.queryByTestId("reason-picker")).toBeNull();
  });

  it("lets an officer change the FMV and the rate with a reason, and notes a rate below the minimum", async () => {
    grant(["override:motor-fmv", "override:quotation-rates"]);
    render(<MotorRatingPanel draft={DRAFT} values={{ fmv: 950000, odRate: 1.3, aonRate: 0.5 }} onChange={jest.fn()} />);
    expect(await screen.findByText("Market value and rates")).toBeInTheDocument();
    expect(screen.getByLabelText("Fair market value")).toBeEnabled();
    expect(screen.getByLabelText("Own Damage rate")).toBeEnabled();
    expect(screen.getByText("Reason for the FMV change")).toBeInTheDocument();
    expect(screen.getByText("Reason for the rate change")).toBeInTheDocument();
    expect(screen.getByText(/Below the minimum issuing rate of 1.4%/)).toBeInTheDocument();
  });
});
