import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import CreditLife from "./CreditLife";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: {
    creditLifeBatches: jest.fn(), creditLifeChoices: jest.fn(), creditLifeBatch: jest.fn(), creditLifeMasterPolicies: jest.fn(), creditLifeMasterPolicy: jest.fn(),
    addCreditLifeMember: jest.fn(), uploadCreditLife: jest.fn(),
  },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));

const BATCH = { id: "clb_1", batchNumber: "CLB-2026-00010", bankName: "Toyota Financial Services Philippines", insurerName: "Pioneer Life", productName: "Credit Life - Compulsory", period: "2026-10",
  status: "draft", members: 2, valid: 1, errors: 1, issued: 0, totalPremium: 2000, totalSumInsured: 1000000,
  memberList: [
    { id: "m1", rowNo: 2, loanAccount: "8005000001", borrowerName: "Juan Dela Cruz", customerNo: "C-001", birthDate: "1980-03-14", sumInsured: 1000000, premium: 2000, status: "valid", errors: [] },
    { id: "m2", rowNo: 3, loanAccount: "8005000004", borrowerName: "Lolo Reyes", customerNo: "C-003", birthDate: "1950-01-01", sumInsured: 1000000, premium: 2000, status: "error",
      errors: ["The borrower is 76: Credit Life excludes borrowers aged 65 and over"] },
  ] };

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/operations/credit-life" element={<CreditLife />} />
      <Route path="/operations/credit-life/:id" element={<CreditLife />} />
    </Routes>
  </MemoryRouter>,
);
const grant = (perms) => localStorage.setItem("USER_PERMISSIONS", JSON.stringify(perms));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["operations"]));
  mastersService.options.mockResolvedValue([{ id: 7, label: "Pioneer Life" }]);
  service.creditLifeChoices.mockResolvedValue({ products: [{ value: 5, label: "Credit Life - Compulsory", code: "CL-COMP" }], defaultProduct: "CL-COMP" });
  service.creditLifeBatches.mockResolvedValue([BATCH]);
  service.creditLifeBatch.mockResolvedValue(BATCH);
});

describe("Credit Life", () => {
  it("lists the batches; Operations opens a new batch, a reader cannot", async () => {
    grant(["read:credit-life", "write:credit-life"]);
    const { unmount } = renderAt("/operations/credit-life");
    expect(await screen.findByText("CLB-2026-00010")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New batch" }));
    expect(await screen.findByText("Financing bank", { selector: "label" })).toBeInTheDocument();
    unmount();
    grant(["read:credit-life"]);
    renderAt("/operations/credit-life");
    await screen.findByText("CLB-2026-00010");
    expect(screen.queryByRole("button", { name: "New batch" })).not.toBeInTheDocument();
  });

  it("shows the members of a draft batch with the rules they failed, and encodes a member", async () => {
    grant(["read:credit-life", "write:credit-life"]);
    service.addCreditLifeMember.mockRejectedValue(Object.assign(new Error("Loan account is required"), { errors: [{ path: "member", message: "Loan account is required" }] }));
    renderAt("/operations/credit-life/clb_1");
    expect(await screen.findByText("The borrower is 76: Credit Life excludes borrowers aged 65 and over")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue certificates" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(service.addCreditLifeMember).toHaveBeenCalled());
    expect(await screen.findByText("Loan account is required")).toBeInTheDocument();
  });

  it("a reader sees the batch without the upload, add and issue actions", async () => {
    grant(["read:credit-life"]);
    renderAt("/operations/credit-life/clb_1");
    await screen.findByText("Juan Dela Cruz");
    expect(screen.queryByRole("button", { name: "Issue certificates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
  });
});
