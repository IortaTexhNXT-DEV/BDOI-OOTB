/**
 * Master > System Settings > Theme and Branding: everything a broker's branding is made of, as data — theme preset and
 * colours, layout (header and side bar style, density, table header style, corner radius, font), sign-in page (picture,
 * headline, tagline), documents and reports, e-mail, application name and images, document signatures, and brand
 * packs (export / import). Live preview and WCAG AA contrast check; Save applies to every signed-in user on their next
 * navigation (GET /api/branding), documents, reports and e-mails at once.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { InputNumber } from "primereact/inputnumber";
import { ColorPicker } from "primereact/colorpicker";
import { Slider } from "primereact/slider";
import { RadioButton } from "primereact/radiobutton";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import { Tag } from "primereact/tag";
import brandingService from "../../services/brandingService";
import { notifyBrandingUpdated } from "../../theme/runtime/BrandingProvider";
import { contrastRatio, isHex } from "../../theme/runtime/themeEngine";
import LoginArt from "../../theme/runtime/LoginArt";
import ThemePreview from "./ThemePreview";
import SignatureSlots from "./SignatureSlots";
import BrandPacks from "./BrandPacks";
import "./index.scss";

const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const COLOR_GROUPS = [
  ["brand", "Brand", [["primary", "Primary"], ["primaryDark", "Primary (hover / pressed)"], ["primaryText", "Text on primary"], ["primaryLight", "Light tint (highlights, active rows)"], ["secondary", "Secondary"], ["accent", "Accent (active tab, marker)"]]],
  ["header", "Header", [["headerBg", "Header background"], ["headerText", "Header text"]]],
  ["sidebar", "Side bar", [["sidebarBg", "Side bar background"], ["sidebarText", "Side bar text"], ["sidebarActiveBg", "Active item background"], ["sidebarActiveText", "Active item text"]]],
  ["tables", "Tables", [["tableHeaderBg", "Table header background"], ["tableHeaderText", "Table header text"]]],
  ["buttons", "Buttons, links and fields", [["buttonBg", "Button"], ["buttonText", "Button text"], ["buttonHoverBg", "Button hover"], ["link", "Links"], ["focusRing", "Focus ring"], ["fieldBorder", "Field border"]]],
  ["page", "Page", [["pageBg", "Page background"], ["headingText", "Page headings"]]],
];

/** One colour: picker + hex field + contrast badge against `against` (optional). */
const ColorField = ({ id, label, value, onChange, against, allowEmpty, emptyLabel }) => {
  const [text, setText] = useState(value || "");
  useEffect(() => setText(value || ""), [value]);
  const ratio = against && isHex(value) && isHex(against) ? contrastRatio(value, against) : null;
  return (
    <div className="bv-tb__color">
      <label htmlFor={id}>{label}</label>
      <div className="bv-tb__color-row">
        <ColorPicker value={(isHex(value) ? value : "#ffffff").replace("#", "")} onChange={(e) => onChange(`#${e.value}`)} aria-label={label} />
        <InputText id={id} value={text} placeholder={allowEmpty ? emptyLabel : "#000000"} maxLength={7}
          onChange={(e) => { const v = e.target.value.trim(); setText(v); if (isHex(v) || (allowEmpty && v === "")) onChange(v.toLowerCase()); }} />
        {ratio !== null && <Tag severity={ratio >= 4.5 ? "success" : "danger"} value={`${ratio}:1`} title="WCAG contrast" />}
      </div>
    </div>
  );
};

const Section = ({ title, onReset, resetLabel, children }) => (
  <section className="bv-tb__section">
    <div className="bv-tb__section-head">
      <h3>{title}</h3>
      {onReset && <Button type="button" label={resetLabel} icon="pi pi-refresh" className="p-button-text p-button-sm" onClick={onReset} />}
    </div>
    {children}
  </section>
);

const ThemeBrandingPage = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [editor, setEditor] = useState(null);
  // the open tab; the Brand packs tab is the last of seven and can sit past the edge of a narrow screen
  const [tabIndex, setTabIndex] = useState(0);
  const PACKS_TAB = 6;
  const [theme, setTheme] = useState(null);
  const [systemName, setSystemName] = useState("");
  const [check, setCheck] = useState({ errors: [], warnings: [], checks: [] });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const fileRefs = { logo: useRef(null), favicon: useRef(null), "login-panel": useRef(null) };

  const notify = (severity, summary, detail) => toast.current?.show({ severity, summary, detail, life: severity === "error" ? 6000 : 3000 });
  const load = useCallback(async () => {
    try {
      const data = await brandingService.getEditor();
      setEditor(data);
      setTheme(clone(data.theme));
      setSystemName(data.systemName || "");
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  // contrast and validation of the draft, on the server (same rules as Save)
  useEffect(() => {
    if (!theme) return undefined;
    const timer = setTimeout(() => {
      brandingService.validate(theme).then((r) => setCheck({ errors: r.errors || [], warnings: r.warnings || [], checks: r.checks || [] })).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [theme]);

  const presetOf = (key) => editor?.presets?.find((p) => p.key === key)?.theme;
  const baseTheme = useMemo(() => presetOf(theme?.preset === "custom" ? "iorta-technxt" : theme?.preset) || presetOf("iorta-technxt"), [editor, theme?.preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (section, key, value) => setTheme((prev) => ({ ...prev, preset: prev.preset === "custom" || section === "name" ? prev.preset : "custom", [section]: { ...prev[section], [key]: value } }));
  const setColors = (values) => setTheme((prev) => ({ ...prev, preset: "custom", colors: { ...prev.colors, ...values } }));
  const resetSection = (section) => setTheme((prev) => ({ ...prev, [section]: clone(baseTheme?.[section]) }));
  const applyPreset = (key) => { const p = presetOf(key); if (p) setTheme({ ...clone(p), login: { ...clone(p.login), panelImageUrl: theme?.login?.panelImageUrl || "" } }); };

  const libraryUrl = (key) => editor?.loginLibrary?.find((l) => l.key === key)?.file || "/brand/login-panel.svg";
  const previewTheme = theme ? { ...theme, login: { ...theme.login, libraryUrl: libraryUrl(theme.login?.library), panelImageUrl: theme.login?.panel === "image" ? editor?.loginPanelUrl || theme.login?.panelImageUrl : "" } } : null;
  const fontStack = editor?.fonts?.find((f) => f.key === theme?.font)?.stack;

  const save = async () => {
    setSaving(true);
    try {
      const data = await brandingService.save(theme, systemName);
      setEditor(data);
      setTheme(clone(data.theme));
      notifyBrandingUpdated();
      notify("success", t("common.success", "Success"), t("themeBranding.saved", "Theme saved. Every signed-in user gets it on their next page; documents, reports and e-mails use it from now on."));
      if (data.warnings?.length) notify("warn", t("themeBranding.contrastWarnings", "Contrast warnings"), data.warnings.map((w) => w.message).join("; "));
    } catch (e) {
      notify("error", t("themeBranding.notSaved", "Theme not saved"), [e.message, ...(e.errors || []).map((x) => `${x.path}: ${x.message}`)].join(" | "));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (asset, file) => {
    if (!file) return;
    setBusy(asset);
    try {
      const data = await brandingService.uploadImage(asset, file);
      setEditor(data);
      if (asset === "login-panel") setTheme((prev) => ({ ...prev, login: { ...data.theme.login } }));
      notifyBrandingUpdated();
      notify("success", t("common.success", "Success"), t("themeBranding.uploaded", "Image uploaded"));
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const resetImage = async (asset) => {
    setBusy(asset);
    try {
      const data = await brandingService.resetImage(asset);
      setEditor(data);
      if (asset === "login-panel") setTheme((prev) => ({ ...prev, login: { ...data.theme.login } }));
      notifyBrandingUpdated();
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const openSample = async () => {
    setBusy("sample");
    try {
      const pdf = await brandingService.previewDocument(theme);
      window.open(URL.createObjectURL(pdf), "_blank", "noopener");
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const loadEmail = async () => {
    try {
      setEmailHtml((await brandingService.previewEmail(theme)).html);
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    }
  };

  if (!theme || !editor) {
    return <div className="bv-tb"><Toast ref={toast} /><p>{t("common.loading", "Loading...")}</p></div>;
  }
  const c = theme.colors || {};
  const blocking = check.errors || [];
  const reset = t("themeBranding.resetSection", "Reset to default");
  const fileInput = (asset, accept) => (
    <input ref={fileRefs[asset]} type="file" accept={accept} hidden onChange={(e) => { upload(asset, e.target.files?.[0]); e.target.value = ""; }} data-testid={`file-${asset}`} />
  );

  return (
    <div className="bv-tb">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: t("systemSettings.title", "System Settings"), url: "/master/configuration/system-settings" }, { label: t("themeBranding.title", "Theme and Branding") }]}
        home={{ label: t("systemSettings.masters", "Master") }} />
      <div className="bv-tb__top">
        <div>
          <h1 className="page-title">{t("themeBranding.title", "Theme and Branding")}</h1>
          <p className="bv-tb__lead">{t("themeBranding.lead", "The look of the screens, the sign-in page, printed documents, reports and e-mails of this broker. Changes apply to every user without a new release.")}</p>
        </div>
        <div className="bv-tb__actions">
          <Button label={t("themeBranding.tabs.packs", "Brand packs")} icon="pi pi-box" className="p-button-outlined" onClick={() => setTabIndex(PACKS_TAB)} data-testid="open-brand-packs" />
          <Button label={t("themeBranding.sampleDocument", "Sample document")} icon="pi pi-file-pdf" className="p-button-outlined" onClick={openSample} loading={busy === "sample"} />
          <Button label={t("themeBranding.discard", "Discard changes")} icon="pi pi-undo" className="p-button-text" onClick={() => { setTheme(clone(editor.theme)); setSystemName(editor.systemName || ""); }} />
          <Button label={t("common.save", "Save")} icon="pi pi-check" onClick={save} loading={saving} disabled={blocking.length > 0} data-testid="save-theme" />
        </div>
      </div>
      {blocking.length > 0 && (
        <Message severity="error" className="bv-tb__msg" text={`${t("themeBranding.cannotSave", "Cannot save")}: ${blocking.map((e) => e.message).join("; ")}`} />
      )}

      <div className="bv-tb__layout">
        <div className="bv-tb__editor">
          <TabView scrollable activeIndex={tabIndex} onTabChange={(e) => setTabIndex(e.index)}>
            <TabPanel header={t("themeBranding.tabs.theme", "Theme")}>
              <Section title={t("themeBranding.presets", "Presets")}>
                <div className="bv-tb__presets">
                  {editor.presets.map((p) => (
                    <button key={p.key} type="button" className={`bv-tb__preset${theme.preset === p.key ? " is-active" : ""}`} onClick={() => applyPreset(p.key)} data-testid={`preset-${p.key}`}>
                      <span className="bv-tb__swatches">
                        {[p.theme.colors.primary, p.theme.colors.headerBg, p.theme.colors.sidebarBg, p.theme.colors.tableHeaderBg, p.theme.colors.accent].map((col, i) => <i key={i} style={{ background: col }} />)}
                      </span>
                      {p.name}
                    </button>
                  ))}
                  <span className={`bv-tb__preset bv-tb__preset--custom${theme.preset === "custom" ? " is-active" : ""}`}>{t("themeBranding.custom", "Custom")}</span>
                </div>
                <div className="bv-tb__field">
                  <label htmlFor="theme-name">{t("themeBranding.themeName", "Theme name")}</label>
                  <InputText id="theme-name" value={theme.name || ""} maxLength={80} onChange={(e) => setTheme((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
              </Section>

              <Section title={t("themeBranding.layout", "Layout")} onReset={() => { resetSection("layout"); resetSection("radius"); }} resetLabel={reset}>
                <div className="bv-tb__grid">
                  <div className="bv-tb__field">
                    <label>{t("themeBranding.headerStyle", "Header style")}</label>
                    <Dropdown value={theme.layout?.headerStyle} options={[{ label: t("themeBranding.light", "White"), value: "light" }, { label: t("themeBranding.coloured", "Coloured (secondary colour)"), value: "brand" }]}
                      onChange={(e) => { set("layout", "headerStyle", e.value); setColors(e.value === "brand" ? { headerBg: c.secondary, headerText: "#ffffff" } : { headerBg: "#ffffff", headerText: baseTheme.colors.headerText }); }} />
                  </div>
                  <div className="bv-tb__field">
                    <label>{t("themeBranding.sidebarStyle", "Side bar style")}</label>
                    <Dropdown value={theme.layout?.sidebarStyle} options={[{ label: t("themeBranding.light", "White"), value: "light" }, { label: t("themeBranding.dark", "Dark"), value: "dark" }]}
                      onChange={(e) => { set("layout", "sidebarStyle", e.value); setColors(e.value === "dark" ? { sidebarBg: "#1f2937", sidebarText: "#e5e7eb", sidebarActiveBg: "#374151", sidebarActiveText: "#ffffff" } : { sidebarBg: "#ffffff", sidebarText: c.secondary, sidebarActiveBg: c.primaryLight, sidebarActiveText: c.secondary }); }} />
                  </div>
                  <div className="bv-tb__field">
                    <label>{t("themeBranding.density", "Density")}</label>
                    <Dropdown value={theme.layout?.density} options={[{ label: t("themeBranding.comfortable", "Comfortable"), value: "comfortable" }, { label: t("themeBranding.compact", "Compact"), value: "compact" }]}
                      onChange={(e) => set("layout", "density", e.value)} />
                  </div>
                  <div className="bv-tb__field">
                    <label>{t("themeBranding.tableHeaderStyle", "Table header style")}</label>
                    <Dropdown value={theme.layout?.tableHeaderStyle} options={[{ label: t("themeBranding.solid", "Solid (secondary colour)"), value: "solid" }, { label: t("themeBranding.lightGrey", "Light"), value: "light" }]}
                      onChange={(e) => { set("layout", "tableHeaderStyle", e.value); setColors(e.value === "light" ? { tableHeaderBg: "#eeeeee", tableHeaderText: "#1a1a1a" } : { tableHeaderBg: c.secondary, tableHeaderText: "#ffffff" }); }} />
                  </div>
                  <div className="bv-tb__field">
                    <label>{t("themeBranding.font", "Font")}</label>
                    <Dropdown value={theme.font} options={editor.fonts.map((f) => ({ label: f.label, value: f.key }))} onChange={(e) => setTheme((prev) => ({ ...prev, preset: "custom", font: e.value }))} />
                  </div>
                  {[["sm", "Corner radius: fields"], ["md", "Corner radius: cards"], ["lg", "Corner radius: panels"], ["button", "Corner radius: buttons"]].map(([k, label]) => (
                    <div className="bv-tb__field" key={k}>
                      <label>{t(`themeBranding.radius.${k}`, label)} ({theme.radius?.[k] ?? 0}px)</label>
                      <Slider value={theme.radius?.[k] ?? 0} min={0} max={k === "lg" ? 32 : 24} onChange={(e) => set("radius", k, e.value)} />
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={t("themeBranding.colours", "Colours")} onReset={() => setTheme((prev) => ({ ...prev, colors: clone(baseTheme.colors) }))} resetLabel={reset}>
                {COLOR_GROUPS.map(([group, title, fields]) => (
                  <div key={group} className="bv-tb__group">
                    <h4>{t(`themeBranding.groups.${group}`, title)}</h4>
                    <div className="bv-tb__grid">
                      {fields.map(([key, label]) => {
                        const against = { primaryText: c.primary, headerText: c.headerBg, sidebarText: c.sidebarBg, sidebarActiveText: c.sidebarActiveBg, tableHeaderText: c.tableHeaderBg, buttonText: c.buttonBg, link: "#ffffff", headingText: c.pageBg }[key];
                        return <ColorField key={key} id={`color-${key}`} label={t(`themeBranding.colors.${key}`, label)} value={c[key]} against={against} onChange={(v) => setColors({ [key]: v })} />;
                      })}
                    </div>
                  </div>
                ))}
              </Section>
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.login", "Sign-in page")}>
              <Section title={t("themeBranding.loginPicture", "Picture")} onReset={() => setTheme((prev) => ({ ...prev, login: { ...clone(baseTheme.login), panelImageUrl: prev.login?.panelImageUrl || "" } }))} resetLabel={reset}>
                <div className="bv-tb__radios">
                  {[["library", "Picture library"], ["image", "Own picture (upload)"], ["color", "Colour only"]].map(([v, label]) => (
                    <span key={v} className="bv-tb__radio">
                      <RadioButton inputId={`panel-${v}`} value={v} checked={theme.login?.panel === v} onChange={(e) => set("login", "panel", e.value)} />
                      <label htmlFor={`panel-${v}`}>{t(`themeBranding.panel.${v}`, label)}</label>
                    </span>
                  ))}
                </div>
                {theme.login?.panel === "library" && (
                  <div className="bv-tb__library">
                    {editor.loginLibrary.map((l) => (
                      <button type="button" key={l.key} className={`bv-tb__lib${theme.login?.library === l.key ? " is-active" : ""}`} onClick={() => set("login", "library", l.key)}
                        style={{ background: `linear-gradient(135deg, ${theme.login?.colorFrom || c.primary}, ${theme.login?.colorTo || c.secondary})` }}>
                        <img src={l.file} alt="" />
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {theme.login?.panel === "image" && (
                  <div className="bv-tb__upload">
                    {fileInput("login-panel", "image/png,image/jpeg,image/webp,image/svg+xml")}
                    <Button type="button" label={t("themeBranding.uploadPicture", "Upload picture")} icon="pi pi-upload" onClick={() => fileRefs["login-panel"].current?.click()} loading={busy === "login-panel"} />
                    {editor.loginPanelUrl && <Button type="button" label={t("themeBranding.removePicture", "Remove picture")} icon="pi pi-trash" className="p-button-text" onClick={() => resetImage("login-panel")} />}
                    <small>{t("themeBranding.pictureRules", "JPG, PNG, WebP or SVG (plain drawing), up to 5 MB. At least 1600 x 1200 px for sharp desktops.")}</small>
                    <div className="bv-tb__grid">
                      <div className="bv-tb__field"><label>{t("themeBranding.focalX", "Focal point: left to right")} ({theme.login?.focalX ?? 50}%)</label>
                        <Slider value={theme.login?.focalX ?? 50} onChange={(e) => set("login", "focalX", e.value)} /></div>
                      <div className="bv-tb__field"><label>{t("themeBranding.focalY", "Focal point: top to bottom")} ({theme.login?.focalY ?? 50}%)</label>
                        <Slider value={theme.login?.focalY ?? 50} onChange={(e) => set("login", "focalY", e.value)} /></div>
                    </div>
                  </div>
                )}
                <div className="bv-tb__grid">
                  <ColorField id="login-from" label={t("themeBranding.colorFrom", "Gradient from")} value={theme.login?.colorFrom} onChange={(v) => set("login", "colorFrom", v)} />
                  <ColorField id="login-to" label={t("themeBranding.colorTo", "Gradient to")} value={theme.login?.colorTo} onChange={(v) => set("login", "colorTo", v)} />
                  <div className="bv-tb__field"><label>{t("themeBranding.overlay", "Darken the picture")} ({theme.login?.overlay ?? 0}%)</label>
                    <Slider value={theme.login?.overlay ?? 0} max={80} onChange={(e) => set("login", "overlay", e.value)} /></div>
                  <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="login-mobile" checked={!!theme.login?.showOnMobile} onChange={(e) => set("login", "showOnMobile", e.value)} />
                    <label htmlFor="login-mobile">{t("themeBranding.showOnMobile", "Show the picture on phones (as a banner)")}</label></div>
                </div>
                <div className="bv-tb__frames">
                  <Button type="button" className="p-button-text p-button-sm" label={mobilePreview ? t("themeBranding.desktop", "Desktop") : t("themeBranding.mobile", "Phone")} icon={mobilePreview ? "pi pi-desktop" : "pi pi-mobile"} onClick={() => setMobilePreview(!mobilePreview)} />
                  <div className={`bv-tb__frame${mobilePreview ? " is-mobile" : ""}`}>
                    {(!mobilePreview || theme.login?.showOnMobile) && <div className="bv-tb__frame-art"><LoginArt theme={previewTheme} preview /></div>}
                    <div className="bv-tb__frame-form"><strong>{theme.login?.headline || `Sign in to ${systemName}`}</strong><small>{theme.login?.tagline}</small><span /><span /><i /></div>
                  </div>
                </div>
              </Section>
              <Section title={t("themeBranding.loginTexts", "Texts")}>
                <div className="bv-tb__field"><label htmlFor="login-headline">{t("themeBranding.headline", "Headline (empty: the sign-in page shows Welcome to the application name)")}</label>
                  <InputText id="login-headline" value={theme.login?.headline || ""} maxLength={80} onChange={(e) => set("login", "headline", e.target.value)} /></div>
                <div className="bv-tb__field"><label htmlFor="login-tagline">{t("themeBranding.tagline", "Tagline")}</label>
                  <InputText id="login-tagline" value={theme.login?.tagline || ""} maxLength={160} onChange={(e) => set("login", "tagline", e.target.value)} /></div>
                <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="login-powered" checked={theme.login?.showPoweredBy !== false} onChange={(e) => set("login", "showPoweredBy", e.value)} />
                  <label htmlFor="login-powered">{t("themeBranding.poweredBy", "Show \"Powered by iorta TechNXT\"")}</label></div>
                <div className="bv-tb__grid">
                  <div className="bv-tb__field"><label>{t("themeBranding.loginLogoHeight", "Logo height on the sign-in page (px)")}</label>
                    <InputNumber value={theme.logo?.loginHeight} min={24} max={140} onValueChange={(e) => set("logo", "loginHeight", e.value)} showButtons /></div>
                </div>
              </Section>
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.documents", "Documents and reports")}>
              <Section title={t("themeBranding.documentColours", "Print colours")} onReset={() => resetSection("documents")} resetLabel={reset}>
                <p className="bv-tb__hint">{t("themeBranding.documentsHint", "Every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers, debit notes, claim letters) and every report PDF / Excel file uses these values, with the logo, legal name, TIN, licence and address of the primary company (Master > Company). Empty colours follow the document accent.")}</p>
                <div className="bv-tb__grid">
                  <ColorField id="doc-accent" label={t("themeBranding.docAccent", "Accent (rules, marker)")} value={theme.documents?.accentColor} allowEmpty emptyLabel={editor.documentBranding?.accent} onChange={(v) => set("documents", "accentColor", v)} />
                  <ColorField id="doc-heading" label={t("themeBranding.docHeading", "Titles and section headings")} value={theme.documents?.headingColor} allowEmpty emptyLabel="=" against={theme.documents?.headingBg} onChange={(v) => set("documents", "headingColor", v)} />
                  <ColorField id="doc-heading-bg" label={t("themeBranding.docHeadingBg", "Section heading band")} value={theme.documents?.headingBg} onChange={(v) => set("documents", "headingBg", v)} />
                  <ColorField id="doc-th" label={t("themeBranding.docTableHeader", "Table header")} value={theme.documents?.tableHeaderBg} allowEmpty emptyLabel="=" onChange={(v) => set("documents", "tableHeaderBg", v)} />
                  <ColorField id="doc-th-text" label={t("themeBranding.docTableHeaderText", "Table header text")} value={theme.documents?.tableHeaderText} against={theme.documents?.tableHeaderBg || theme.documents?.accentColor} onChange={(v) => set("documents", "tableHeaderText", v)} />
                  <div className="bv-tb__field"><label>{t("themeBranding.docLogoHeight", "Logo height on documents (pt)")}</label>
                    <InputNumber value={theme.logo?.documentHeight} min={24} max={80} onValueChange={(e) => set("logo", "documentHeight", e.value)} showButtons /></div>
                </div>
                <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="doc-logo" checked={theme.documents?.showLogo !== false} onChange={(e) => set("documents", "showLogo", e.value)} />
                  <label htmlFor="doc-logo">{t("themeBranding.docShowLogo", "Print the logo on documents")}</label></div>
              </Section>
              <Section title={t("themeBranding.footers", "Footer lines")}>
                <div className="bv-tb__field"><label htmlFor="doc-footer">{t("themeBranding.footerText", "Footer on every document and report ({{licence}}, {{tin}}, {{companyName}})")}</label>
                  <InputTextarea id="doc-footer" rows={2} value={theme.documents?.footerText || ""} maxLength={300} onChange={(e) => set("documents", "footerText", e.target.value)} autoResize /></div>
                <div className="bv-tb__field"><label htmlFor="doc-report-footer">{t("themeBranding.reportFooterText", "Extra line on report files (optional)")}</label>
                  <InputText id="doc-report-footer" value={theme.documents?.reportFooterText || ""} maxLength={300} onChange={(e) => set("documents", "reportFooterText", e.target.value)} /></div>
              </Section>
              <Section title={t("themeBranding.excel", "Excel report files")}>
                <div className="bv-tb__grid">
                  <ColorField id="xl-bg" label={t("themeBranding.excelHeaderBg", "Header row")} value={theme.documents?.excelHeaderBg} onChange={(v) => set("documents", "excelHeaderBg", v)} />
                  <ColorField id="xl-text" label={t("themeBranding.excelHeaderText", "Header row text")} value={theme.documents?.excelHeaderText} against={theme.documents?.excelHeaderBg} onChange={(v) => set("documents", "excelHeaderText", v)} />
                </div>
                <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="xl-logo" checked={!!theme.documents?.excelLogo} onChange={(e) => set("documents", "excelLogo", e.value)} />
                  <label htmlFor="xl-logo">{t("themeBranding.excelLogo", "Logo and company banner above the table (the header row moves down)")}</label></div>
              </Section>
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.email", "E-mail")}>
              <Section title={t("themeBranding.emailLayout", "E-mail layout")} onReset={() => resetSection("email")} resetLabel={reset}>
                <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="mail-on" checked={theme.email?.enabled !== false} onChange={(e) => set("email", "enabled", e.value)} />
                  <label htmlFor="mail-on">{t("themeBranding.emailEnabled", "Send e-mails in the branded layout (header with the logo, footer line)")}</label></div>
                <div className="bv-tb__grid">
                  <ColorField id="mail-bg" label={t("themeBranding.emailHeaderBg", "Header background")} value={theme.email?.headerBg} onChange={(v) => set("email", "headerBg", v)} />
                  <ColorField id="mail-text" label={t("themeBranding.emailHeaderText", "Header text")} value={theme.email?.headerText} against={theme.email?.headerBg} onChange={(v) => set("email", "headerText", v)} />
                  <ColorField id="mail-accent" label={t("themeBranding.emailAccent", "Line under the header")} value={theme.email?.accentColor} onChange={(v) => set("email", "accentColor", v)} />
                </div>
                <div className="bv-tb__field bv-tb__switch"><InputSwitch inputId="mail-logo" checked={theme.email?.showLogo !== false} onChange={(e) => set("email", "showLogo", e.value)} />
                  <label htmlFor="mail-logo">{t("themeBranding.emailLogo", "Logo in the header")}</label></div>
                <div className="bv-tb__field"><label htmlFor="mail-footer">{t("themeBranding.emailFooter", "Footer ({{companyName}}, {{address}}, {{licence}}, {{tin}})")}</label>
                  <InputText id="mail-footer" value={theme.email?.footerText || ""} maxLength={400} onChange={(e) => set("email", "footerText", e.target.value)} /></div>
                <Button type="button" label={t("themeBranding.emailPreview", "Show a sample e-mail")} icon="pi pi-envelope" className="p-button-outlined" onClick={loadEmail} />
                {emailHtml && <iframe title="e-mail" className="bv-tb__email" sandbox="" srcDoc={emailHtml} />}
              </Section>
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.images", "Name and images")}>
              <Section title={t("themeBranding.appName", "Application name")}>
                <div className="bv-tb__field"><label htmlFor="app-name">{t("themeBranding.appNameLabel", "Application name (sign-in page, side bar, browser tab)")}</label>
                  <InputText id="app-name" value={systemName} maxLength={120} onChange={(e) => setSystemName(e.target.value)} /></div>
              </Section>
              <Section title={t("themeBranding.images", "Images")}>
                {[["logo", "Application logo (side bar, sign-in page)", "image/png,image/jpeg,image/webp,image/svg+xml", editor.logoUrl],
                  ["favicon", "Favicon (browser tab)", "image/png,image/x-icon,image/svg+xml", editor.faviconUrl]].map(([asset, label, accept, url]) => (
                  <div key={asset} className="bv-tb__image">
                    {fileInput(asset, accept)}
                    <div className="bv-tb__image-box">{url ? <img src={url} alt="" /> : <span>-</span>}</div>
                    <div>
                      <strong>{t(`themeBranding.image.${asset}`, label)}</strong>
                      <div className="bv-tb__image-actions">
                        <Button type="button" label={t("themeBranding.upload", "Upload")} icon="pi pi-upload" className="p-button-sm" onClick={() => fileRefs[asset].current?.click()} loading={busy === asset} />
                        <Button type="button" label={t("themeBranding.useDefault", "Use default")} className="p-button-text p-button-sm" onClick={() => resetImage(asset)} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bv-tb__grid">
                  <div className="bv-tb__field"><label>{t("themeBranding.appLogoHeight", "Logo height in the side bar (px)")}</label>
                    <InputNumber value={theme.logo?.appHeight} min={20} max={80} onValueChange={(e) => set("logo", "appHeight", e.value)} showButtons /></div>
                </div>
                <p className="bv-tb__hint">{t("themeBranding.printLogoHint", "The logo on printed documents is the logo of the primary company in Master > Company (a brand pack import can set it).")}</p>
              </Section>
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.signatures", "Document signatures")}>
              <SignatureSlots notify={notify} />
            </TabPanel>

            <TabPanel header={t("themeBranding.tabs.packs", "Brand packs")}>
              <BrandPacks notify={notify} onImported={() => { load(); notifyBrandingUpdated(); }} />
            </TabPanel>
          </TabView>
        </div>

        <aside className="bv-tb__side">
          <h3>{t("themeBranding.livePreview", "Live preview")}</h3>
          <ThemePreview theme={previewTheme} fontStack={fontStack} logoUrl={editor.logoUrl} systemName={systemName} companyName={editor.company} documentBranding={editor.documentBranding} t={t} />
          <h3>{t("themeBranding.contrast", "Contrast (WCAG AA 4.5:1)")}</h3>
          <ul className="bv-tb__checks" data-testid="contrast-checks">
            {(check.checks || []).map((x) => (
              <li key={x.key} className={x.ok ? "ok" : x.blocking ? "fail" : "warn"}>
                <i className={`pi ${x.ok ? "pi-check-circle" : x.blocking ? "pi-times-circle" : "pi-exclamation-triangle"}`} />
                <span>{x.label}</span>
                <b>{x.ratio}:1</b>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default ThemeBrandingPage;
