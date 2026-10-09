import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applyBranding, contrastRatio, loadFontStylesheet, mix, themeToCssVars } from "./themeEngine";
import { BOOT_KEY, BrandingProvider, useBranding, fetchBranding } from "./BrandingProvider";
import LoginArt, { loginPanelProps } from "./LoginArt";
import NewSideBar from "../../components/SideBar/NewSideBar";
const fs = require("fs");
const path = require("path");
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
  window.localStorage.clear();
});

describe("theme engine", () => {
  it("turns a theme into CSS custom properties, with the default theme for what it leaves out", () => {
    const vars = themeToCssVars(TIS, { fontStack: '"Inter", Arial, sans-serif' });
    expect(vars["--bv-primary"]).toBe("#1a1a1a");
    expect(vars["--bv-primary-rgb"]).toBe("26, 26, 26");
    expect(vars["--bv-table-header-bg"]).toBe("#eeeeee");
    expect(vars["--bv-table-header-rule"]).toBe("rgba(0, 0, 0, 0.08)");
    expect(vars["--bv-sidebar-marker"]).toBe("#eb0a1e");
    expect(vars["--bv-marker"]).toBe("#eb0a1e");
    expect(vars["--bv-sidebar-sub-text"]).toBe("#353535");
    expect(vars["--bv-radius-button"]).toBe("4px");
    expect(vars["--bv-row-height"]).toBe("36px");
    expect(vars["--bv-font-family"]).toBe('"Inter", Arial, sans-serif');
    expect(vars["--bv-primary-dark"]).toBe("#000000");
    const def = themeToCssVars({});
    expect(def["--bv-primary"]).toBe("#0072d8");
    expect(def["--bv-sidebar-marker"]).toBe("#0072d8");
    expect(def["--bv-sidebar-sub-text"]).toBe("#4b4b4b");
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
  it("keeps what the first paint needs, and public/branding-boot.js applies it before the application loads", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { systemName: "Toyota Insurance Services", faviconUrl: "/api/branding/assets/favicon?v=1", version: "v2", theme: TIS } }) }));
    const store = configureStore({ reducer: { systemSettingsReducer: (s = {}) => s } });
    const Ready = () => <span data-testid="ready">{String(useBranding().ready)}</span>;
    render(<Provider store={store}><MemoryRouter><BrandingProvider><Ready /></BrandingProvider></MemoryRouter></Provider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(BOOT_KEY))?.faviconUrl).toBeTruthy());
    const saved = JSON.parse(window.localStorage.getItem(BOOT_KEY));
    expect(saved).toMatchObject({ faviconUrl: "/api/branding/assets/favicon?v=1", title: "Toyota Insurance Services - Login", attrs: { "data-bv-theme": "custom" } });
    expect(saved.vars).toMatchObject({ "--bv-button-bg": "#1a1a1a", "--bv-alt-primary": "#1a1a1a" });

    // a new page of this browser: the copy is applied before anything else
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-bv-theme");
    document.title = "Sign in";
    document.head.innerHTML = "";
    const icon = Object.assign(document.createElement("link"), { rel: "icon", href: "/favicon.ico" });
    const themeColor = Object.assign(document.createElement("meta"), { name: "theme-color", content: "#000000" });
    document.head.append(icon, themeColor);
    // eslint-disable-next-line no-new-func
    new Function(fs.readFileSync(path.join(__dirname, "../../../public/branding-boot.js"), "utf8"))();
    expect(document.documentElement.style.getPropertyValue("--bv-button-bg")).toBe("#1a1a1a");
    expect(document.documentElement.getAttribute("data-bv-theme")).toBe("custom");
    expect(document.title).toBe("Toyota Insurance Services - Login");
    expect(icon.getAttribute("href")).toBe("/api/branding/assets/favicon?v=1");
    expect(themeColor.getAttribute("content")).toBe("#ffffff");

    // a copy that is not one (another script, a broken value) changes nothing
    document.documentElement.removeAttribute("style");
    window.localStorage.setItem(BOOT_KEY, JSON.stringify({ vars: { color: "red", "--bv-primary": "url(data:x)" }, faviconUrl: "data:image/png;base64,x" }));
    // eslint-disable-next-line no-new-func
    new Function(fs.readFileSync(path.join(__dirname, "../../../public/branding-boot.js"), "utf8"))();
    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(icon.getAttribute("href")).toBe("/api/branding/assets/favicon?v=1");
  });
  it("shows a neutral page, never the default look, until the branding is known; the kept branding is used at once on the next load", async () => {
    let answer;
    global.fetch = jest.fn(() => new Promise((resolve) => { answer = resolve; }));
    const store = configureStore({ reducer: { systemSettingsReducer: (s = {}) => s } });
    const Probe = () => <span data-testid="name">{useBranding().branding?.systemName}</span>;
    const view = render(<Provider store={store}><MemoryRouter><BrandingProvider><Probe /></BrandingProvider></MemoryRouter></Provider>);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId("name")).toBeNull();
    answer({ ok: true, json: async () => ({ success: true, data: { systemName: "Toyota Insurance Services", logoUrl: "/api/branding/assets/logo?v=1", version: "v5", theme: TIS } }) });
    expect((await screen.findByTestId("name")).textContent).toBe("Toyota Insurance Services");
    view.unmount();

    // the next load: the kept branding at once, while the API has not answered yet
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<Provider store={store}><MemoryRouter><BrandingProvider><Probe /></BrandingProvider></MemoryRouter></Provider>);
    expect(screen.getByTestId("name").textContent).toBe("Toyota Insurance Services");
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("returns null when the API is down (the compiled look stays)", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchBranding()).toBeNull();
  });
});

describe("sign-in picture", () => {
  it("shows a library picture over the gradient, an uploaded picture at its focal point, or colour only", () => {
    expect(loginPanelProps({ login: { panel: "library", libraryUrl: "/brand/library/motor.svg" } }).src).toBe("/brand/library/motor.svg");
    const img = loginPanelProps({ login: { panel: "image", panelImageUrl: "/api/branding/assets/login-panel?v=1", focalX: 20, focalY: 80 } });
    expect(img).toMatchObject({ src: "/api/branding/assets/login-panel?v=1", objectPosition: "20% 80%" });
    expect(loginPanelProps({ login: { panel: "color", colorFrom: "#111111", colorTo: "#222222" } })).toMatchObject({ src: null, background: "linear-gradient(135deg, #111111 0%, #222222 100%)" });
    render(<LoginArt theme={TIS} />);
    expect(screen.getByTestId("login-art-image").getAttribute("src")).toBe("/brand/library/motor.svg");
    expect(screen.getByTestId("login-art-overlay").style.background).toBe("rgba(0, 0, 0, 0.2)");
  });
});

describe("side bar brand", () => {
  const renderSideBar = (branding, settings = { loaded: true, systemName: "BrokerVerse", logoUrl: "/bdoi/iorta-technxt.png" }) => {
    global.fetch = jest.fn(async () => (branding ? { ok: true, json: async () => ({ success: true, data: branding }) } : { ok: false, json: async () => ({}) }));
    const store = configureStore({ reducer: { systemSettingsReducer: (s = settings) => s } });
    return render(<Provider store={store}><MemoryRouter><BrandingProvider><NewSideBar /></BrandingProvider></MemoryRouter></Provider>);
  };

  it("shows the logo of the branding and leaves out the name the logo already carries", async () => {
    renderSideBar({ systemName: "Toyota Insurance Services", logoUrl: "/api/branding/assets/logo?v=1", version: "v3", theme: { ...TIS, logo: { ...TIS.logo, showName: false } } });
    expect((await screen.findByAltText("Toyota Insurance Services logo")).getAttribute("src")).toBe("/api/branding/assets/logo?v=1");
    expect(screen.queryByText("Toyota Insurance Services")).toBeNull();
    expect(screen.queryByText("BrokerVerse")).toBeNull();
  });

  it("shows the application name under the logo when the theme asks for it", async () => {
    renderSideBar({ systemName: "Acme Brokers", logoUrl: "/api/branding/assets/logo?v=2", version: "v4", theme: { ...TIS, logo: { ...TIS.logo, showName: true } } });
    expect(await screen.findByText("Acme Brokers")).toBeTruthy();
  });

  it("shows no default logo or name before the branding or the settings have loaded", () => {
    global.fetch = jest.fn(() => new Promise(() => {}));
    const store = configureStore({ reducer: { systemSettingsReducer: (s = { loaded: false, systemName: "BrokerVerse", logoUrl: "/bdoi/iorta-technxt.png" }) => s } });
    render(<Provider store={store}><MemoryRouter><BrandingProvider><NewSideBar /></BrandingProvider></MemoryRouter></Provider>);
    expect(screen.queryByAltText(/logo$/)).toBeNull();
    expect(screen.queryByText("BrokerVerse")).toBeNull();
  });
});
