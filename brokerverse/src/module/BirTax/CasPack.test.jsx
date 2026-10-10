import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CasPack from "./CasPack";
import CasDocumentDialog, { CompareView, fromLabels, resolveFields, toLabels } from "./CasDocumentDialog";
import birTaxService from "../../services/birTaxService";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && typeof o.defaultValue === "string" ? o.defaultValue : k) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ data: [] }) } }));
jest.mock("../../services/birTaxService", () => ({
  __esModule: true,
  default: {
    casChecklist: jest.fn(), casDocuments: jest.fn(), bookPrints: jest.fn(), bookPreview: jest.fn(), casRegistration: jest.fn(), saveCasRegistration: jest.fn(),
    casDocument: jest.fn(), saveCasDraft: jest.fn(), submitCasDraft: jest.fn(), startCasDraft: jest.fn(), casDocumentPdf: jest.fn(), voidPrint: jest.fn(),
  },
}));

const checklist = [
  { code: "company", item: "Taxpayer name, TIN and registered address", status: "complete", value: "Toyota Insurance Services Philippines", action: "company" },
  { code: "rdo", item: "RDO code", status: "missing", value: null, action: "company" },
  { code: "permit", item: "CAS permit or acknowledgement number and date", status: "missing", value: null, action: "permit" },
  { code: "custodian", item: "Backup custodian", status: "missing", value: null, action: "custodian" },
  { code: "systemDescription", item: "System description approved", status: "missing", value: null, action: "document" },
  { code: "books", item: "Books printed at least once", status: "missing", value: null, action: "books" },
];
const fields = [{ key: "taxpayerName", label: "Taxpayer name", value: "TISPH" }, { key: "tin", label: "TIN", value: "" }];
const draft = {
  id: "casd_1", version: 1, status: "draft", sections: [{ key: "s1", heading: "Purpose and scope", text: "System of {{taxpayerName}}" }],
  makers: ["usr_maker"], createdBy: "usr_maker", createdByName: "Maker", updatedAt: "2026-10-01T02:00:00Z",
};
const signIn = ({ roles = ["accounting"], permissions = ["read:period-end", "write:period-end"], userId = "usr_other" } = {}) => {
  localStorage.setItem("user", JSON.stringify({ userId, username: userId, roles }));
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};

beforeEach(() => {
  jest.clearAllMocks();
  signIn();
  birTaxService.casChecklist.mockResolvedValue({ books: [{ code: "general_journal", title: "General Journal" }], checklist });
  birTaxService.casDocuments.mockResolvedValue([{ type: "system_description", slug: "system-description", title: "System Description and Controls", approved: null, open: null }]);
  birTaxService.bookPrints.mockResolvedValue([]);
  birTaxService.bookPreview.mockResolvedValue({ columns: [{ key: "date", label: "Date" }], rows: [], totals: {} });
  birTaxService.casRegistration.mockResolvedValue({ permitNumber: "", permitDate: "", people: [{ userId: "usr_1", name: "Ana Reyes", email: "ana@example.ph", position: "IT Officer" }] });
});
afterEach(() => localStorage.clear());

const renderPage = () => render(<MemoryRouter initialEntries={["/accounts/tax/cas"]}><CasPack /></MemoryRouter>);

describe("CAS Books and Documents", () => {
  it("lists the readiness in business words with Complete / Missing and an action on every missing item", async () => {
    renderPage();
    await screen.findByText("Taxpayer name, TIN and registered address");
    const [table] = screen.getAllByRole("table");
    expect(within(table).queryByText(/cas\.|Master >|\(/)).toBeNull();
    expect(within(table).getAllByText("birTax.casReadiness.missing")).toHaveLength(5);
    expect(within(table).getByText("birTax.casReadiness.complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "birTax.casReadiness.enter.permit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "birTax.casReadiness.enter.custodian" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "birTax.casReadiness.openDocument" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "birTax.casReadiness.goToBooks" })).toBeInTheDocument();
    // the Company master is linked for administrators only
    expect(screen.queryByText("birTax.casReadiness.openCompany")).toBeNull();
    // the page help sits behind the help icon, not in a paragraph
    expect(screen.getByText("birTax.casHelp")).toHaveClass("p-hidden-accessible");
  });

  it("links the company items to the Company master for an administrator", async () => {
    signIn({ roles: ["system-admin"] });
    renderPage();
    expect(await screen.findAllByRole("button", { name: "birTax.casReadiness.openCompany" })).not.toHaveLength(0);
    expect(screen.queryByText("birTax.casReadiness.setByAdministrator")).toBeNull();
  });

  it("hides the registration actions from a read-only user", async () => {
    signIn({ permissions: ["read:period-end"] });
    renderPage();
    await screen.findByText("RDO code");
    expect(screen.queryByRole("button", { name: "birTax.casReadiness.enter.permit" })).toBeNull();
    // the company items are the administrator's
    expect(screen.getAllByText("birTax.casReadiness.setByAdministrator").length).toBeGreaterThan(0);
  });

  it("asks for the permit number and date before saving them", async () => {
    birTaxService.saveCasRegistration.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "birTax.casReadiness.enter.permit" }));
    await screen.findByLabelText(/birTax.casReg.number.permit/);
    fireEvent.click(screen.getByRole("button", { name: "birTax.casReg.save" }));
    expect(await screen.findAllByText("birTax.casReg.required")).toHaveLength(2);
    expect(birTaxService.saveCasRegistration).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/birTax.casReg.number.permit/), { target: { value: "CAS-2026-0001" } });
    expect(screen.getByLabelText(/birTax.casReg.date.permit/)).not.toHaveAttribute("type", "date");
  });
});

describe("CAS document dialog", () => {
  it("resolves the live fields as printed", () => {
    expect(resolveFields("{{taxpayerName}} / {{tin}} / {{other}}", fields)).toBe("TISPH / - / {{other}}");
    expect(toLabels("{{taxpayerName}} ({{tin}})", fields)).toBe("[Taxpayer name] ([TIN])");
    expect(fromLabels("[Taxpayer name] ([TIN])", fields)).toBe("{{taxpayerName}} ({{tin}})");
  });

  it("edits a draft: sections, insert field, add section; submit asks for a reason with its note as the change note", async () => {
    birTaxService.casDocument.mockResolvedValue({ slug: "system-description", title: "System Description and Controls", open: draft, approved: null, versions: [draft], fields, activity: [] });
    render(<CasDocumentDialog slug="system-description" onHide={jest.fn()} onChanged={jest.fn()} />);
    const heading = await screen.findByLabelText("birTax.casDoc.heading");
    expect(heading.value).toBe("Purpose and scope");
    // the live fields are edited by their label, and kept as fields
    expect(screen.getByLabelText("birTax.casDoc.text").value).toBe("System of [Taxpayer name]");
    fireEvent.change(heading, { target: { value: "Scope" } });
    fireEvent.click(screen.getByRole("button", { name: "birTax.casDoc.addSection" }));
    expect(screen.getAllByLabelText("birTax.casDoc.heading")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "birTax.casDoc.saveDraft" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "birTax.submit" }));
    const submit = await screen.findAllByRole("button", { name: "birTax.submit" });
    fireEvent.click(submit[submit.length - 1]);
    expect(await screen.findByText("reasonPicker.reasonRequired")).toBeInTheDocument();
    expect(screen.getByLabelText(/birTax.casDoc.changeNote/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Note/)).toBeNull();
    expect(birTaxService.submitCasDraft).not.toHaveBeenCalled();
    expect(birTaxService.saveCasDraft).not.toHaveBeenCalled();
  });

  it("disables the approval for the user who prepared the version (maker-checker)", async () => {
    signIn({ permissions: ["read:period-end", "write:period-end", "approve:period-end"], userId: "usr_maker" });
    const submitted = { ...draft, status: "submitted", submittedBy: "usr_maker", submittedByName: "Maker", submittedAt: "2026-10-02T02:00:00Z", changeNote: "First" };
    birTaxService.casDocument.mockResolvedValue({ slug: "system-description", title: "System Description and Controls", open: submitted, approved: null, versions: [submitted], fields, activity: [] });
    render(<CasDocumentDialog slug="system-description" onHide={jest.fn()} onChanged={jest.fn()} />);
    const approve = await screen.findByRole("button", { name: "birTax.casDoc.approveVersion" });
    expect(approve).toBeDisabled();
    expect(screen.getByText("makerChecker.ownRecord")).toBeInTheDocument();
    expect(screen.queryByLabelText("birTax.casDoc.heading")).toBeNull();
    expect(screen.getByText("System of TISPH")).toBeInTheDocument();
  });

  it("lets another approver approve", async () => {
    signIn({ permissions: ["read:period-end", "approve:period-end"], userId: "usr_checker" });
    const submitted = { ...draft, status: "submitted", submittedBy: "usr_maker", submittedAt: "2026-10-02T02:00:00Z" };
    birTaxService.casDocument.mockResolvedValue({ slug: "system-description", title: "System Description and Controls", open: submitted, approved: null, versions: [submitted], fields, activity: [] });
    render(<CasDocumentDialog slug="system-description" onHide={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "birTax.casDoc.approveVersion" })).not.toBeDisabled());
  });

  it("shows a comparison of two versions", () => {
    render(<CompareView data={{
      from: { version: 1 }, to: { version: 2 }, summary: { added: 0, removed: 0, changed: 1 },
      sections: [{ key: "s1", change: "changed", heading: "Scope", headingBefore: "Purpose", lines: [{ type: "removed", text: "Old line" }, { type: "added", text: "New line" }] }],
    }} />);
    expect(screen.getByText("Purpose").tagName).toBe("DEL");
    expect(screen.getByText("Old line")).toHaveClass("cas-compare__line--removed");
    expect(screen.getByText("New line")).toHaveClass("cas-compare__line--added");
  });
});
