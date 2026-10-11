/**
 * E-signature capture (Master > Signatories > E-signature; My Profile > E-signature): draw the signature on screen or
 * upload an image, choose the date it takes effect, accept the consent statement, save a new version. Lists the
 * versions (effective dates, status) with the images (fetched with the bearer token: signature images have no public
 * link) and revokes a version with a reason.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Message } from "primereact/message";
import brandingService from "../../services/brandingService";
import DateField from "../DateField";
import StatusChip from "../StatusChip";
import KeyValueGrid from "../KeyValueGrid";
import { openConfirm } from "../ConfirmDialog";
import "./index.scss";

const today = () => new Date().toISOString().slice(0, 10);

/** Drawing pad: pointer strokes on a transparent canvas; exports a PNG data URL (null when empty). */
export const SignaturePad = ({ onChange, height = 180 }) => {
  const { t } = useTranslation();
  const canvas = useRef(null);
  const drawing = useRef(false);
  const empty = useRef(true);
  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) * canvas.current.width) / r.width, ((e.clientY - r.top) * canvas.current.height) / r.height];
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    canvas.current.setPointerCapture?.(e.pointerId);
    const ctx = canvas.current.getContext("2d");
    const [x, y] = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d");
    const [x, y] = point(e);
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1f3a";
    ctx.lineTo(x, y);
    ctx.stroke();
    empty.current = false;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(empty.current ? null : canvas.current.toDataURL("image/png"));
  };
  const clear = () => {
    canvas.current.getContext("2d").clearRect(0, 0, canvas.current.width, canvas.current.height);
    empty.current = true;
    onChange?.(null);
  };
  return (
    <div className="bv-sig-pad">
      <canvas ref={canvas} width={720} height={height * 1.5} style={{ height }} data-testid="signature-pad"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} aria-label={t("signature.pad", "Signature pad")} />
      <span className="bv-sig-pad__line" />
      <Button type="button" label={t("signature.clear", "Clear")} icon="pi pi-eraser" className="p-button-text p-button-sm bv-sig-pad__clear" onClick={clear} />
    </div>
  );
};

/** The image of a stored version (authenticated fetch -> object URL). */
const VersionImage = ({ id }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    brandingService.signatureImage(id).then((b) => { if (alive) { made = URL.createObjectURL(b); setUrl(made); } }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url ? <img src={url} alt="" className="bv-sig__img" /> : <span className="bv-sig__img bv-sig__img--empty" />;
};

const SignatureCapture = ({ visible, onHide, ownerType, ownerId, ownerName, canManage = true }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState("draw");
  const [drawn, setDrawn] = useState(null);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [consentText, setConsentText] = useState("");
  const [consent, setConsent] = useState(false);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!visible) return;
    brandingService.listSignatures(ownerType, ownerId).then(setVersions).catch((e) => setError(e.message));
  }, [visible, ownerType, ownerId]);
  useEffect(() => {
    if (!visible) return;
    setError("");
    setConsent(false);
    setDrawn(null);
    setFile(null);
    setFilePreview(null);
    brandingService.consent(ownerType, ownerId).then((r) => setConsentText(r.text)).catch(() => {});
    reload();
  }, [visible, ownerType, ownerId, reload]);

  const pickFile = (f) => {
    setError("");
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setError(t("signature.fileType", "Use a PNG or JPEG image")); return; }
    if (f.size > 512 * 1024) { setError(t("signature.fileSize", "The image is larger than 512 KB")); return; }
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (mode === "draw") await brandingService.captureDrawn({ ownerType, ownerId, imageData: drawn, effectiveFrom, consent });
      else await brandingService.captureUpload({ ownerType, ownerId, file, effectiveFrom, consent });
      setDrawn(null);
      setFile(null);
      setFilePreview(null);
      setConsent(false);
      reload();
    } catch (e) {
      setError([e.message, ...(e.errors || []).map((x) => x.message)].join(" | "));
    } finally {
      setSaving(false);
    }
  };
  const methodLabel = (m) => t(`signature.methods.${m}`, { defaultValue: m });
  const statusLabel = (status) => t(`signature.statuses.${status}`, { defaultValue: status });

  const revoke = async (v) => {
    const reason = await openConfirm({
      title: t("signature.revokeTitle"),
      severity: "danger",
      message: t("signature.revokeMessage"),
      facts: [
        { label: t("signature.signer"), value: ownerName, hidden: !ownerName },
        { label: t("signature.version"), value: `v${v.version}` },
        { label: t("signature.effectiveFrom", "Effective from"), value: v.effectiveFrom, type: "date" },
        { label: t("signature.effectiveTo"), value: v.effectiveTo || t("signature.openEnded"), type: v.effectiveTo ? "date" : "text" },
      ],
      note: t("signature.revokeNote"),
      input: { type: "textarea", label: t("signature.reason", "Reason for the revocation"), required: true, minLength: 3, maxLength: 500 },
      confirmLabel: t("signature.confirmRevoke", "Revoke version"),
      onConfirm: (text) => brandingService.revokeSignature(v.id, text),
    });
    if (reason !== null) reload();
  };
  const ready = consent && (mode === "draw" ? !!drawn : !!file);

  return (
    <Dialog header={`${t("signature.title", "E-signature")}${ownerName ? `: ${ownerName}` : ""}`} visible={visible} onHide={onHide} style={{ width: "min(760px, 96vw)" }} className="bv-sig" modal
      footer={(
        // the save sits in the footer with Close, as on every dialog
        <>
          <Button type="button" label={t("signature.close", "Close")} text onClick={onHide} />
          {canManage && <Button type="button" label={t("signature.save", "Save signature")} icon="pi pi-check" onClick={save} disabled={!ready} loading={saving} data-testid="save-signature" />}
        </>
      )}>
      {error && <Message severity="error" text={error} className="mb-3 w-full justify-content-start" />}
      {canManage && (
        <div className="bv-sig__capture">
          <div className="bv-sig__modes">
            <Button type="button" label={t("signature.draw", "Draw")} icon="pi pi-pencil" className={mode === "draw" ? "" : "p-button-outlined"} onClick={() => setMode("draw")} />
            <Button type="button" label={t("signature.upload", "Upload image")} icon="pi pi-upload" className={mode === "upload" ? "" : "p-button-outlined"} onClick={() => setMode("upload")} />
          </div>
          {mode === "draw" ? (
            <SignaturePad onChange={setDrawn} />
          ) : (
            <div className="bv-sig__upload">
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => pickFile(e.target.files?.[0])} data-testid="signature-file" />
              <small>{t("signature.uploadHint", "PNG (transparent background preferred) or JPEG, up to 512 KB.")}</small>
              {filePreview && <img src={filePreview} alt="" className="bv-sig__img" />}
            </div>
          )}
          <div className="bv-sig__row">
            <label htmlFor="sig-from">{t("signature.effectiveFrom", "Effective from")}</label>
            <DateField id="sig-from" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="bv-sig__consent">
            <Checkbox inputId="sig-consent" checked={consent} onChange={(e) => setConsent(e.checked)} />
            <label htmlFor="sig-consent">{consentText || t("signature.consent", "I confirm the signer's consent to print this signature on the mapped documents.")}</label>
          </div>
        </div>
      )}
      <h4 className="bv-sig__h">{t("signature.versions", "Versions")}</h4>
      {!versions.length && <p className="bv-sig__none">{t("signature.none", "No signature captured yet.")}</p>}
      <ul className="bv-sig__versions">
        {versions.map((v) => (
          <li key={v.id}>
            <VersionImage id={v.id} />
            <div className="bv-sig__version">
              <div className="bv-sig__version-head">
                <strong>{t("signature.versionNo", { version: v.version })}</strong>
                <StatusChip code={v.status} label={statusLabel(v.status)} severity={v.status === "active" ? "success" : v.status === "revoked" ? "danger" : "info"} />
              </div>
              <KeyValueGrid columns="auto" items={[
                { label: t("signature.effectiveFrom", "Effective from"), value: v.effectiveFrom, type: "date" },
                { label: t("signature.effectiveTo"), value: v.effectiveTo || t("signature.openEnded"), type: v.effectiveTo ? "date" : "text" },
                { label: t("signature.method"), value: methodLabel(v.method) },
                { label: t("signature.capturedBy"), value: v.capturedBy },
                { label: t("signature.capturedAt"), value: v.capturedAt, type: "datetime" },
                { label: t("signature.revokedBy"), value: v.revokedBy, hidden: v.status !== "revoked" },
                { label: t("signature.revokedAt"), value: v.revokedAt, type: "datetime", hidden: v.status !== "revoked" },
                { label: t("signature.revokeReason"), value: v.revokeReason, span: "full", hidden: !v.revokeReason },
              ]} />
            </div>
            {v.status !== "revoked" && canManage && (
              <Button type="button" label={t("signature.revoke", "Revoke")} className="p-button-text p-button-danger p-button-sm" onClick={() => revoke(v)} />
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
};

export default SignatureCapture;
