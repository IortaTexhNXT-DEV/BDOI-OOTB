import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import ImportDialog, { errorRows, fileSize, masterTarget } from "./index";
import importService from "../../services/importService";

jest.mock("../../services/importService", () => ({ __esModule: true, default: { downloadTemplate: jest.fn(), upload: jest.fn() } }));
jest.mock("../DateField", () => ({ id, value, onChange }) => <input id={id} aria-label="go-live date" value={value} onChange={onChange} />);

const csv = (name = "tb.csv") => new File(["Account Code,Debit\n1102001,100"], name, { type: "text/csv" });
const choose = (file) => fireEvent.change(screen.getByTestId("import-file"), { target: { files: [file] } });
const button = (name) => screen.getByRole("button", { name });

describe("ImportDialog", () => {
  beforeEach(() => jest.resetAllMocks());

  it("lays out the steps of a master upload with the sheet choice, and keeps the note behind the help icon", () => {
    render(<ImportDialog visible onHide={() => {}} title="Upload vehicles" note="Brands before models."
      targets={[masterTarget("vehicle-brand", "Vehicle brands"), masterTarget("vehicle-model", "Vehicle models")]} />);
    expect(screen.getByText("Upload vehicles")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload into")).toBeInTheDocument();
    expect(button("Download template")).toBeEnabled();
    expect(button("Choose file")).toBeInTheDocument();
    expect(button("About this upload")).toBeInTheDocument();
    expect(screen.queryByText("Brands before models.", { selector: "p" })).toBeNull();
    expect(button("Upload")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Validate" })).toBeNull();
  });

  it("shows the chosen file with its size, removes it, and uploads a file in one step without a validate path", async () => {
    importService.upload.mockResolvedValue({ message: "Processed 2 rows: 1 created, 1 failed", created: 1, errors: [{ row: 3, message: "Code is required" }] });
    const onDone = jest.fn();
    render(<ImportDialog visible onHide={() => {}} title="Upload cities" targets={[masterTarget("city", "Cities")]} onDone={onDone} />);
    choose(csv("cities.csv"));
    expect(screen.getByText("cities.csv")).toBeInTheDocument();
    fireEvent.click(button("Remove cities.csv"));
    expect(screen.queryByText("cities.csv")).toBeNull();
    choose(csv("cities.csv"));
    fireEvent.click(button("Upload"));
    await screen.findByText("Processed 2 rows: 1 created, 1 failed");
    expect(importService.upload).toHaveBeenCalledWith("/masters/city/upload", expect.any(File), {});
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByText("Code is required")).toBeInTheDocument();
  });

  it("validates first, shows the summary and the errors with row and column, and loads only a valid file after the confirmation", async () => {
    const target = { label: "Opening balances", templatePath: "/t", validatePath: "/v", uploadPath: "/u" };
    importService.upload.mockResolvedValueOnce({ valid: false, rows: 2, errors: [{ row: 3, column: "Debit", message: "Not an amount" }] });
    render(<ImportDialog visible onHide={() => {}} title="Import opening balances" targets={[target]} goLiveDate loadLabel="Load"
      previewFacts={(r) => [{ label: "Rows", value: r.rows, type: "number" }]}
      confirmLoad={() => ({ title: "Load opening balances?", message: "Replaces the earlier load.", confirmLabel: "Load now" })} />);
    choose(csv());
    expect(button("Validate")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("go-live date"), { target: { value: "2026-10-01" } });
    fireEvent.click(button("Validate"));
    const result = await screen.findByRole("region", { name: "Validation result" });
    expect(importService.upload).toHaveBeenLastCalledWith("/v", expect.any(File), { goLiveDate: "2026-10-01" });
    expect(within(result).getByText("Errors found")).toBeInTheDocument();
    expect(within(result).getByText("Debit")).toBeInTheDocument();
    expect(within(result).getByText("Not an amount")).toBeInTheDocument();
    expect(button("Load")).toBeDisabled();

    importService.upload.mockResolvedValueOnce({ valid: true, rows: 2, errors: [] });
    fireEvent.click(button("Validate"));
    await screen.findByText("Valid");
    importService.upload.mockResolvedValueOnce({ message: "Loaded", accounts: 2 });
    fireEvent.click(button("Load"));
    expect(await screen.findByText("Replaces the earlier load.")).toBeInTheDocument();
    expect(importService.upload).toHaveBeenCalledTimes(2);
    fireEvent.click(button("Load now"));
    await waitFor(() => expect(importService.upload).toHaveBeenLastCalledWith("/u", expect.any(File), { goLiveDate: "2026-10-01" }));
    expect(await screen.findByText("Loaded")).toBeInTheDocument();
  });

  it("puts the row errors of the API in one shape and sizes files", () => {
    expect(errorRows([{ path: "row 5", message: "Row 5: Account 1 is inactive" }, { row: 2, column: "Debit", message: "x" }, { path: "code", error: "y" }]))
      .toEqual([{ key: "5-0", row: 5, column: null, message: "Account 1 is inactive" }, { key: "2-1", row: 2, column: "Debit", message: "x" }, { key: "code-2", row: "code", column: null, message: "y" }]);
    expect(fileSize(900)).toBe("900 B");
    expect(fileSize(2048)).toBe("2.0 KB");
    expect(fileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("upload preview: further steps, the rows read with their result filtered on the server, the error report, then commit", async () => {
    const targets = [{ label: "Policy list", templatePath: "/remittance/imports/template", validatePath: "/remittance/imports/validate" }];
    const preview = { id: "imp_1", status: "validated", statusLabel: "Validated", canCommit: true, counts: { rows: 3, ready: 2, errors: 1 }, errors: [] };
    importService.upload.mockResolvedValueOnce(preview);
    const rows = { all: [{ row: 2, policyNo: "TISPH-PC-1", due: 40191.18, result: { code: "ready", label: "Ready" } },
      { row: 3, policyNo: "TISPH-PC-2", due: 1200, result: { code: "ready", label: "Ready" } },
      { row: 4, policyNo: "X-9", due: null, result: { code: "not-found", label: "Not found", severity: "danger" } }] };
    rows.errors = [rows.all[2]];
    const previewRows = jest.fn((p, { result }) => Promise.resolve({ rows: rows[result], total: rows[result].length }));
    const onErrorReport = jest.fn().mockResolvedValue();
    const onCommit = jest.fn().mockResolvedValue({ message: "2 draft remittance(s) created." });
    const onDone = jest.fn();
    const { rerender } = render(<ImportDialog visible onHide={() => {}} title="Import policy list" targets={targets} fields={{ purposeCode: "ROC-GOLIVE" }} fieldsReady={false}
      steps={[{ key: "purpose", label: "Purpose", node: <span>purpose picker</span> }]} previewRows={previewRows} onErrorReport={onErrorReport} onCommit={onCommit} onDone={onDone}
      rowColumns={[{ field: "row", header: "Row", type: "number", key: true }, { field: "policyNo", header: "Policy No" }, { field: "due", header: "Due", type: "amount" },
        { field: "result", header: "Result", type: "result" }]}
      resultFilters={[{ label: "All rows", value: "all" }, { label: "Errors", value: "errors" }]}
      loadLabel={(p) => `Create ${p.counts.ready} draft remittances`} previewFacts={(p) => [{ label: "Ready", value: p.counts.ready, type: "number" }]} />);
    expect(screen.getByText("Purpose")).toBeInTheDocument();
    expect(screen.getByText("purpose picker")).toBeInTheDocument();
    choose(csv("policies.xlsx"));
    expect(button("Validate")).toBeDisabled();
    rerender(<ImportDialog visible onHide={() => {}} title="Import policy list" targets={targets} fields={{ purposeCode: "ROC-GOLIVE" }} fieldsReady
      steps={[{ key: "purpose", label: "Purpose", node: <span>purpose picker</span> }]} previewRows={previewRows} onErrorReport={onErrorReport} onCommit={onCommit} onDone={onDone}
      rowColumns={[{ field: "row", header: "Row", type: "number", key: true }, { field: "policyNo", header: "Policy No" }, { field: "due", header: "Due", type: "amount" },
        { field: "result", header: "Result", type: "result" }]}
      resultFilters={[{ label: "All rows", value: "all" }, { label: "Errors", value: "errors" }]}
      loadLabel={(p) => `Create ${p.counts.ready} draft remittances`} previewFacts={(p) => [{ label: "Ready", value: p.counts.ready, type: "number" }]} />);
    fireEvent.click(button("Validate"));
    expect(await screen.findByText("TISPH-PC-1")).toBeInTheDocument();
    expect(importService.upload).toHaveBeenCalledWith("/remittance/imports/validate", expect.any(File), { purposeCode: "ROC-GOLIVE" });
    expect(previewRows).toHaveBeenLastCalledWith(preview, { result: "all", page: 1, perPage: 50 });
    const region = screen.getByRole("region", { name: "Rows read" });
    expect(within(region).getByText((_, el) => !!el?.classList?.contains("p-tag") && el.textContent === "Not found")).toHaveClass("p-tag-danger");
    expect(within(region).getByText(/40,191\.18/)).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("Show"), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
    fireEvent.click(await screen.findByRole("option", { name: "Errors", hidden: true }));
    await waitFor(() => expect(previewRows).toHaveBeenLastCalledWith(preview, { result: "errors", page: 1, perPage: 50 }));
    await waitFor(() => expect(within(region).queryByText("TISPH-PC-1")).toBeNull());

    fireEvent.click(button("Download error report"));
    await waitFor(() => expect(onErrorReport).toHaveBeenCalledWith(preview));

    fireEvent.click(button("Create 2 draft remittances"));
    await screen.findByText("2 draft remittance(s) created.");
    expect(onCommit).toHaveBeenCalledWith(preview);
    expect(importService.upload).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalled();
  });
});
