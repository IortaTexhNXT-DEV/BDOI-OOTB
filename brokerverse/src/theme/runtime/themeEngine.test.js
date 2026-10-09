import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applyBranding, contrastRatio, loadFontStylesheet, mix, themeToCssVars } from "./themeEngine";
import { BrandingProvider, useBranding, fetchBranding } from "./BrandingProvider";
import LoginArt, { loginPanelProps } from "./LoginArt";
import ThemePreview from "../../module/ThemeBranding/ThemePreview";
const postcssBrandVars = require("../../../scripts/postcss-brand-vars");

const TIS = {
  preset: "custom",
  colors: { primary: "#1a1a1a", primaryDark: "#000000", headerBg: "#ffffff", headerText: "#1a1a1a", sidebarBg: "#ffffff", sidebarText: "#1a1a1a", accent: "#eb0a1e",
    tableHeaderBg: "#eeeeee", tableHeaderText: "#1a1a1a", buttonBg: "#1a1a1a", buttonText: "#ffffff", link: "#b40514", focusRing: "#eb0a1e" },
  layout: { density: "compact", headerStyle: "light", sidebarStyle: "light" },
  radius: { sm: 4, md: 8, lg: 12, button: 4 },
  logo: { appHeight: 40, loginHeight: 64 },
  login: { panel: "library", libraryUrl: "/brand/library/motor.svg", colorFrom: "#2b2b2b", colorTo: "#0d0d0d", overlay: 20, headline: "Welcome", tagline: "Hello" },
  documents: { accentColor: "#eb0a1e", tableHeaderBg: "#1a1a1a", footerText: "Licence No. {{licence}}" },
};

afterEach(() => {
  document.documentElement.removeAttribute("style");
  ["data-bv-density", "data-bv-theme", "data-bv-header", "data-bv-sidebar"].forEach((a) => document.documentElement.removeAttribute(a));
  loadFontStylesheet(null);
  delete global.fetch;
});

describe("theme engine", () => {
  it("turns a theme into CSS custom properties, with the default theme for what it leaves out", () => {
    const vars = themeToCssVars(TIS, { fontStack: '"Inter", Arial, sans-serif' });
    expect(vars["--bv-primary"]).toBe("#1a1a1a");
    expect(vars["--bv-primary-rgb"]).toBe("26, 26, 26");
    expect(vars["--bv-table-header-bg"]).toBe("#eeeeee");
    expect(vars["--bv-table-header-rule"]).toBe("rgba(0, 0, 0, 0.08)");
    expect(vars["--bv-sidebar-marker"]).toBe("#eb0a1e");
    expect(vars["--bv-radius-button"]).toBe("4px");
    expect(vars["--bv-row-height"]).toBe("36px");
    expect(vars["--bv-font-family"]).toBe('"Inter", Arial, sans-serif');
    expect(vars["--bv-primary-dark"]).toBe("#000000");
    const def = themeToCssVars({});
    expect(def["--bv-primary"]).toBe("#0072d8");
    expect(def["--bv-sidebar-marker"]).toBe("transparent");
    expect(def["--bv-row-height"]).toBe("44px");
    expect(def["--bv-table-stripe"]).toBe("#f5faff");
  });

  it("sets the variables and layout attributes on <html> and loads only Google Fonts", () => {
    applyBranding({ theme: TIS, fontStack: '"Inter", Arial, sans-serif', fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--bv-primary")).toBe("#1a1a1a");
    expect(root.style.getPropertyValue("--bv-header-bg")).toBe("#ffffff");
    expect(root.getAttribute("data-bv-density")).toBe("compact");
    expect(root.getAttribute("data-bv-theme")).toBe("custom");
    expect(root.style.getPropertyValue("--bv-alt-primary")).toBe("#1a1a1a");
    expect(document.head.innerHTML).toContain('id="bv-theme-font"');
    expect(document.head.innerHTML).toContain("https://fonts.googleapis.com/css2?family=Inter");
    expect(loadFontStylesheet("https://evil.example.com/font.css")).toBe(false);
    expect(document.head.innerHTML).not.toContain("bv-theme-font");
    applyBranding({ theme: {} });
    expect(root.style.getPropertyValue("--bv-alt-primary")).toBe("");
  });

  it("computes WCAG contrast and colour mixes", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBe(21);
    expect(contrastRatio("#ffffff", "#0072d8")).toBeGreaterThanOrEqual(4.5);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("the build plugin turns literal brand colours into theme variables with the same fallback", () => {
    expect(postcssBrandVars.themeValue("1px solid #0072D8")).toBe("1px solid var(--bv-primary, #0072d8)");
    expect(postcssBrandVars.themeValue("0 0 0 3px rgba(0, 114, 216, 0.35)")).toBe("0 0 0 3px rgba(var(--bv-primary-rgb, 0, 114, 216), 0.35)");
    expect(postcssBrandVars.themeValue("var(--bv-primary, #0072d8)")).toBe("var(--bv-primary, #0072d8)");
    expect(postcssBrandVars.themeValue("#0072d8aa")).toBe("#0072d8aa");
    expect(postcssBrandVars.themeValue("linear-gradient(135deg, #001e60 0%, #0066cc 100%)")).toBe("linear-gradient(135deg, var(--bv-alt-secondary, #001e60) 0%, var(--bv-alt-primary, #0066cc) 100%)");
    expect(postcssBrandVars.themeValue("#00c851")).toBe("#00c851");
    expect(postcssBrandVars.themeValue("#3b82f6")).toBe("#3b82f6");
  });

  it("the build plugin makes the default font follow the theme's font", () => {
    expect(postcssBrandVars.themeFont('"Nunito", Arial, sans-serif')).toBe('var(--bv-font-family, "Nunito", Arial, sans-serif)');
    expect(postcssBrandVars.themeFont("Nunito")).toBe("var(--bv-font-family, Nunito)");
    expect(postcssBrandVars.themeFont('var(--bv-font-family, "Nunito", Arial, sans-serif)')).toBe('var(--bv-font-family, "Nunito", Arial, sans-serif)');
    expect(postcssBrandVars.themeFont("ui-monospace, Menlo, monospace")).toBe("ui-monospace, Menlo, monospace");
    expect(postcssBrandVars.themeFont("NunitoSans, Arial")).toBe("NunitoSans, Arial");
  });
});

describe("branding provider", () => {
  const Probe = () => {
    const { branding } = useBranding();
    return <span data-testid="name">{branding?.systemName || "none"}</span>;
  };
  it("loads GET /api/branding before sign-in and applies it", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { systemName: "Toyota Insurance Services", version: "v1", theme: TIS } }) }));
    const store = configureStore({ reducer: { systemSettingsReducer: (s = {}) => s } });
    render(<Provider store={store}><MemoryRouter><BrandingProvider><Probe /></BrandingProvider></MemoryRouter></Provider>);
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("Toyota Insurance Services"));
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/branding$/);
    expect(global.fetch.mock.calls[0][1]).toMatchObject({ cache: "no-cache" });
    expect(document.documentElement.style.getPropertyValue("--bv-button-bg")).toBe("#1a1a1a");
  });
  it("returns null when the API is down (the compiled look stays)", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchBranding()).toBeNull();
  });
});

describe("sign-in picture and live preview", () => {
  it("shows a library picture over the gradient, an uploaded picture at its focal point, or colour only", () => {
    expect(loginPanelProps({ login: { panel: "library", libraryUrl: "/brand/library/motor.svg" } }).src).toBe("/brand/library/motor.svg");
    const img = loginPanelProps({ login: { panel: "image", panelImageUrl: "/api/branding/assets/login-panel?v=1", focalX: 20, focalY: 80 } });
    expect(img).toMatchObject({ src: "/api/branding/assets/login-panel?v=1", objectPosition: "20% 80%" });
    expect(loginPanelProps({ login: { panel: "color", colorFrom: "#111111", colorTo: "#222222" } })).toMatchObject({ src: null, background: "linear-gradient(135deg, #111111 0%, #222222 100%)" });
    render(<LoginArt theme={TIS} />);
    expect(screen.getByTestId("login-art-image").getAttribute("src")).toBe("/brand/library/motor.svg");
    expect(screen.getByTestId("login-art-overlay").style.background).toBe("rgba(0, 0, 0, 0.2)");
  });

  it("previews the draft theme on its own box: header, side bar, table, buttons, document header and sign-in page", () => {
    render(<ThemePreview theme={TIS} fontStack="Arial" logoUrl="/logo.png" systemName="TIS" companyName="Toyota Insurance Services" t={(k, d) => d} />);
    const box = screen.getByTestId("theme-preview");
    expect(box.style.getPropertyValue("--bv-header-bg")).toBe("#ffffff");
    expect(box.style.getPropertyValue("--bv-table-header-bg")).toBe("#eeeeee");
    expect(document.documentElement.style.getPropertyValue("--bv-header-bg")).toBe("");
    expect(screen.getByText("Policy Schedule")).toBeTruthy();
    expect(screen.getByText("Licence No. 0000")).toBeTruthy();
    expect(screen.getByText("Welcome")).toBeTruthy();
  });
});
