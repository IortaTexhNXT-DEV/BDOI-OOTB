import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import SapGlExport from "./SapGlExport";
import service from "../../services/integrationsService";

const run = { id: 7, exportDate: "2026-10-08", runNo: 2, windowFrom: "2026-10-07T15:59:00Z", windowTo: "2026-10-08T15:59:00Z", trigger: "manual", status: "done",
  journalCount: 3, lineCount: 8, totalDebit: 1500, totalCredit: 1500, warnings: ["Accounts outside the SAP chart (sap_gl.account_pattern): 1202001"], createdBy: "Liza",
  files: [{ kind: "header", fileName: "ARHDTISPH20261008.txt" }, { kind: "line", fileName: "ARLITISPH20261008.txt" }] };

jest.mock("../../services/integrationsService", () => ({
  __esModule: true,
  default: { sapGlRuns: jest.fn(), sapGlSettings: jest.fn(), runSapGl: jest.fn(), downloadSapGlFile: jest.fn() },
}));
jest.mock("../Remittance/shared", () => ({ loadInsurerOptions: () => Promise.resolve([]) }));

describe("SAP GL export", () => {
  it("lists the runs with their files and warnings, runs a day and downloads a file", async () => {
    service.sapGlRuns.mockResolvedValue({ rows: [run], total: 1 });
    service.sapGlSettings.mockResolvedValue({ folder: "sap-outbound", exportDir: null, cutOff: "23:59", layout: { format: "delimited" } });
    service.runSapGl.mockResolvedValue({ message: "SAP GL files of 2026-10-08 written (run 2)", data: {} });
    service.downloadSapGlFile.mockResolvedValue();
    render(<MemoryRouter><SapGlExport /></MemoryRouter>);
    expect(await screen.findByText("ARLITISPH20261008.txt")).toBeInTheDocument();
    // the setting key in the warning is not shown to the user
    expect(screen.getByText("Accounts outside the SAP chart: 1202001")).toBeInTheDocument();
    // the folder is configuration: not on the screen of a user who is not an administrator
    expect(screen.queryByText(/sap-outbound/)).toBeNull();
    expect(screen.queryByText(/pick-up folder/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Run now/ }));
    // the run is confirmed first: nothing is written until the user says so
    fireEvent.click(await screen.findByRole("button", { name: "Write files" }));
    await waitFor(() => expect(service.runSapGl).toHaveBeenCalledTimes(1));
    expect(service.runSapGl.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.click(screen.getByText("ARHDTISPH20261008.txt"));
    expect(service.downloadSapGlFile).toHaveBeenCalledWith(7, "header", "ARHDTISPH20261008.txt");
  });

  it("shows the folder and cut-off to the administrator under Technical details", async () => {
    window.localStorage.setItem("USER_ROLES", JSON.stringify(["system-admin"]));
    service.sapGlRuns.mockResolvedValue({ rows: [], total: 0 });
    service.sapGlSettings.mockResolvedValue({ folder: "sap-outbound", exportDir: null, cutOff: "23:59", layout: { format: "delimited" } });
    render(<MemoryRouter><SapGlExport /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Technical details" }));
    expect(screen.getByText("sap-outbound").tagName).toBe("PRE");
    expect(screen.getByLabelText("Cut-off")).toHaveTextContent("23:59");
    window.localStorage.clear();
  });
});
