/**
 * Brand packs: export this environment's branding (theme, application name, logo, favicon, sign-in picture, print
 * logo) as a .zip or .json, and import a pack (onboarding a broker, promoting UAT branding to Production, a client
 * pack such as Toyota Insurance Services). An import is checked first (dry run) and applied on confirmation.
 */
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Message } from "primereact/message";
import brandingService from "../../services/brandingService";

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const BrandPacks = ({ notify, onImported }) => {
  const { t } = useTranslation();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState("");
  const [applyDocumentLogo, setApplyDocumentLogo] = useState(true);
  const [applySystemName, setApplySystemName] = useState(true);

  const exportPack = async (format) => {
    setBusy(format);
    try {
      download(await brandingService.exportPack(format), `brand.brandpack.${format}`);
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const choose = async (f) => {
    if (!f) return;
    setFile(f);
    setCheck(null);
    setBusy("check");
    try {
      setCheck({ ok: true, ...(await brandingService.importPack(f, { dryRun: true })) });
    } catch (e) {
      setCheck({ ok: false, message: e.message, errors: e.errors || [] });
    } finally {
      setBusy("");
    }
  };
  const apply = async () => {
    setBusy("apply");
    try {
      const r = await brandingService.importPack(file, { applyDocumentLogo, applySystemName });
      notify("success", t("common.success", "Success"), `${t("themeBranding.packApplied", "Brand pack applied")}: ${r.name} (${r.applied.join(", ")})`);
      setFile(null);
      setCheck(null);
      onImported?.();
    } catch (e) {
      notify("error", t("common.error", "Error"), [e.message, ...(e.errors || []).map((x) => x.message)].join(" | "));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="bv-tb__packs">
      <section className="bv-tb__section">
        <h3>{t("themeBranding.exportPack", "Export")}</h3>
        <p className="bv-tb__hint">{t("themeBranding.exportHint", "The branding of this environment: theme (colours, layout, sign-in page, documents, e-mail), application name, logo, favicon, sign-in picture and print logo. Import it in another environment to promote it (UAT to Production).")}</p>
        <div className="bv-tb__image-actions">
          <Button type="button" label={t("themeBranding.exportZip", "Export .zip")} icon="pi pi-download" onClick={() => exportPack("zip")} loading={busy === "zip"} />
          <Button type="button" label={t("themeBranding.exportJson", "Export .json")} icon="pi pi-download" className="p-button-outlined" onClick={() => exportPack("json")} loading={busy === "json"} />
        </div>
      </section>
      <section className="bv-tb__section">
        <h3>{t("themeBranding.importPack", "Import")}</h3>
        <p className="bv-tb__hint">{t("themeBranding.importHint", "A brand pack .zip (theme.json and images) or .json. Client brand packs that carry a third party's marks (for example a car brand) may only be applied with the client's written permission.")}</p>
        <input ref={input} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} data-testid="brand-pack-file" />
        <Button type="button" label={t("themeBranding.choosePack", "Choose brand pack")} icon="pi pi-upload" className="p-button-outlined" onClick={() => input.current?.click()} loading={busy === "check"} />
        {check && !check.ok && <Message severity="error" className="mt-3" text={[check.message, ...(check.errors || []).map((x) => `${x.path}: ${x.message}`)].join(" | ")} />}
        {check?.ok && (
          <div className="bv-tb__pack-check">
            <Message severity="info" text={`${check.name}: ${t("themeBranding.packValid", "valid")}. ${t("themeBranding.packContains", "Contains")}: ${["theme", ...(check.assets || [])].join(", ")}`} />
            {(check.warnings || []).map((w) => <Message key={w.path} severity="warn" text={w.message} />)}
            <div className="bv-tb__swatches bv-tb__swatches--big">
              {["primary", "headerBg", "sidebarBg", "tableHeaderBg", "buttonBg", "accent"].map((k) => <i key={k} title={k} style={{ background: check.theme?.colors?.[k] }} />)}
            </div>
            <div className="bv-tb__check-row"><Checkbox inputId="apply-doc-logo" checked={applyDocumentLogo} onChange={(e) => setApplyDocumentLogo(e.checked)} />
              <label htmlFor="apply-doc-logo">{t("themeBranding.applyDocumentLogo", "Also use the logo on printed documents (print logo of the primary company)")}</label></div>
            <div className="bv-tb__check-row"><Checkbox inputId="apply-name" checked={applySystemName} onChange={(e) => setApplySystemName(e.checked)} />
              <label htmlFor="apply-name">{t("themeBranding.applySystemName", "Also set the application name of the pack")}</label></div>
            <Button type="button" label={t("themeBranding.applyPack", "Apply brand pack")} icon="pi pi-check" onClick={apply} loading={busy === "apply"} data-testid="apply-pack" />
          </div>
        )}
      </section>
    </div>
  );
};

export default BrandPacks;
