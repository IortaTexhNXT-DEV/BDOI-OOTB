import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import BrandPacks from "./BrandPacks";
import brandingService from "../../services/brandingService";

jest.mock("../../services/brandingService", () => ({
  __esModule: true,
  default: {
    bundledPacks: jest.fn(), checkBundledPack: jest.fn(), enableBundledPack: jest.fn(), resetDefaultBranding: jest.fn(),
    previewDocument: jest.fn(), previewEmail: jest.fn(), exportPack: jest.fn(), importPack: jest.fn(),
  },
}));

const THEME = { preset: "custom", name: "Toyota Insurance Services", colors: { primary: "#1a1a1a", accent: "#eb0a1e" }, email: { enabled: true } };
const PACK = {
  id: "toyota-insurance-services", name: "Toyota Insurance Services", version: "1.0.0", requiresWrittenPermission: true,
  description: "Client brand pack for the Toyota Insurance Services (Philippines) engagement.",
  trademarkOwner: "Toyota Motor Corporation and Toyota Insurance Services (Philippines)",
  permissionNote: "The Toyota name, the Toyota emblem and the Toyota Insurance Services logo are trademarks of their owners.",
  preview: { primary: "#1a1a1a", headerBg: "#ffffff", sidebarBg: "#ffffff", tableHeaderBg: "#eeeeee", buttonBg: "#1a1a1a", accent: "#eb0a1e" },
  theme: THEME, warnings: [], systemName: "Toyota Insurance Services", assets: ["logo", "documentLogo"], status: "available", enablement: null,
};
const ENABLEMENT = { id: 7, packId: PACK.id, packName: PACK.name, status: "enabled", acknowledgedPermission: true, enabledAt: "2026-10-04T08:15:00Z", enabledBy: "admin", enabledByName: "System Administrator", applied: ["theme", "logo", "documentLogo", "systemName"] };
const AVAILABLE = { packs: [PACK], current: null, defaultName: "iorta TechNXT (default)", defaultInForce: true, history: [] };
const ENABLED = { packs: [{ ...PACK, status: "enabled", enablement: ENABLEMENT }], current: ENABLEMENT, defaultName: "iorta TechNXT (default)", defaultInForce: false, history: [ENABLEMENT] };

const notify = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:sample");
});

describe("Bundled brand packs", () => {
  it("lists the packs shipped with the product as Available while the default branding is in force", async () => {
    brandingService.bundledPacks.mockResolvedValue(AVAILABLE);
    render(<BrandPacks notify={notify} />);
    expect(await screen.findByText("Toyota Insurance Services")).toBeInTheDocument();
    expect(screen.getByText("Bundled packs")).toBeInTheDocument();
    expect(screen.getByText("The iorta TechNXT default branding is in force.")).toBeInTheDocument();
    const card = screen.getByTestId("bundled-pack-toyota-insurance-services");
    expect(within(card).getByText("Available")).toBeInTheDocument();
    expect(within(card).getByText("Toyota Motor Corporation and Toyota Insurance Services (Philippines)")).toBeInTheDocument();
    expect(within(card).getByText("Client brand pack for the Toyota Insurance Services (Philippines) engagement.")).toBeInTheDocument();
    expect(within(within(card).getByLabelText("Toyota Insurance Services colours")).getAllByTitle(/^[a-zA-Z]+: #[0-9a-f]{6}$/)).toHaveLength(6);
    expect(within(card).getByRole("button", { name: "Enable" })).toBeInTheDocument();
    expect(screen.queryByText("Back to default")).not.toBeInTheDocument();
    // the export / import of the tab stay available below the bundled packs
    expect(screen.getByRole("button", { name: "Choose brand pack" })).toBeInTheDocument();
  });

  it("previews a pack with the sample document and the sample e-mail of its unsaved theme", async () => {
    brandingService.bundledPacks.mockResolvedValue(AVAILABLE);
    brandingService.previewDocument.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    brandingService.previewEmail.mockResolvedValue({ html: "<div data-bv-layout=\"1\">Dear Juan</div>" });
    render(<BrandPacks notify={notify} />);
    const card = await screen.findByTestId("bundled-pack-toyota-insurance-services");
    fireEvent.click(within(card).getByRole("button", { name: "Sample document" }));
    await waitFor(() => expect(brandingService.previewDocument).toHaveBeenCalledWith(THEME));
    await waitFor(() => expect(window.open).toHaveBeenCalledWith("blob:sample", "_blank", "noopener"));
    fireEvent.click(within(card).getByRole("button", { name: "Sample e-mail" }));
    await waitFor(() => expect(brandingService.previewEmail).toHaveBeenCalledWith(THEME));
    expect(await screen.findByTitle("bundled e-mail")).toBeInTheDocument();
  });

  it("enables a pack only after the administrator ticks the written permission acknowledgement", async () => {
    brandingService.bundledPacks.mockResolvedValueOnce(AVAILABLE).mockResolvedValueOnce(ENABLED);
    brandingService.checkBundledPack.mockResolvedValue({ name: "Toyota Insurance Services", dryRun: true, assets: ["logo", "documentLogo"], warnings: [], theme: THEME });
    brandingService.enableBundledPack.mockResolvedValue({ name: "Toyota Insurance Services", applied: ["theme", "logo", "documentLogo", "systemName"], enablement: ENABLEMENT });
    const onChanged = jest.fn();
    render(<BrandPacks notify={notify} onImported={onChanged} />);
    fireEvent.click(await screen.findByTestId("enable-toyota-insurance-services"));
    expect(await screen.findByText("Enable Toyota Insurance Services")).toBeInTheDocument();
    expect(screen.getByText(/trademarks of Toyota Motor Corporation and Toyota Insurance Services \(Philippines\)/)).toBeInTheDocument();
    // the pack is checked first (dry run), like an import
    expect(await screen.findByText("Toyota Insurance Services: valid. Contains: theme, logo, documentLogo")).toBeInTheDocument();
    expect(brandingService.checkBundledPack).toHaveBeenCalledWith("toyota-insurance-services");
    const confirmButton = screen.getByTestId("confirm-enable");
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(brandingService.enableBundledPack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("We hold the owner's written permission to use these marks"));
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
    fireEvent.click(confirmButton);
    await waitFor(() => expect(brandingService.enableBundledPack).toHaveBeenCalledWith("toyota-insurance-services", { acknowledgedPermission: true, applyDocumentLogo: true, applySystemName: true }));
    expect((await screen.findAllByText(/Enabled on .* by System Administrator/)).length).toBeGreaterThan(0);
    const card = screen.getByTestId("bundled-pack-toyota-insurance-services");
    expect(within(card).getByText(/^Enabled on \d{2}\/\d{2}\/2026 \d{2}:\d{2} by System Administrator$/)).toBeInTheDocument();
    expect(within(card).getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-default")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("success", expect.any(String), expect.stringContaining("Brand pack enabled"));
  });

  it("goes back to the iorta TechNXT default after a confirmation", async () => {
    brandingService.bundledPacks.mockResolvedValueOnce(ENABLED)
      .mockResolvedValueOnce({ ...AVAILABLE, history: [{ ...ENABLEMENT, status: "reverted", revertedAt: "2026-10-04T09:00:00Z", revertedBy: "admin" }] });
    brandingService.resetDefaultBranding.mockResolvedValue({ restored: ["theme", "logo", "favicon", "systemName", "documentLogo"] });
    render(<BrandPacks notify={notify} />);
    const card = await screen.findByTestId("bundled-pack-toyota-insurance-services");
    expect(within(card).getByText("Enabled")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("back-to-default"));
    expect(await screen.findByText(/Return to the iorta TechNXT default branding\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-reset"));
    await waitFor(() => expect(brandingService.resetDefaultBranding).toHaveBeenCalled());
    expect(await screen.findByText("The iorta TechNXT default branding is in force.")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });
});
