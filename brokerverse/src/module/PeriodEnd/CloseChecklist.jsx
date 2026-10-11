import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { openConfirm } from "../../components/ConfirmDialog";
import { PageHeader, StatusTag, showError, showSuccess } from "./common";

const EMPTY = { code: "", label: "", description: "", itemType: "manual", severity: "warning", active: true, sortOrder: 200 };

/**
 * Close Checklist master: the items every month-end close run copies. Automatic items run a built-in check (unposted
 * journals, trial balance, suspense, unapplied receipts, bank reconciliation, unbilled policies, remittances, direct
 * bill); manual items are signed off by a user. Blocking items must pass or be signed off before the period closes.
 */
const CloseChecklist = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [data, setData] = useState({ items: [], autoChecks: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await periodEndService.checklist());
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const v = editing?.values;
  const setValue = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const save = async () => {
    try {
      const body = { label: v.label, description: v.description || null, itemType: v.itemType, severity: v.severity, active: !!v.active, sortOrder: v.sortOrder };
      if (editing.isNew) await periodEndService.addChecklistItem({ code: v.code, ...body });
      else await periodEndService.updateChecklistItem(v.code, body);
      showSuccess(toast, v.label);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const remove = async (row) => {
    const ok = await openConfirm({
      title: t("periodEnd.confirmations.deleteItemTitle"),
      severity: "danger",
      message: t("periodEnd.confirmations.deleteItemMessage"),
      facts: [
        { label: t("periodEnd.code"), value: row.code },
        { label: t("periodEnd.item"), value: row.label },
        { label: t("periodEnd.severity"), value: t(`periodEnd.severityValue.${row.severity}`) },
      ],
      confirmLabel: t("periodEnd.confirmations.deleteItem"),
    });
    if (!ok) return;
    try {
      await periodEndService.deleteChecklistItem(row.code);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.closeChecklist")} trail={[t("periodEnd.closeChecklist")]}>
        <Button icon="pi pi-plus" label={t("periodEnd.addItem")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
      </PageHeader>
      <div className="pe-card">
        <DataTable value={data.items} loading={loading} dataKey="code" size="small" stripedRows>
          <Column field="sortOrder" header={t("periodEnd.order")} style={{ width: "5rem" }} />
          <Column field="code" header={t("periodEnd.code")} />
          <Column header={t("periodEnd.item")} body={(r) => <div><div>{r.label}</div><div className="pe-muted">{r.description}</div></div>} />
          <Column header={t("periodEnd.type")} body={(r) => t(`periodEnd.itemType.${r.itemType}`)} />
          <Column header={t("periodEnd.severity")} body={(r) => <StatusTag status={r.severity === "blocking" ? "failed" : "warning"} />} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.active ? "active" : "inactive"} />} />
          <Column header={t("periodEnd.actions")} body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-pencil" text size="small" onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, description: r.description || "" } })} aria-label={t("periodEnd.edit")} tooltip={t("periodEnd.edit")} tooltipOptions={{ position: "top" }} />
              {!r.isSystem && <Button icon="pi pi-trash" text size="small" severity="danger" onClick={() => remove(r)} aria-label={t("periodEnd.confirmations.deleteItem")} tooltip={t("periodEnd.confirmations.deleteItem")} tooltipOptions={{ position: "top" }} />}
            </div>
          )} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("periodEnd.addItem") : t("periodEnd.editItem", { name: v.label || v.code })) : ""} visible={!!editing} style={{ width: "min(620px, 95vw)" }} onHide={() => setEditing(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("periodEnd.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.label} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("periodEnd.code")} *</label>
              {editing.isNew && v.itemType === "auto"
                ? <Dropdown value={v.code} options={data.autoChecks.map((c) => ({ label: c, value: c }))} onChange={(e) => setValue({ code: e.value })} className="w-full" />
                : <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => setValue({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} className="w-full" />}
            </div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.type")}</label>
              <Dropdown value={v.itemType} disabled={!editing.isNew} options={["manual", "auto"].map((x) => ({ label: t(`periodEnd.itemType.${x}`), value: x }))} onChange={(e) => setValue({ itemType: e.value, code: "" })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.severity")}</label>
              <Dropdown value={v.severity} options={["blocking", "warning"].map((x) => ({ label: t(`periodEnd.severityValue.${x}`), value: x }))} onChange={(e) => setValue({ severity: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("periodEnd.item")} *</label><InputText value={v.label} onChange={(e) => setValue({ label: e.target.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("periodEnd.description")}</label><InputTextarea value={v.description} onChange={(e) => setValue({ description: e.target.value })} rows={2} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("periodEnd.order")}</label><InputNumber value={v.sortOrder} onValueChange={(e) => setValue({ sortOrder: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-8 flex align-items-center gap-2 mt-4"><Checkbox inputId="cl-active" checked={!!v.active} onChange={(e) => setValue({ active: e.checked })} /><label htmlFor="cl-active" className="m-0">{t("periodEnd.status.active")}</label></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default CloseChecklist;
