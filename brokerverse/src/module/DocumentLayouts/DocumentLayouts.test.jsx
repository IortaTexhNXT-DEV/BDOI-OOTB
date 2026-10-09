import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import EmailLayoutPage from "./EmailLayout";
import DocumentsLayoutPage from "./DocumentsLayout";
import DocumentSignaturesPage from "./DocumentSignatures";
import brandingService from "../../services/brandingService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/brandingService", () => ({
  __esModule: true,
  default: { getEditor: jest.fn(), validate: jest.fn(), save: jest.fn(), previewDocument: jest.fn(), previewEmail: jest.fn(), getSlots: jest.fn(), saveSlots: jest.fn() },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));

// the theme of the Toyota Insurance Services brand pack: the layout screens keep its preset, colours and sign-in page
const THEME = {
  preset: "custom", name: "Toyota Insurance Services", colors: { primary: "#1a1a1a", accent: "#eb0a1e" }, login: { panel: "library", headline: "Welcome" },
  logo: { appHeight: 40, documentHeight: 46 },
  documents: { accentColor: "#eb0a1e", footerText: "Licence No. {{licence}}", showLogo: true },
  email: { enabled: true, headerBg: "#ffffff", headerText: "#1a1a1a", accentColor: "#eb0a1e", showLogo: true, footerText: "{{companyName}}" },
};
const EDITOR = { theme: THEME, systemName: "Toyota Insurance Services", documentBranding: { accent: "#eb0a1e" } };

beforeEach(() => {
  jest.clearAllMocks();
  brandingService.getEditor.mockResolvedValue(EDITOR);
  brandingService.validate.mockResolvedValue({ errors: [], warnings: [] });
  brandingService.save.mockImplementation(async (theme) => ({ ...EDITOR, theme, warnings: [] }));
});

describe("E-mail Layout", () => {
  it("saves the e-mail section only, with the preset, colours and sign-in page of the theme unchanged", async () => {
    render(<EmailLayoutPage />);
    const footer = await screen.findByLabelText("Footer ({{companyName}}, {{address}}, {{licence}}, {{tin}})");
    fireEvent.change(footer, { target: { value: "{{companyName}} | {{address}}" } });
    fireEvent.click(screen.getByTestId("save-email-layout"));
    await waitFor(() => expect(brandingService.save).toHaveBeenCalledTimes(1));
    const [saved] = brandingService.save.mock.calls[0];
    expect(saved.email.footerText).toBe("{{companyName}} | {{address}}");
    expect(saved).toMatchObject({ preset: THEME.preset, colors: THEME.colors, login: THEME.login, documents: THEME.documents });
    expect(brandingService.save.mock.calls[0]).toHaveLength(1);
  });

  it("shows the sample e-mail drawn by the server", async () => {
    brandingService.previewEmail.mockResolvedValue({ html: "<p>Sample</p>" });
    render(<EmailLayoutPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Show a sample e-mail" }));
    await waitFor(() => expect(screen.getByTitle("e-mail").getAttribute("srcdoc")).toBe("<p>Sample</p>"));
  });
});

describe("Documents and Reports Layout", () => {
  it("cannot be saved while a blocking contrast check fails", async () => {
    brandingService.validate.mockResolvedValue({ errors: [{ path: "contrast.docTableHeader", message: "Document table header: contrast 1.2:1 is below WCAG AA 4.5:1" }] });
    render(<DocumentsLayoutPage />);
    expect(await screen.findByText(/Cannot save: Document table header/)).toBeInTheDocument();
    expect(screen.getByTestId("save-documents-layout")).toBeDisabled();
  });

  it("saves the footer of the documents with the e-mail section unchanged", async () => {
    render(<DocumentsLayoutPage />);
    const footer = await screen.findByLabelText("Footer on every document and report ({{licence}}, {{tin}}, {{companyName}})");
    fireEvent.change(footer, { target: { value: "IC Licence No. {{licence}}" } });
    await waitFor(() => expect(screen.getByTestId("save-documents-layout")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("save-documents-layout"));
    await waitFor(() => expect(brandingService.save).toHaveBeenCalledTimes(1));
    expect(brandingService.save.mock.calls[0][0]).toMatchObject({ documents: { footerText: "IC Licence No. {{licence}}" }, email: THEME.email, preset: THEME.preset });
  });
});

describe("Document Signatures", () => {
  it("lists the slots of the document chosen", async () => {
    mastersService.options.mockResolvedValue([{ id: "3", label: "Maria Santos" }]);
    brandingService.getSlots.mockResolvedValue({
      placeholder: "{{signature:slot}}",
      documentTypes: [{ key: "policy-schedule", label: "Policy schedule" }],
      sources: [{ key: "default-signatory", label: "The default signatory" }],
      conditions: [{ key: "issued", label: "Once the document is issued" }],
      slots: [{ id: 1, documentType: "policy-schedule", slot: "authorised", label: "Authorised signatory", source: "default-signatory", condition: "issued", active: true }],
    });
    render(<DocumentSignaturesPage />);
    expect(await screen.findByDisplayValue("Authorised signatory")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Document Signatures" })).toBeInTheDocument();
  });
});
