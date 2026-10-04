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
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Message } from "primereact/message";
import brandingService from "../../services/brandingService";
import "./index.scss";

const today = () => new Date().toISOString().slice(0, 10);

/** Drawing pad: pointer strokes on a transparent canvas; exports a PNG data URL (null when empty). */
export const SignaturePad = ({ onChange, height = 180 }) => {
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
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} aria-label="Signature pad" />
      <span className="bv-sig-pad__line" />
      <Button type="button" label="Clear" icon="pi pi-eraser" className="p-button-text p-button-sm bv-sig-pad__clear" onClick={clear} />
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
  const [revoking, setRevoking] = useState(null);
  const [reason, setReason] = useState("");

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
  const revoke = async () => {
    try {
      await brandingService.revokeSignature(revoking, reason);
      setRevoking(null);
      setReason("");
      reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const ready = consent && (mode === "draw" ? !!drawn : !!file);

  return (
    <Dialog header={`${t("signature.title", "E-signature")}${ownerName ? `: ${ownerName}` : ""}`} visible={visible} onHide={onHide} style={{ width: "min(760px, 96vw)" }} className="bv-sig" modal>
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
            <InputText id="sig-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="bv-sig__consent">
            <Checkbox inputId="sig-consent" checked={consent} onChange={(e) => setConsent(e.checked)} />
            <label htmlFor="sig-consent">{consentText || t("signature.consent", "I confirm the signer's consent to print this signature on the mapped documents.")}</label>
          </div>
          <Button type="button" label={t("signature.save", "Save signature")} icon="pi pi-check" onClick={save} disabled={!ready} loading={saving} data-testid="save-signature" />
        </div>
      )}
      <h4 className="bv-sig__h">{t("signature.versions", "Versions")}</h4>
      {!versions.length && <p className="bv-sig__none">{t("signature.none", "No signature captured yet.")}</p>}
      <ul className="bv-sig__versions">
        {versions.map((v) => (
          <li key={v.id}>
            <VersionImage id={v.id} />
            <div>
              <strong>v{v.version}</strong> <Tag value={v.status} severity={v.status === "active" ? "success" : v.status === "revoked" ? "danger" : "info"} />
              <div className="bv-sig__meta">
                {t("signature.period", "Effective")} {v.effectiveFrom} {v.effectiveTo ? `- ${v.effectiveTo}` : t("signature.onwards", "onwards")} | {v.method} | {v.capturedBy}
                {v.revokeReason ? ` | ${t("signature.revoked", "revoked")}: ${v.revokeReason}` : ""}
              </div>
            </div>
            {v.status !== "revoked" && canManage && (
              <Button type="button" label={t("signature.revoke", "Revoke")} className="p-button-text p-button-danger p-button-sm" onClick={() => { setRevoking(v.id); setReason(""); }} />
            )}
          </li>
        ))}
      </ul>
      {revoking && (
        <div className="bv-sig__revoke">
          <InputText value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("signature.reason", "Reason for the revocation")} />
          <Button type="button" label={t("signature.confirmRevoke", "Revoke version")} className="p-button-danger p-button-sm" disabled={!reason.trim()} onClick={revoke} />
          <Button type="button" label={t("common.cancel", "Cancel")} className="p-button-text p-button-sm" onClick={() => setRevoking(null)} />
        </div>
      )}
    </Dialog>
  );
};

export default SignatureCapture;
