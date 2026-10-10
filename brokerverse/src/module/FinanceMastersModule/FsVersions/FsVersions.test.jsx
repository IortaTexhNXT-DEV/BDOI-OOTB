import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../../i18n";
import periodEndService from "../../../services/periodEndService";
import FsVersions from ".";
import { lineErrors, linesPayload } from "./model";

let mockPerms = [];
jest.mock("../../../utils/canOpen", () => ({ ...jest.requireActual("../../../utils/canOpen"), hasPermission: (p) => mockPerms.includes(p) }));
jest.mock("../../../services/periodEndService", () => ({ __esModule: true, default: { fsVersions: jest.fn(), fsVersion: jest.fn(), saveFsVersion: jest.fn(), createFsVersion: jest.fn() } }));
jest.mock("../../../utility/toastUtils", () => ({ showErrorMessage: jest.fn(), showSuccessMessage: jest.fn() }));

const line = { lineNo: 10, statement: "bs", section: "Current Assets", caption: "Cash and cash equivalents", glFrom: "100", glTo: "109", normalBalance: "debit", accounts: 5 };
const tis01 = { code: "TIS01", name: "TIS01 Local financial statements", purpose: "Statutory", scope: "full", status: "active", lineCount: 1, lines: [line],
  unmapped: [{ code: "700000", name: "Suspense - conversion", accountType: "asset" }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms = [];
  periodEndService.fsVersions.mockResolvedValue([{ code: "TIS01", name: tis01.name, scope: "full", status: "active", lineCount: 1 }]);
  periodEndService.fsVersion.mockResolvedValue(tis01);
  periodEndService.saveFsVersion.mockResolvedValue(tis01);
});

describe("Financial statement versions", () => {
  it("checks the lines the server checks", () => {
    expect(lineErrors([line], "full")).toEqual({});
    expect(lineErrors([{ ...line, glFrom: "5", glTo: "1" }], "full")).toEqual({ "0.glTo": "glOrder" });
    expect(lineErrors([line, { ...line }], "full")).toEqual({ "1.lineNo": "lineNoTwice" });
    expect(lineErrors([line], "income")).toEqual({ "0.statement": "incomeOnly" });
    expect(linesPayload([{ ...line, lineNo: 20, _key: "a" }, { ...line, _key: "b" }]).map((l) => l.lineNo)).toEqual([10, 20]);
  });

  it("a reader sees the lines and the accounts no line takes, without edit buttons", async () => {
    render(<FsVersions />);
    expect(await screen.findByText("Cash and cash equivalents")).toBeInTheDocument();
    expect(screen.getByText("Suspense - conversion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add version" })).not.toBeInTheDocument();
  });

  it("Finance adds a line, is told what is missing, then saves", async () => {
    mockPerms = ["write:journal-vouchers"];
    render(<FsVersions />);
    await screen.findByDisplayValue("Cash and cash equivalents");
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(periodEndService.saveFsVersion).not.toHaveBeenCalled();
    expect((await screen.findAllByText("Enter an account code or its first digits")).length).toBe(2);
    const captions = screen.getAllByLabelText("FS line");
    fireEvent.change(captions[1], { target: { value: "Receivables" } });
    fireEvent.change(screen.getAllByLabelText("GL from")[1], { target: { value: "110" } });
    fireEvent.change(screen.getAllByLabelText("GL to")[1], { target: { value: "119" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(periodEndService.saveFsVersion).toHaveBeenCalledWith("TIS01", expect.objectContaining({
      lines: [expect.objectContaining({ lineNo: 10 }), expect.objectContaining({ lineNo: 20, caption: "Receivables", glFrom: "110", glTo: "119", section: "Current Assets" })],
    })));
  });
});
