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
});
