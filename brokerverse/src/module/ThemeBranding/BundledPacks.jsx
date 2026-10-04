/**
 * Bundled brand packs (Theme and Branding > Brand packs): the packs shipped with the product, with their status in this
 * environment. None is enabled by default. Enable opens a confirmation that names the owner of the marks and asks the
 * administrator to acknowledge that the environment belongs to the client engagement whose contract with iorta TechNXT
 * covers the marks before the button activates; the enablement is recorded
 * (who, when) and shown on the card, with Back to default to return to the iorta TechNXT branding. Preview reuses the
 * sample document and sample e-mail of the theme editor with the pack's theme (nothing is saved).
 */
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import brandingService from "../../services/brandingService";
import { formatDate } from "../../utility/dateFormat";

const SWATCHES = ["primary", "headerBg", "sidebarBg", "tableHeaderBg", "buttonBg", "accent"];

const BundledPacks = ({ notify, onChanged }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // pack being enabled
  const [check, setCheck] = useState(null); // dry run of the pack being enabled
  const [acknowledged, setAcknowledged] = useState(false);
  const [applyDocumentLogo, setApplyDocumentLogo] = useState(true);
  const [applySystemName, setApplySystemName] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [emailHtml, setEmailHtml] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await brandingService.bundledPacks());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const previewDocument = async (pack) => {
    setBusy(`doc:${pack.id}`);
    try {
      const pdf = await brandingService.previewDocument(pack.theme);
      window.open(URL.createObjectURL(pdf), "_blank", "noopener");
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const previewEmail = async (pack) => {
    setBusy(`mail:${pack.id}`);
    try {
      setEmailHtml((await brandingService.previewEmail(pack.theme)).html);
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };
  const openConfirm = async (pack) => {
    setConfirm(pack);
    setAcknowledged(false);
    setApplyDocumentLogo(true);
    setApplySystemName(true);
    setCheck(null);
    try {
      setCheck({ ok: true, ...(await brandingService.checkBundledPack(pack.id)) });
    } catch (e) {
      setCheck({ ok: false, message: e.message, errors: e.errors || [] });
    }
  };
  const enable = async () => {
    if (!confirm || !acknowledged || check?.ok === false) return;
    setBusy(`enable:${confirm.id}`);
    try {
      const r = await brandingService.enableBundledPack(confirm.id, { acknowledgedPermission: acknowledged === true, applyDocumentLogo, applySystemName });
      notify("success", t("common.success", "Success"), `${t("themeBranding.bundled.enabled", "Brand pack enabled")}: ${r.name} (${(r.applied || []).join(", ")})`);
      setConfirm(null);
      await load();
      onChanged?.();
    } catch (e) {
      notify("error", t("common.error", "Error"), [e.message, ...(e.errors || []).map((x) => x.message)].join(" | "));
    } finally {
      setBusy("");
    }
  };
  const resetDefault = async () => {
    setBusy("reset");
    try {
      await brandingService.resetDefaultBranding();
      notify("success", t("common.success", "Success"), t("themeBranding.bundled.reset", "Default branding restored"));
      setResetOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setBusy("");
    }
  };

  const enabledLine = (en) => t("themeBranding.bundled.enabledOnBy", "Enabled on {{date}} by {{user}}", { date: formatDate(en.enabledAt, { withTime: true }), user: en.enabledByName || en.enabledBy || "-" });
  const packs = data?.packs || [];

  return (
    <section className="bv-tb__section bv-tb__bundled" data-testid="bundled-packs">
      <h3>{t("themeBranding.bundled.title", "Bundled packs")}</h3>
      <p className="bv-tb__hint">{t("themeBranding.bundled.hint", "Brand packs shipped with the product. None is enabled by default; enabling one applies it like an import and records who enabled it and when. The marks a pack carries belong to a client of iorta TechNXT: enable it in that client's environments, under its contract with iorta TechNXT.")}</p>
      {error && <Message severity="error" text={error} />}
      {data && (
        <div className="bv-tb__bundled-status">
          {data.current ? (
            <>
              <Tag severity="success" value={t("themeBranding.bundled.statusEnabled", "Enabled")} />
              <span>{data.current.packName}: {enabledLine(data.current)}</span>
              <Button type="button" label={t("themeBranding.bundled.backToDefault", "Back to default")} icon="pi pi-undo" className="p-button-outlined p-button-sm" onClick={() => setResetOpen(true)} loading={busy === "reset"} data-testid="back-to-default" />
            </>
          ) : (
            <span>{t("themeBranding.bundled.defaultInForce", "The iorta TechNXT default branding is in force.")}</span>
          )}
        </div>
      )}
      {data && packs.length === 0 && <p className="bv-tb__hint">{t("themeBranding.bundled.none", "No bundled brand pack is shipped with this release.")}</p>}
      <div className="bv-tb__bundled-list">
        {packs.map((pack) => {
          const enabled = pack.status === "enabled";
          return (
            <article key={pack.id} className={`bv-tb__bundled-card${enabled ? " bv-tb__bundled-card--enabled" : ""}`} data-testid={`bundled-pack-${pack.id}`}>
              <div className="bv-tb__bundled-head">
                <h4>{pack.name}</h4>
                <Tag severity={enabled ? "success" : "info"} value={enabled ? t("themeBranding.bundled.statusEnabled", "Enabled") : t("themeBranding.bundled.statusAvailable", "Available")} />
              </div>
              <dl className="bv-tb__bundled-meta">
                <dt>{t("themeBranding.bundled.owner", "Marks owned by")}</dt><dd>{pack.trademarkOwner || "-"}</dd>
                <dt>{t("themeBranding.bundled.version", "Version")}</dt><dd>{pack.version}</dd>
              </dl>
              <p>{pack.description}</p>
              <div className="bv-tb__swatches bv-tb__swatches--big" aria-label={`${pack.name} colours`}>
                {SWATCHES.map((k) => <i key={k} title={`${k}: ${pack.preview?.[k] || ""}`} style={{ background: pack.preview?.[k] }} />)}
              </div>
              {(pack.warnings || []).map((w) => <Message key={w.path} severity="warn" text={w.message} />)}
              {enabled && pack.enablement && <p className="bv-tb__bundled-enabled">{enabledLine(pack.enablement)}</p>}
              <div className="bv-tb__image-actions">
                <Button type="button" label={t("themeBranding.bundled.previewDocument", "Sample document")} icon="pi pi-file-pdf" className="p-button-outlined p-button-sm" onClick={() => previewDocument(pack)} loading={busy === `doc:${pack.id}`} />
                <Button type="button" label={t("themeBranding.bundled.previewEmail", "Sample e-mail")} icon="pi pi-envelope" className="p-button-outlined p-button-sm" onClick={() => previewEmail(pack)} loading={busy === `mail:${pack.id}`} />
                {enabled ? (
                  <Button type="button" label={t("themeBranding.bundled.backToDefault", "Back to default")} icon="pi pi-undo" className="p-button-sm" onClick={() => setResetOpen(true)} loading={busy === "reset"} />
                ) : (
                  <Button type="button" label={t("themeBranding.bundled.enable", "Enable")} icon="pi pi-check" className="p-button-sm" onClick={() => openConfirm(pack)} data-testid={`enable-${pack.id}`} />
                )}
              </div>
            </article>
          );
        })}
      </div>
      {emailHtml && <iframe title="bundled e-mail" className="bv-tb__email" sandbox="" srcDoc={emailHtml} />}
      {data?.history?.length > 0 && (
        <details className="bv-tb__bundled-history">
          <summary>{t("themeBranding.bundled.history", "History")}</summary>
          <ul>
            {data.history.map((h) => (
              <li key={h.id}>
                {h.packName}: {t(`themeBranding.bundled.historyStatus.${h.status}`, h.status)}. {enabledLine(h)}
                {h.revertedAt ? ` (${formatDate(h.revertedAt, { withTime: true })}, ${h.revertedBy || "-"})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog header={confirm ? t("themeBranding.bundled.confirmTitle", "Enable {{name}}", { name: confirm.name }) : ""} visible={!!confirm} style={{ width: "min(560px, 95vw)" }} modal onHide={() => setConfirm(null)}
        footer={confirm && (
          <div>
            <Button type="button" label={t("common.cancel", "Cancel")} className="p-button-text" onClick={() => setConfirm(null)} />
            <Button type="button" label={t("themeBranding.bundled.enable", "Enable")} icon="pi pi-check" onClick={enable} disabled={!acknowledged || !check?.ok} loading={busy === `enable:${confirm.id}`} data-testid="confirm-enable" />
          </div>
        )}>
        {confirm && (
          <div className="bv-tb__pack-check">
            <Message severity="warn" text={t("themeBranding.bundled.trademark", "The name, emblem and logo in this pack are trademarks of {{owner}}, a client of iorta TechNXT. Their use is covered by the client's contract with iorta TechNXT for the environments of that engagement; keep the contract reference with the engagement records.", { owner: confirm.trademarkOwner || "their owner" })} />
            {confirm.permissionBasis && <p className="bv-tb__hint"><strong>{t("themeBranding.bundled.basis", "Basis")}:</strong> {confirm.permissionBasis}</p>}
            {confirm.permissionNote && <p className="bv-tb__hint">{confirm.permissionNote}</p>}
            {check && !check.ok && <Message severity="error" text={[check.message, ...(check.errors || []).map((x) => `${x.path}: ${x.message}`)].join(" | ")} />}
            {check?.ok && <Message severity="info" text={`${check.name}: ${t("themeBranding.packValid", "valid")}. ${t("themeBranding.packContains", "Contains")}: ${["theme", ...(check.assets || [])].join(", ")}`} />}
            {(check?.warnings || []).map((w) => <Message key={w.path} severity="warn" text={w.message} />)}
            <p className="bv-tb__hint">{t("themeBranding.bundled.applies", "Enabling applies the theme, the application name and the images of the pack at once to every signed-in user, printed documents, reports and e-mails. You can go back to the default at any time.")}</p>
            <div className="bv-tb__check-row"><Checkbox inputId="bundled-ack" checked={acknowledged} onChange={(e) => setAcknowledged(!!e.checked)} />
              <label htmlFor="bundled-ack"><strong>{t("themeBranding.bundled.acknowledge", "This environment belongs to the client engagement whose contract with iorta TechNXT covers these marks")}</strong></label></div>
            <div className="bv-tb__check-row"><Checkbox inputId="bundled-doc-logo" checked={applyDocumentLogo} onChange={(e) => setApplyDocumentLogo(!!e.checked)} />
              <label htmlFor="bundled-doc-logo">{t("themeBranding.applyDocumentLogo", "Also use the logo on printed documents (print logo of the primary company)")}</label></div>
            <div className="bv-tb__check-row"><Checkbox inputId="bundled-name" checked={applySystemName} onChange={(e) => setApplySystemName(!!e.checked)} />
              <label htmlFor="bundled-name">{t("themeBranding.applySystemName", "Also set the application name of the pack")}</label></div>
          </div>
        )}
      </Dialog>

      <Dialog header={t("themeBranding.bundled.backToDefault", "Back to default")} visible={resetOpen} style={{ width: "min(520px, 95vw)" }} modal onHide={() => setResetOpen(false)}
        footer={(
          <div>
            <Button type="button" label={t("common.cancel", "Cancel")} className="p-button-text" onClick={() => setResetOpen(false)} />
            <Button type="button" label={t("themeBranding.bundled.backToDefault", "Back to default")} icon="pi pi-undo" onClick={resetDefault} loading={busy === "reset"} data-testid="confirm-reset" />
          </div>
        )}>
        <p>{t("themeBranding.bundled.backToDefaultConfirm", "Return to the iorta TechNXT default branding? The default theme, logo and favicon are restored; the application name and the print logo of the primary company go back to what they were before the pack was enabled. Every signed-in user gets it on their next page.")}</p>
      </Dialog>
    </section>
  );
};

export default BundledPacks;
