/**
 * Document signatures: which signature prints on which document. Per document type, its slots: label, source (the
 * signatory chosen on the document, a named signatory, the default signatory, the approving user or the issuing
 * user) and condition (issued, approved, always). Drafts print the slots unsigned with an "UNSIGNED DRAFT" watermark.
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import brandingService from "../../services/brandingService";
import mastersService from "../../services/mastersService";

const SignatureSlots = ({ notify }) => {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState(null);
  const [docType, setDocType] = useState("policy-schedule");
  const [rows, setRows] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    brandingService.getSlots().then(setCfg).catch((e) => notify("error", t("common.error", "Error"), e.message));
    mastersService.options("signatory").then((list) => setSignatories(list.map((s) => ({ label: s.label, value: Number(s.id) })))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cfg) setRows(cfg.slots.filter((s) => s.documentType === docType).map((s) => ({ ...s })));
  }, [cfg, docType]);

  if (!cfg) return <p>{t("common.loading", "Loading...")}</p>;
  const update = (i, key, value) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, [key]: value } : r)));
  const save = async () => {
    setSaving(true);
    try {
      const slots = await brandingService.saveSlots(rows.map((r, i) => ({ documentType: docType, slot: r.slot, label: r.label, source: r.source, signatoryId: r.signatoryId, condition: r.condition, active: r.active !== false, sortOrder: i + 1 })));
      setCfg({ ...cfg, slots });
      notify("success", t("common.success", "Success"), t("themeBranding.slotsSaved", "Signature mapping saved"));
    } catch (e) {
      notify("error", t("common.error", "Error"), [e.message, ...(e.errors || []).map((x) => x.message)].join(" | "));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bv-tb__slots">
      <p className="bv-tb__hint">
        {t("themeBranding.slotsHint", "Signatures are captured in Master > Signatories (company signatories) and in My Profile (a user's own signature). In uploaded document templates, place a signature with")} <code>{cfg.placeholder}</code>.
      </p>
      <div className="bv-tb__field">
        <label>{t("themeBranding.documentType", "Document")}</label>
        <Dropdown value={docType} options={cfg.documentTypes.map((d) => ({ label: d.label, value: d.key }))} onChange={(e) => setDocType(e.value)} />
      </div>
      <div className="bv-tb__slots-list">
        {rows.map((r, i) => (
          <div className="bv-tb__slot" key={`${r.slot}-${i}`}>
            <div className="bv-tb__field">
              <label>{t("themeBranding.slot", "Slot")}</label>
              <InputText value={r.slot} onChange={(e) => update(i, "slot", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} disabled={!!r.id} />
            </div>
            <div className="bv-tb__field">
              <label>{t("themeBranding.label", "Label")}</label>
              <InputText value={r.label} onChange={(e) => update(i, "label", e.target.value)} />
            </div>
            <div className="bv-tb__field">
              <label>{t("themeBranding.source", "Signed by")}</label>
              <Dropdown value={r.source} options={cfg.sources.map((x) => ({ label: x.label, value: x.key }))} onChange={(e) => update(i, "source", e.value)} />
              {r.source === "named-signatory" && <Dropdown value={r.signatoryId} options={signatories} placeholder={t("themeBranding.chooseSignatory", "Signatory")} onChange={(e) => update(i, "signatoryId", e.value)} />}
            </div>
            <div className="bv-tb__field">
              <label>{t("themeBranding.condition", "Prints")}</label>
              <Dropdown value={r.condition} options={cfg.conditions.map((x) => ({ label: x.label, value: x.key }))} onChange={(e) => update(i, "condition", e.value)} />
            </div>
            <div className="bv-tb__slot-actions">
              <span className="bv-tb__switch"><InputSwitch inputId={`slot-on-${i}`} checked={r.active !== false} onChange={(e) => update(i, "active", e.value)} />
                <label htmlFor={`slot-on-${i}`}>{t("themeBranding.active", "Active")}</label></span>
              <Button type="button" icon="pi pi-trash" className="p-button-text p-button-danger" aria-label={t("common.delete", "Delete")} onClick={() => setRows(rows.filter((_, k) => k !== i))} />
            </div>
          </div>
        ))}
      </div>
      <div className="bv-tb__image-actions">
        <Button type="button" label={t("themeBranding.addSlot", "Add slot")} icon="pi pi-plus" className="p-button-outlined p-button-sm"
          onClick={() => setRows([...rows, { slot: `slot-${rows.length + 1}`, label: "Noted by", source: "default-signatory", condition: "issued", active: true }])} />
        <Button type="button" label={t("common.save", "Save")} icon="pi pi-check" className="p-button-sm" onClick={save} loading={saving} />
      </div>
    </div>
  );
};

export default SignatureSlots;
