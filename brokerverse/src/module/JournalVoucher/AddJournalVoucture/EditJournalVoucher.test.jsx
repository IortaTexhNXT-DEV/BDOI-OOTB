import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "../../../i18n";
import AddJournalVoucture, { entryRows } from "./index";
import journalVoucherReducer from "../store/journalVoucherReducer";
import journalVoucherService from "../../../services/journalVoucherService";

jest.mock("../../../services/journalVoucherService", () => ({
  __esModule: true,
  apiErrorMessage: (e, fallback) => e?.message || fallback,
  default: { getVoucher: jest.fn(), update: jest.fn() },
}));
jest.mock("../useJvMasterData", () => ({
  __esModule: true,
  default: () => ({ mainAccountsData: [], subAccountsData: [], branchCodesData: [], departmentCodesData: [], costCentresData: [], defaultCostCentre: null,
    currencyCodesData: [], transactionCodesData: [{ code: "JV", name: "Journal Voucher", description: "Journal Voucher" }], exchangeRates: {}, rateRows: [], baseCurrency: "PHP" }),
}));

const VOUCHER = {
  id: "jv_9", transactionNumber: "JV-2026-00009", transactionCode: "JV", description: "Audit accrual", date: "2026-10-10", status: "rejected", source: "manual",
  entries: [
    { mainAccount: "658000", entryType: "Debit", currencyCode: "PHP", foreignAmount: 1000, localAmount: 1000, remarks: "Audit" },
    { mainAccount: "210030", entryType: "Credit", currencyCode: "PHP", foreignAmount: 1000, localAmount: 1000, remarks: "Accrued" },
  ],
};

const renderEdit = () => {
  const store = configureStore({ reducer: { journalVoucherMainReducers: journalVoucherReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/accounts/journalvoucher/editjournalvoucture/jv_9"]}>
        <Routes>
          <Route path="/accounts/journalvoucher/editjournalvoucture/:id" element={<AddJournalVoucture />} />
          <Route path="/accounts/journalvoucher/detailsjournalvocture/:id" element={<div>details page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
};

describe("edit a parked journal voucher (GAP-FIN-27)", () => {
  beforeEach(() => jest.resetAllMocks());

  it("turns the saved lines into rows of the entry table", () => {
    expect(entryRows(VOUCHER.entries).map((r) => [r.id, r.mainAccount, r.entryType, r.foreignAmount])).toEqual([[1, "658000", "Debit", 1000], [2, "210030", "Credit", 1000]]);
  });

  it("loads the maker's voucher into the form and saves it through the update, then opens its details", async () => {
    journalVoucherService.getVoucher.mockResolvedValue(VOUCHER);
    journalVoucherService.update.mockResolvedValue({ message: "Journal voucher JV-2026-00009 saved and sent for approval" });
    renderEdit();
    await waitFor(() => expect(journalVoucherService.getVoucher).toHaveBeenCalledWith("jv_9"));
    expect(await screen.findByDisplayValue("Audit accrual")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /Submit for approval/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(journalVoucherService.update).toHaveBeenCalledWith("jv_9", expect.objectContaining({
      transactionCode: "JV", transactionDescription: "Audit accrual", date: "2026-10-10",
      entries: [expect.objectContaining({ mainAccount: "658000", entryType: "Debit", foreignAmount: 1000 }), expect.objectContaining({ mainAccount: "210030", entryType: "Credit", foreignAmount: 1000 })],
    })));
    expect(await screen.findByText("details page")).toBeInTheDocument();
  });

  it("stays on the form when the server refuses the change", async () => {
    journalVoucherService.getVoucher.mockResolvedValue(VOUCHER);
    journalVoucherService.update.mockRejectedValue(new Error("Only the maker of JV-2026-00009 changes or withdraws it"));
    renderEdit();
    const submit = await screen.findByRole("button", { name: /Submit for approval/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(journalVoucherService.update).toHaveBeenCalled());
    expect(screen.queryByText("details page")).toBeNull();
  });
});
