import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DatFiles, { checkLabel, mainTotal } from "./DatFiles";
import SalesInvoices from "./SalesInvoices";
import EisOutbox, { filterOptions } from "./EisOutbox";
import birTaxService from "../../services/birTaxService";
import opsAccountingService from "../../services/opsAccountingService";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && typeof o.defaultValue === "string" ? o.defaultValue : o && o.name ? `${k}(${o.name})` : k) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));
jest.mock("../../services/birTaxService", () => ({
  __esModule: true,
  default: {
    datFiles: jest.fn(), datFile: jest.fn(), generateDat: jest.fn(), downloadDatFile: jest.fn(),
    invoices: jest.fn(), invoice: jest.fn(), seller: jest.fn(), cancelInvoice: jest.fn(), invoicePdf: jest.fn(), invoiceCandidates: jest.fn(),
    eisStatus: jest.fn(), eisSubmissions: jest.fn(), eisSubmission: jest.fn(), eisRetry: jest.fn(), eisManual: jest.fn(), eisProcess: jest.fn(), eisExport: jest.fn(),
  },
}));

const signIn = ({ roles = ["accounting"], permissions = ["read:period-end", "write:period-end"] } = {}) => {
  localStorage.setItem("user", JSON.stringify({ userId: "usr_1", username: "usr_1", roles }));
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const page = (el) => render(<MemoryRouter>{el}</MemoryRouter>);

const datFile = {
  id: "bdf_1", type: "qap", form: null, year: 2026, quarter: 3, periodKey: "2026-Q3", fileName: "68544286100000920261601EQ.DAT", records: 4, rows: 2,
  totals: { incomePayment: 35000.5, taxWithheld: 3000.05 }, valid: false, generatedByName: "Maria Santos", generatedAt: "2026-10-05T02:15:00Z",
  checks: [{ code: "records", report: 2, file: 2, difference: 0, agrees: true }, { code: "taxWithheld", report: 3000.05, file: 3000.05, difference: 0, agrees: true }],
  errors: [{ record: 2, name: "NO TIN CORP.", code: "tinMissing" }], layoutVersion: "BIR Alphalist v7.x", layout: { records: ["HQAP,H1601EQ,TIN"] }, content: "HQAP,H1601EQ,685442861\r\n",
};

beforeEach(() => {
  jest.clearAllMocks();
  signIn();
  opsAccountingService.masterRecords.mockResolvedValue({ rows: [
    { code: "SIC-WRONGBUYER", name: "Wrong buyer or buyer details", context: "sales_invoice_cancel", status: "Active", requiresNote: false, sortOrder: 1 },
    { code: "SIC-OTHER", name: "Other", context: "sales_invoice_cancel", status: "Active", requiresNote: true, sortOrder: 9 },
  ] });
});
afterEach(() => localStorage.clear());

describe("BIR DAT Files", () => {
  beforeEach(() => {
    birTaxService.datFiles.mockResolvedValue([{ ...datFile, content: undefined, layout: undefined }]);
    birTaxService.datFile.mockResolvedValue(datFile);
  });

  it("lists the generated files and the validation of the newest one, with the file content only in the technical details", async () => {
    page(<DatFiles />);
    expect(await screen.findByText("birTax.datCheck.taxWithheld")).toBeInTheDocument();
    expect(screen.getAllByText(datFile.fileName)[0]).toHaveClass("tax-file-name");
    expect(screen.getByText("birTax.datError.tinMissing")).toBeInTheDocument();
    expect(screen.getAllByText("birTax.datResult.invalid").length).toBeGreaterThan(0);
    expect(screen.getByText("Maria Santos", { selector: "td" })).toBeInTheDocument();
    // no layout banner or raw content on the page; the content is behind the technical details
    expect(screen.queryByText(/HQAP,H1601EQ/)).toBeNull();
    expect(screen.getByText("birTax.datFilesHelp")).toHaveClass("p-hidden-accessible");
    fireEvent.click(screen.getByRole("button", { name: /technicalDetails.title|Technical details/ }));
    expect(screen.getByText(/HQAP,H1601EQ,685442861/)).toBeInTheDocument();
  });

  it("keeps the technical details from users outside finance and IT", async () => {
    signIn({ roles: ["claims"], permissions: ["read:period-end"] });
    page(<DatFiles />);
    await screen.findByText("birTax.datCheck.taxWithheld");
    expect(screen.queryByRole("button", { name: /technicalDetails.title|Technical details/ })).toBeNull();
    // and generating needs the write permission
    expect(screen.queryByRole("button", { name: "birTax.generateFile" })).toBeNull();
  });

  it("generates a file for the chosen form and period and selects it", async () => {
    const generated = { ...datFile, id: "bdf_2", type: "sawt", form: "1702Q", valid: true, errors: [] };
    birTaxService.generateDat.mockResolvedValue(generated);
    page(<DatFiles />);
    await screen.findByText("birTax.datCheck.taxWithheld");
    fireEvent.click(screen.getByRole("button", { name: "birTax.generateFile" }));
    await waitFor(() => expect(birTaxService.generateDat).toHaveBeenCalledWith("qap", expect.objectContaining({ year: expect.any(Number), quarter: expect.any(Number) })));
    expect(await screen.findByText("birTax.noErrors")).toBeInTheDocument();
  });

  it("names the checks and the main total of a file", () => {
    const t = (k, o) => (o && o.name ? `${k}(${o.name})` : k);
    expect(checkLabel(t, "incomePaymentExempt")).toBe("birTax.datCheck.exempt(birTax.datCheck.incomePayment)");
    expect(checkLabel(t, "taxWithheldDetail")).toBe("birTax.datCheck.detailSum(birTax.datCheck.taxWithheld)");
    expect(mainTotal({ incomePayment: 10, taxWithheld: 1 })).toBe(1);
    expect(mainTotal({ taxableSales: 50, outputTax: 6 })).toBe(6);
    expect(mainTotal({})).toBeNull();
  });
});

describe("Sales Invoices", () => {
  const invoice = {
    id: "sin_1", invoiceNumber: "SI-0000000001", invoiceDate: "2026-10-04", buyerName: "Malayan Insurance Co., Inc.", sourceType: "manual", sourceReference: null,
    totalSales: 10000, vatAmount: 1200, totalAmount: 11200, balance: 11200, withholdingTax: 0, amountPaid: 0, vatableSales: 10000, vatExemptSales: 0, zeroRatedSales: 0,
    status: "issued", eisStatus: null, seller: { registeredName: "TISPH", tinFormatted: "685-442-861-00000", vatRegistered: true }, lines: [], payments: [],
  };
  beforeEach(() => {
    birTaxService.invoices.mockResolvedValue([invoice, { ...invoice, id: "sin_2", invoiceNumber: "SI-0000000002", status: "cancelled", totalAmount: 500, balance: 0 }]);
    birTaxService.invoice.mockResolvedValue(invoice);
    birTaxService.seller.mockResolvedValue({ registeredName: "Toyota Insurance Services Philippines Corporation", tinFormatted: "685-442-861-00000", vatRegistered: true,
      serialFrom: 1, serialTo: 9999999999, setup: { state: "incomplete", missing: ["permit", "permitDate"] } });
  });

  it("shows the seller facts and the invoicing setup chip instead of a paragraph and a settings bar", async () => {
    page(<SalesInvoices />);
    expect(await screen.findByText("Toyota Insurance Services Philippines Corporation")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: "birTax.invoicingSetup: incomplete" });
    fireEvent.click(chip);
    expect(await screen.findByText("birTax.setupMissing.permit")).toBeInTheDocument();
    expect(screen.queryByText(/invoice\.atp_number|EOPT Act|RR 7-2024/)).toBeNull();
    expect(screen.getByText("birTax.salesInvoicesHelp")).toHaveClass("p-hidden-accessible");
    // totals of the issued invoices only
    expect(await screen.findByText("birTax.totalIssued")).toBeInTheDocument();
  });

  it("cancels an invoice with a reason from the list, not free text", async () => {
    birTaxService.cancelInvoice.mockResolvedValue({ ...invoice, status: "cancelled" });
    page(<SalesInvoices />);
    fireEvent.click(await screen.findByText("SI-0000000001"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "birTax.cancelInvoice" }));
    const cancel = (await screen.findAllByRole("dialog")).pop();
    expect(within(cancel).queryByRole("textbox", { name: "birTax.reason" })).toBeNull();
    fireEvent.click(within(cancel).getByRole("button", { name: "birTax.cancelInvoice" }));
    expect(birTaxService.cancelInvoice).not.toHaveBeenCalled();
  });

  it("offers no new invoice or cancellation to a read-only user", async () => {
    signIn({ permissions: ["read:period-end"] });
    page(<SalesInvoices />);
    fireEvent.click(await screen.findByText("SI-0000000001"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "birTax.cancelInvoice" })).toBeNull();
    expect(screen.queryByRole("button", { name: "birTax.newInvoice" })).toBeNull();
  });
});

describe("E-Invoicing (EIS)", () => {
  beforeEach(() => {
    birTaxService.eisStatus.mockResolvedValue({ enabled: false, mode: "test", counts: { failed: 1, accepted: 2 }, lastSentAt: null, setup: { state: "off", missing: ["accreditationId"] } });
    birTaxService.eisSubmissions.mockResolvedValue([{ id: "eis_1", invoiceNumber: "SI-0000000003", kind: "invoice", status: "failed", mode: "test", attempts: 1, lastError: "Service unavailable" }]);
  });

  it("shows the connection as a configuration chip, never the setting key", async () => {
    page(<EisOutbox />);
    expect(await screen.findByRole("button", { name: "birTax.eisConnection: off" })).toBeInTheDocument();
    expect(screen.queryByText(/eis\.enabled|Master > Configuration/)).toBeNull();
    expect(screen.queryByRole("button", { name: "birTax.sendNow" })).toBeNull();
    expect(await screen.findByText("SI-0000000003")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "birTax.retry" })).toBeInTheDocument();
  });

  it("filters the outbox by status with counts and shows a one-line empty state", async () => {
    birTaxService.eisSubmissions.mockResolvedValue([]);
    page(<EisOutbox />);
    expect(await screen.findByText("birTax.outboxEmpty")).toBeInTheDocument();
    fireEvent.click(await screen.findByText("birTax.status.failed 1"));
    await waitFor(() => expect(birTaxService.eisSubmissions).toHaveBeenLastCalledWith({ status: "failed" }));
    const t = (k) => k;
    expect(filterOptions(t, { failed: 1, accepted: 2 }).map((o) => o.label)).toEqual(["birTax.all 3", "birTax.status.queued 0", "birTax.status.failed 1",
      "birTax.status.rejected 0", "birTax.status.accepted 2", "birTax.status.manual 0"]);
  });
});
