import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../../i18n";
import { receiptsService } from "../../../services/receiptsService";
import ReceiptBatches from "./ReceiptBatches";

jest.mock("../../../services/receiptsService", () => ({ __esModule: true, receiptsService: { receiptBatches: jest.fn(), downloadBatchCommission: jest.fn() } }));
jest.mock("../../../utility/toastUtils", () => ({ showErrorMessage: jest.fn() }));

const batch = (extra) => ({ id: "rvb_1", batchNumber: "RVB-2026-00004", fileName: "rv.xlsx", rows: 3, created: 2, failed: 1, premiumTotal: 20000, commissionTotal: 750,
  commissionRows: 1, createdAt: "2026-10-10T02:00:00Z", createdBy: "Cash Control", ...extra });

describe("Receipt batches", () => {
  it("lists the batches; only a batch with commission kept apart offers the export", async () => {
    receiptsService.receiptBatches.mockResolvedValue([batch(), batch({ id: "rvb_2", batchNumber: "RVB-2026-00005", commissionTotal: 0, commissionRows: 0 })]);
    receiptsService.downloadBatchCommission.mockResolvedValue();
    render(<ReceiptBatches visible onHide={jest.fn()} />);
    expect(await screen.findByText("RVB-2026-00004")).toBeInTheDocument();
    expect(screen.getByText("RVB-2026-00005")).toBeInTheDocument();
    const exports = screen.getAllByRole("button", { name: "Export commission" });
    expect(exports).toHaveLength(1);
    fireEvent.click(exports[0]);
    await waitFor(() => expect(receiptsService.downloadBatchCommission).toHaveBeenCalledWith(expect.objectContaining({ id: "rvb_1" })));
  });
});
