import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../../i18n";
import PolicyCorrectionsPanel from "./PolicyCorrectionsPanel";
import policyService from "../../../services/policyService";
import quotationService from "../../../services/quotationService";
import opsAccountingService from "../../../services/opsAccountingService";

jest.mock("../../../services/policyService", () => ({
  __esModule: true,
  default: { getPolicyCorrections: jest.fn(), requestPolicyCorrection: jest.fn(), decidePolicyCorrection: jest.fn() },
}));
jest.mock("../../../services/quotationService", () => ({ __esModule: true, default: { getInsuranceCompanyOptions: jest.fn() } }));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const POLICY = { policyId: "pol_1", policyNumber: "POL-2026-95002", status: "Active", insuredName: "Kristine Soriano", inception: "2026-05-13", expiry: "2027-05-13", insuranceCompanyId: 7 };
const pending = (extra = {}) => ({
  id: "pcr_1", status: "pending", statusLabel: "Pending approval", requestedById: "usr_maker", requestedBy: "Ana Cruz", requestedAt: "2026-10-10T02:00:00Z",
  reason: "Corrected policy issued by the insurer", insurerReference: "MAP-END-2026-0042",
  changes: [{ field: "expiry", label: "Expiry date", fromText: "13/05/2027", toText: "14/05/2027" }], ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-sales-officer"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:policies", "write:policies", "approve:policies"]));
  localStorage.setItem("USER_ID", "usr_checker");
  quotationService.getInsuranceCompanyOptions.mockResolvedValue([{ id: 7, label: "MAPFRE Insurance" }, { id: 3, label: "Pioneer Insurance" }]);
  opsAccountingService.masterRecords.mockResolvedValue({ rows: [{ code: "PCR-INSURER", name: "Corrected policy issued by the insurer", context: "policy_correction", status: "Active" }] });
});

describe("policy corrections", () => {
  it("lists a pending correction with Approve and Reject for a second user", async () => {
    policyService.getPolicyCorrections.mockResolvedValue([pending()]);
    render(<PolicyCorrectionsPanel policy={POLICY} />);
    expect(await screen.findByText("Expiry date: 13/05/2027 → 14/05/2027")).toBeInTheDocument();
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve correction" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Request correction" })).toBeNull();
  });

  it("the requester may only withdraw it", async () => {
    localStorage.setItem("USER_ID", "usr_maker");
    policyService.getPolicyCorrections.mockResolvedValue([pending()]);
    render(<PolicyCorrectionsPanel policy={POLICY} />);
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve correction" })).toBeNull();
  });

  it("requests a correction of the changed values with a reason", async () => {
    policyService.getPolicyCorrections.mockResolvedValue([]);
    policyService.requestPolicyCorrection.mockResolvedValue({ id: "pcr_2" });
    render(<PolicyCorrectionsPanel policy={POLICY} />);
    fireEvent.click(await screen.findByRole("button", { name: "Request correction" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Insured name"), { target: { value: "Kristine M. Soriano" } });
    fireEvent.change(within(dialog).getByLabelText("Insurer reference"), { target: { value: "MAP-END-2026-0042" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Request correction" }));
    expect(policyService.requestPolicyCorrection).not.toHaveBeenCalled();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/reason/i);
  });

  it("is not offered without a correction and without the right to request one", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:policies"]));
    policyService.getPolicyCorrections.mockResolvedValue([]);
    const { container } = render(<PolicyCorrectionsPanel policy={POLICY} />);
    await waitFor(() => expect(policyService.getPolicyCorrections).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
