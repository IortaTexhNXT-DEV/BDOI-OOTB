import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import DiscountCaps from "./DiscountCaps";
import service from "../../services/promotionService";

jest.mock("../../services/promotionService", () => ({ __esModule: true, default: { caps: jest.fn(), proposeCap: jest.fn(), capAct: jest.fn(), choices: jest.fn() } }));

const cap = (extra = {}) => ({ id: 1, productId: 2, productName: "Motor Vehicle Insurance", channelType: "financing_bank", channelTypeLabel: "Financing bank", minPct: 0, maxPct: 25,
  lowestOd: 1.4, effectiveFrom: "2026-01-01", effectiveTo: null, status: "approved", statusLabel: "Approved", createdById: "usr_maker", createdBy: "Ana Cruz", ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-general-manager"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:discount-caps", "approve:discount-caps"]));
  localStorage.setItem("USER_ID", "usr_checker");
  service.choices.mockResolvedValue({ products: [{ value: 2, label: "Motor Vehicle Insurance" }], channelTypes: [{ value: "affinity", label: "Affinity partner" }] });
});

const renderPage = () => render(<MemoryRouter><DiscountCaps /></MemoryRouter>);

describe("discount caps", () => {
  it("lists the caps; a pending cap of another user can be approved or returned", async () => {
    service.caps.mockResolvedValue([cap(), cap({ id: 2, channelType: "affinity", channelTypeLabel: "Affinity partner", maxPct: 18, status: "pending", statusLabel: "Pending approval" })]);
    renderPage();
    expect(await screen.findByText("25.00%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add cap" })).toBeNull();
  });

  it("the proposer only withdraws its own pending cap", async () => {
    localStorage.setItem("USER_ID", "usr_maker");
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:discount-caps", "write:discount-caps", "approve:discount-caps"]));
    service.caps.mockResolvedValue([cap({ status: "pending", statusLabel: "Pending approval" })]);
    renderPage();
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("shows the server's refusal under the field", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:discount-caps", "write:discount-caps"]));
    service.caps.mockResolvedValue([]);
    service.proposeCap.mockRejectedValue(Object.assign(new Error("Validation failed"), { errors: [{ path: "minPct", message: "Min discount % cannot be higher than max discount %" }] }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add cap" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for approval" }));
    expect(await within(dialog).findByText("Min discount % cannot be higher than max discount %")).toBeInTheDocument();
  });
});
