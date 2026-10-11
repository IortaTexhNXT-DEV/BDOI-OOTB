import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import Bir2307Batches from "./Bir2307Batches";
import periodEndService from "../../services/periodEndService";
import { saveBlob } from "./statementHelpers";

jest.mock("../../services/periodEndService", () => ({ __esModule: true, default: { batches2307: jest.fn(), batch2307: jest.fn(), batch2307File: jest.fn() } }));
jest.mock("./statementHelpers", () => ({ __esModule: true, saveBlob: jest.fn() }));

const BATCH = { id: "cwb_1", batchNumber: "CWB-2026Q3-001", certificates: 2, totalIncome: 59000, totalTax: 1450, createdAt: "2026-10-05T02:00:00Z" };

describe("BIR 2307 batches", () => {
  beforeEach(() => jest.resetAllMocks());

  it("lists the batches of the quarter and opens one with its EWT per certificate and ATC, with its Excel", async () => {
    periodEndService.batches2307.mockResolvedValue([BATCH]);
    periodEndService.batch2307.mockResolvedValue({ ...BATCH, detail: [{ certificateNumber: "CWT-2026-00007", payeeName: "Makati Office Services Inc.", payeeTin: "201-555-777-00000", atc: "WC160", income: 50000, tax: 1000 }] });
    periodEndService.batch2307File.mockResolvedValue({ blob: new Blob(["x"]), fileName: "CWB-2026Q3-001.xlsx" });
    render(<Bir2307Batches year={2026} quarter={3} reloadKey={0} onError={() => {}} />);
    expect(await screen.findByText("CWB-2026Q3-001")).toBeInTheDocument();
    expect(periodEndService.batches2307).toHaveBeenCalledWith({ year: 2026, quarter: 3 });
    fireEvent.click(screen.getByRole("button", { name: /View CWB-2026Q3-001/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("WC160")).toBeInTheDocument();
    expect(within(dialog).getByText("Makati Office Services Inc.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "CWB-2026Q3-001.xlsx"));
  });

  it("says when no batch was issued and reports a failed load", async () => {
    const onError = jest.fn();
    periodEndService.batches2307.mockRejectedValueOnce(new Error("down"));
    render(<Bir2307Batches year={2026} quarter={1} reloadKey={0} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(await screen.findByText("No batch issued in this quarter")).toBeInTheDocument();
  });
});
