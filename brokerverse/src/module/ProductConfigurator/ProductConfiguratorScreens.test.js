import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "../../i18n";
import store from "../../redux/store";
import productConfiguratorService from "../../services/productConfiguratorService";
import mastersService from "../../services/mastersService";
import { UnderwritingRules, DocumentManager } from "./ProductConfiguratorScreens";

jest.mock("../../services/productConfiguratorService", () => ({
  __esModule: true,
  default: {
    listComponents: jest.fn(),
    getProductTemplates: jest.fn(),
    getUnderwritingOptions: jest.fn(),
    getMergeFields: jest.fn(),
    getComponentHistory: jest.fn(),
    updateComponent: jest.fn(),
    saveComponent: jest.fn(),
    previewDocument: jest.fn(),
    downloadLayout: jest.fn(),
  },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn(), list: jest.fn() } }));

const rule = (i, extra = {}) => ({
  id: i, ruleCode: `R${i}`, ruleName: `Rule ${i}`, type: "Acceptance", field: "vehicleAge", operator: "<=", value: 15, action: "Auto-Accept", authorityRole: "processing",
  status: "Active", templateCode: "MOT-003-2025", templateName: "Motor Insurance Basic Plan", productMasterCode: "MOTOR", productMasterName: "Motor Vehicle Insurance", ...extra,
});

const renderScreen = (ui) => render(<MemoryRouter><Provider store={store}>{ui}</Provider></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  productConfiguratorService.getProductTemplates.mockResolvedValue([{ id: 1, templateCode: "MOT-003-2025", name: "Motor Insurance Basic Plan", status: "Active", productCode: "MOTOR" }]);
  productConfiguratorService.getUnderwritingOptions.mockResolvedValue({
    fields: [{ value: "vehicleAge", label: "Vehicle age (years)", type: "number" }, { value: "vehicleUse", label: "Vehicle use", type: "text", options: ["Private", "PUV"] }],
    roles: [{ value: "processing", label: "Processing Team (Placement & Policy Processing)" }],
    operators: ["<=", "<", ">=", ">", "=", "!="],
  });
  productConfiguratorService.getMergeFields.mockResolvedValue({ fields: [{ name: "PolicyNumber", label: "Policy number" }], blocks: [{ name: "Premium", label: "Premium breakdown" }], extensions: [".txt", ".md"], defaults: {} });
  mastersService.options.mockImplementation((type) => Promise.resolve(type === "insurance-company" ? [{ id: 2, label: "Malayan Insurance Co., Inc.", code: "MALAYAN" }] : [{ code: "MOTOR", label: "Motor", value: "MOTOR" }]));
});

describe("Acceptance Rules screen", () => {
  it("has one title with the Product Configurator breadcrumb, and no duplicated card titles", async () => {
    productConfiguratorService.listComponents.mockResolvedValue([rule(1)]);
    renderScreen(<UnderwritingRules />);
    expect(screen.getByRole("heading", { level: 1, name: "Acceptance Rules" })).toBeInTheDocument();
    const crumbs = screen.getByLabelText("Breadcrumb");
    expect(within(crumbs).getByText("Product Configurator")).toBeInTheDocument();
    expect(within(crumbs).getByText("Acceptance Rules")).toBeInTheDocument();
    await screen.findByText("R1");
    expect(screen.queryByText(/Insurer Acceptance Rules/)).not.toBeInTheDocument();
    expect(screen.queryByText(/insurer underwriting guidelines\)/)).not.toBeInTheDocument();
  });

  it("shows the insurer, product with code, the outcome and the authority role; actions have names", async () => {
    productConfiguratorService.listComponents.mockResolvedValue([rule(1), rule(2, { action: "Decline", authorityRole: null, insurerId: 2, insurerName: "Malayan Insurance Co., Inc.", field: "vehicleUse", operator: "=", value: "PUV" })]);
    renderScreen(<UnderwritingRules />);
    await screen.findByText("R2");
    expect(screen.getByText("All insurers")).toBeInTheDocument();
    expect(screen.getAllByText("Malayan Insurance Co., Inc.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MOTOR · Motor Vehicle Insurance")).toHaveLength(2);
    expect(await screen.findByText("Processing Team (Placement & Policy Processing)")).toBeInTheDocument();
    expect(screen.getByText("No referral")).toBeInTheDocument();
    expect(screen.getByText("Vehicle use = PUV")).toBeInTheDocument();
    expect(screen.getByText("Accept; otherwise refer")).toBeInTheDocument();
    for (const name of ["View", "Edit", "Deactivate", "History"]) expect(screen.getAllByRole("button", { name })).toHaveLength(2);
  });

  it("pages only when there is more than one page", async () => {
    productConfiguratorService.listComponents.mockResolvedValue(Array.from({ length: 5 }, (_, i) => rule(i + 1)));
    const { unmount } = renderScreen(<UnderwritingRules />);
    await screen.findByText("R5");
    expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
    unmount();
    productConfiguratorService.listComponents.mockResolvedValue(Array.from({ length: 25 }, (_, i) => rule(i + 1)));
    renderScreen(<UnderwritingRules />);
    await screen.findByText("R1");
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    expect(screen.queryByText("R21")).not.toBeInTheDocument();
  });

  it("filters by insurer and status through the API", async () => {
    productConfiguratorService.listComponents.mockResolvedValue([rule(1)]);
    renderScreen(<UnderwritingRules />);
    await screen.findByText("R1");
    expect(productConfiguratorService.listComponents).toHaveBeenLastCalledWith("underwriting-rules", {});
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "PUV" } });
    await waitFor(() => expect(productConfiguratorService.listComponents).toHaveBeenLastCalledWith("underwriting-rules", { search: "PUV" }));
  });

  it("deactivates a rule with its status only, once confirmed", async () => {
    productConfiguratorService.listComponents.mockResolvedValue([rule(1)]);
    productConfiguratorService.updateComponent.mockResolvedValue({});
    renderScreen(<UnderwritingRules />);
    await screen.findByText("R1");
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("R1")).toBeInTheDocument();
    expect(productConfiguratorService.updateComponent).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(productConfiguratorService.updateComponent).toHaveBeenCalledWith("underwriting-rules", 1, { status: "Inactive" }));
  });
});

describe("Document Manager screen", () => {
  it("shows what each template is printed as and whether a layout was uploaded, with preview and download", async () => {
    productConfiguratorService.listComponents.mockResolvedValue([
      { id: 7, documentCode: "MOTOR_SCHED", documentName: "Motor Policy Schedule", printAs: "policy-schedule", stage: "Policy Issuance", status: "Active", hasLayout: true, layoutFileName: "schedule.txt", templateCode: "MOT-003-2025", templateName: "Motor Insurance Basic Plan" },
      { id: 8, documentCode: "CTPL_CERT", documentName: "CTPL Certificate", printAs: "ctpl-certificate", stage: "Policy Issuance", status: "Active", hasLayout: false, templateCode: "MOT-003-2025", templateName: "Motor Insurance Basic Plan" },
    ]);
    productConfiguratorService.previewDocument.mockResolvedValue();
    renderScreen(<DocumentManager />);
    expect(screen.getByRole("heading", { level: 1, name: "Document Manager" })).toBeInTheDocument();
    await screen.findByText("MOTOR_SCHED");
    expect(screen.queryByText("Document Template Manager")).not.toBeInTheDocument();
    expect(screen.getByText("Policy schedule")).toBeInTheDocument();
    expect(screen.getByText("Uploaded schedule.txt")).toBeInTheDocument();
    expect(screen.getByText("Standard layout")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);
    await waitFor(() => expect(productConfiguratorService.previewDocument).toHaveBeenCalledWith(7));
    fireEvent.click(screen.getAllByRole("button", { name: "Download" })[1]);
    await waitFor(() => expect(productConfiguratorService.downloadLayout).toHaveBeenCalledWith(8, "CTPL_CERT-layout.txt"));
  });
});
