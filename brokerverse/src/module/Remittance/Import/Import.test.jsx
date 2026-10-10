import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import { remittanceService } from "../../../services/remittanceService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import { ImportHistory, ImportPolicyList, fileProblem } from ".";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    importLimits: jest.fn(), validateImport: jest.fn(), getImport: jest.fn(), importRows: jest.fn(), commitImport: jest.fn(), discardImport: jest.fn(),
    submitRemittances: jest.fn(), listImports: jest.fn(), download: jest.fn(),
    importTemplatePath: "/remittance/imports/template",
    importErrorsPath: (id) => `/remittance/imports/${id}/errors.xlsx`,
    importFilePath: (id) => `/remittance/imports/${id}/file`,
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../components/ReasonPicker", () => {
  const actual = jest.requireActual("../../../components/ReasonPicker");
  // the purpose list of the Reason Codes master, as one button that chooses "Go-live opening"
  const Picker = ({ label, onChange }) => (
    <button type="button" onClick={() => onChange({ reasonCode: "ROC-GOLIVE", reasonLabel: "Go-live opening", note: "", noteRequired: false })}>{label}</button>
  );
  return { __esModule: true, ...actual, default: Picker };
});

const MB = 1024 * 1024;
const LIMITS = { maxBytes: 10 * MB, maxMb: 10, maxRows: 5000, fileTypes: [".xlsx", ".csv"] };
const imp = (extra = {}) => ({
  id: "imp_4", importNo: "IMP-2026-0004", status: "validated", statusLabel: "Validated", version: 1,
  purpose: { code: "ROC-GOLIVE", text: "Go-live opening" }, file: { name: "golive.xlsx", sizeText: "18 KB" },
  counts: { rows: 52, ready: 46, warnings: 4, errors: 6, held: 0, exceptions: 0 },
  toCreate: [
    { insurer: { id: 3, name: "Pioneer Insurance & Surety Corp." }, productLine: "Motor", basisLabel: "Net", policies: 40, dueToInsurer: 1000000, varianceRows: 4 },
    { insurer: { id: 3, name: "Pioneer Insurance & Surety Corp." }, productLine: "Personal Accident", basisLabel: "Net", policies: 4, dueToInsurer: 104553.1, varianceRows: 0 },
    { insurer: { id: 5, name: "Malayan Insurance Co., Inc." }, productLine: "Motor", basisLabel: "Net", policies: 2, dueToInsurer: 100000, varianceRows: 0 },
  ],
  totals: { remittances: 3, policies: 46, dueToInsurer: 1204553.1 }, drafts: [], canCommit: true, commitBlockedReason: null, canDiscard: true,
  ...extra,
});
const VARIANCE_ROW = { rowNo: 2, policyNo: "TISPH-PC-0001240", insurer: "Pioneer Insurance & Surety Corp.", productLine: "Motor", result: "ready-variance",
  resultLabel: "Ready · Variance", kind: "warning", message: "File 25,871.34, system 25,817.34, difference -54.00", systemDue: 25817.34, expectedDue: 25871.34, variance: -54 };

const fileOf = (name, size) => {
  const f = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(f, "size", { value: size });
  return f;
};
const open = (importId = "new", props = {}) => render(
  <MemoryRouter>
    <ImportPolicyList importId={importId} onHide={jest.fn()} onOpen={jest.fn()} {...props} />
    <ConfirmDialogHost />
  </MemoryRouter>
);
const choose = (file) => fireEvent.change(screen.getByLabelText(/^File/), { target: { files: [file] } });

beforeEach(() => {
  jest.clearAllMocks();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:remittance", "write:remittance"]));
  remittanceService.importLimits.mockResolvedValue(LIMITS);
  remittanceService.importRows.mockResolvedValue({ data: [VARIANCE_ROW], total: 1 });
  remittanceService.download.mockResolvedValue();
});

describe("Import policy list", () => {
  it("downloads the template and refuses a 12 MB file in the browser with the limit in the message", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Download template" }));
    expect(remittanceService.download).toHaveBeenCalledWith("/remittance/imports/template", "Remittance_Policy_List_Template.xlsx");
    await waitFor(() => expect(remittanceService.importLimits).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Purpose" }));
    choose(fileOf("opening.xlsx", 12 * MB));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose an .xlsx or .csv file of at most 10 MB.");
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    choose(fileOf("opening.pdf", 1000));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an .xlsx or .csv file of at most 10 MB.");
    expect(remittanceService.validateImport).not.toHaveBeenCalled();
  });

  it("validates the file with the purpose and shows the counts, the variance, the remittances to create and the error report", async () => {
    remittanceService.validateImport.mockResolvedValue(imp());
    const onOpen = jest.fn();
    open("new", { onOpen });
    await waitFor(() => expect(remittanceService.importLimits).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Purpose" }));
    choose(fileOf("golive.xlsx", 18000));
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => expect(remittanceService.validateImport).toHaveBeenCalledWith(expect.any(File), { purposeCode: "ROC-GOLIVE", note: undefined }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("imp_4"));
    for (const chip of ["Rows 52", "Ready 46", "Errors 6", "Warnings 4", "Fully paid check: not yet available"]) expect(await screen.findByText(chip)).toBeInTheDocument();
    expect(await screen.findByText("File 25,871.34, system 25,817.34, difference -54.00")).toBeInTheDocument();
    expect(screen.getByText("PHP -54.00")).toBeInTheDocument();
    expect(screen.getByText("Remittances to create")).toBeInTheDocument();
    expect(screen.getByText("PHP 1,204,553.10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download error report" }));
    await waitFor(() => expect(remittanceService.download).toHaveBeenCalledWith("/remittance/imports/imp_4/errors.xlsx", "IMP-2026-0004_Errors.xlsx"));
  });

  it("creates the drafts after the confirmation, links them, and submits them for approval behind the bulk confirmation", async () => {
    remittanceService.getImport.mockResolvedValue(imp());
    const drafts = [31, 32, 33].map((n) => ({ id: `rm_${n}`, remittanceNo: `REM-2026-000${n}`, policies: 10, dueToInsurer: 100000, link: `/finance/remittance/remittances/rm_${n}` }));
    remittanceService.commitImport.mockResolvedValue({ data: { import: imp({ status: "committed", statusLabel: "Committed", canCommit: false, drafts }), drafts, skipped: [] } });
    remittanceService.submitRemittances.mockResolvedValue({ submitted: 3, refused: 0, results: drafts.map((d) => ({ id: d.id, reference: d.remittanceNo, ok: true })) });
    const onChanged = jest.fn();
    open("imp_4", { onChanged });
    fireEvent.click(await screen.findByRole("button", { name: "Create 3 draft remittances" }));
    const confirm = await screen.findByRole("dialog", { name: "Create draft remittances" });
    expect(within(confirm).getByText(/Create 3 draft remittances for PHP 1,204,553.10 from 46 policies\?/)).toBeInTheDocument();
    expect(remittanceService.commitImport).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Create 3 drafts" }));
    await waitFor(() => expect(remittanceService.commitImport).toHaveBeenCalledWith("imp_4", 1));
    expect(await screen.findByText("3 drafts created:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "REM-2026-00031" })).toHaveAttribute("href", "/finance/remittance/remittances/rm_31");
    expect(onChanged).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit the 3 drafts for approval" }));
    const submit = await screen.findByRole("dialog", { name: "Submit for approval" });
    fireEvent.click(within(submit).getByRole("button", { name: "Submit 3 remittances" }));
    expect(await screen.findByText("3 submitted · 0 not submitted")).toBeInTheDocument();
    expect(remittanceService.submitRemittances).toHaveBeenCalledWith([{ id: "rm_31", version: undefined }, { id: "rm_32", version: undefined }, { id: "rm_33", version: undefined }]);
    expect(screen.getByRole("button", { name: "Go to drafts" })).toBeInTheDocument();
  });

  it("blocks Create for a file imported before and when no row is ready, with the reason", async () => {
    const same = "This file was imported on 03/10/2026 as IMP-2026-0003 (3 drafts).";
    remittanceService.getImport.mockResolvedValueOnce(imp({ canCommit: false, commitBlockedReason: same, sameFile: { importNo: "IMP-2026-0003" } }));
    const { unmount } = open("imp_5");
    expect(await screen.findByText(same)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create 3 draft remittances" })).toBeDisabled();
    unmount();
    remittanceService.getImport.mockResolvedValueOnce(imp({ counts: { rows: 2, ready: 0, errors: 2, warnings: 0 }, toCreate: [], totals: { remittances: 0, policies: 0, dueToInsurer: 0 },
      canCommit: false, commitBlockedReason: "No row is ready to remit." }));
    open("imp_6");
    expect(await screen.findByText("No row is ready to remit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create 0 draft remittances" })).toBeDisabled();
  });

  it("keeps the chosen file after a server error and offers Try again", async () => {
    remittanceService.validateImport.mockRejectedValueOnce(Object.assign(new Error("The server could not read the file."), { status: 500 })).mockResolvedValueOnce(imp());
    open();
    await waitFor(() => expect(remittanceService.importLimits).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Purpose" }));
    choose(fileOf("golive.xlsx", 18000));
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(await screen.findByText("The server could not read the file.")).toBeInTheDocument();
    expect(screen.getByText("golive.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Rows 52")).toBeInTheDocument();
    expect(remittanceService.validateImport).toHaveBeenCalledTimes(2);
  });

  it("checks the type and size of a file against the server's limits", () => {
    expect(fileProblem(fileOf("list.xlsx", 9 * MB), LIMITS)).toBeNull();
    expect(fileProblem(fileOf("LIST.CSV", 100), LIMITS)).toBeNull();
    expect(fileProblem(fileOf("list.xlsx", 12 * MB), LIMITS)).toBe("size");
    expect(fileProblem(fileOf("list.xls", 100), LIMITS)).toBe("type");
    expect(fileProblem(fileOf("list.xlsx", 12 * MB), null)).toBeNull();
  });
});

describe("Import history", () => {
  it("lists the imports with their drafts and downloads the file or the error report", async () => {
    remittanceService.listImports.mockResolvedValue({ data: [imp({ status: "committed", statusLabel: "Committed", uploadedAt: "2026-10-12T02:00:00.000Z", uploadedBy: { name: "M. Reyes" },
      drafts: [{ id: "rm_31", remittanceNo: "REM-2026-00031", link: "/finance/remittance/remittances/rm_31" }] })], total: 1 });
    const onView = jest.fn();
    render(<MemoryRouter><ImportHistory visible onHide={jest.fn()} onView={onView} /></MemoryRouter>);
    expect(await screen.findByText("IMP-2026-0004")).toBeInTheDocument();
    expect(screen.getByText("12/10/2026 10:00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "REM-2026-00031" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download golive.xlsx" }));
    expect(remittanceService.download).toHaveBeenCalledWith("/remittance/imports/imp_4/file", "golive.xlsx");
    fireEvent.click(screen.getByRole("button", { name: "Actions for IMP-2026-0004" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "View result" }));
    expect(onView).toHaveBeenCalledWith("imp_4");
  });
});
