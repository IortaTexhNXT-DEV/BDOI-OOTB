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
import bankReconciliationService from "../../services/bankReconciliationService";
import { BrTag, PageHeader, showError, showSuccess } from "./common";

const EMPTY = { code: "", name: "", description: "", direction: "debit", action: "journal", accountRole: "", glAccountCode: "", allowAccountOverride: false, requiresApproval: false, matchPattern: "", active: true, sortOrder: 100 };

/**
 * Master > Finance > Bank Transaction Types: unrecorded bank items (bank charges, interest, final tax, returned cheques,
 * direct credits) with the account role or GL account their adjustment posts to, approval, and the description pattern
 * that suggests the type on imported lines. The automatic matching rules are listed below (order, window, active).
 */
const TransactionTypes = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [data, setData] = useState({ items: [], accountRoles: [] });
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [types, r] = await Promise.all([bankReconciliationService.transactionTypes(), bankReconciliationService.matchRules()]);
      setData(types);
      setRules(r);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const v = editing?.values;
  const set = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const save = async () => {
    try {
      const body = { name: v.name, description: v.description || null, direction: v.direction, action: v.action, accountRole: v.accountRole || null, glAccountCode: v.glAccountCode || null,
        allowAccountOverride: !!v.allowAccountOverride, requiresApproval: !!v.requiresApproval, matchPattern: v.matchPattern || null, active: !!v.active, sortOrder: v.sortOrder };
      if (editing.isNew) await bankReconciliationService.addTransactionType({ code: v.code, ...body });
      else await bankReconciliationService.updateTransactionType(v.code, body);
      showSuccess(toast, v.name);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const saveRule = async (rule, patch) => {
    try {
      await bankReconciliationService.updateMatchRule(rule.code, patch);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const roleAccount = (role) => data.accountRoles.find((r) => r.role === role)?.accountCode;

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader master title={t("bankReconciliation.transactionTypes")} trail={[t("bankReconciliation.transactionTypes")]} subtitle={t("bankReconciliation.typesHelp")}>
        <Button icon="pi pi-plus" label={t("bankReconciliation.addType")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
      </PageHeader>
      <div className="pe-card">
        <DataTable value={data.items} loading={loading} dataKey="code" size="small" stripedRows>
          <Column field="code" header={t("bankReconciliation.code")} />
          <Column header={t("bankReconciliation.name")} body={(r) => <div><div>{r.name}</div><div className="pe-muted">{r.description}</div></div>} />
          <Column header={t("bankReconciliation.directionLabel")} body={(r) => t(`bankReconciliation.direction.${r.direction}`)} />
          <Column header={t("bankReconciliation.posting")} body={(r) => (r.action === "returned-cheque" ? t("bankReconciliation.cancelReceipt")
            : r.glAccountCode || `${r.accountRole} (${roleAccount(r.accountRole) || "?"})`)} />
          <Column header={t("bankReconciliation.approval")} body={(r) => (r.requiresApproval ? <BrTag status="for-approval" value={t("bankReconciliation.required")} /> : "-")} />
          <Column field="matchPattern" header={t("bankReconciliation.matchPattern")} body={(r) => <code>{r.matchPattern || ""}</code>} />
          <Column header={t("bankReconciliation.status.label")} body={(r) => <BrTag status={r.active ? "active" : "inactive"} />} />
          <Column body={(r) => <Button icon="pi pi-pencil" text size="small" aria-label={t("bankReconciliation.edit")}
            onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, description: r.description || "", accountRole: r.accountRole || "", glAccountCode: r.glAccountCode || "", matchPattern: r.matchPattern || "" } })} />} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("bankReconciliation.matchRules")}</div>
        <p className="pe-muted mt-0">{t("bankReconciliation.matchRulesHelp")}</p>
        <DataTable value={rules} dataKey="code" size="small" stripedRows>
          <Column header={t("bankReconciliation.order")} body={(r) => <InputNumber value={r.sortOrder} onValueChange={(e) => e.value !== r.sortOrder && e.value !== null && saveRule(r, { sortOrder: e.value })} inputStyle={{ width: 70 }} />} />
          <Column header={t("bankReconciliation.rule")} body={(r) => <div><div>{r.name}</div><div className="pe-muted">{r.description}</div></div>} />
          <Column field="confidence" header={t("bankReconciliation.confidence")} body={(r) => `${r.confidence}%`} />
          <Column header={t("bankReconciliation.dateWindow")} body={(r) => (["amount-date", "one-to-many", "many-to-one"].includes(r.ruleType)
            ? <InputNumber value={r.params?.dateWindowDays ?? null} placeholder={t("bankReconciliation.setting")} onValueChange={(e) => saveRule(r, { params: { ...r.params, dateWindowDays: e.value ?? undefined } })} inputStyle={{ width: 80 }} />
            : "-")} />
          <Column header={t("bankReconciliation.status.active")} body={(r) => <Checkbox checked={r.active} onChange={(e) => saveRule(r, { active: e.checked })} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("bankReconciliation.addType") : v.code) : ""} visible={!!editing} style={{ width: "min(720px, 96vw)" }} onHide={() => setEditing(null)}
        footer={(
          <div>
            <Button label={t("bankReconciliation.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("bankReconciliation.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.name || (v?.action === "journal" && !v?.accountRole && !v?.glAccountCode)} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.code")} *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className="w-full" /></div>
            <div className="col-12 md:col-9"><label>{t("bankReconciliation.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("bankReconciliation.description")}</label><InputTextarea value={v.description} rows={2} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("bankReconciliation.directionLabel")}</label>
              <Dropdown value={v.direction} options={["debit", "credit"].map((x) => ({ label: t(`bankReconciliation.direction.${x}`), value: x }))} onChange={(e) => set({ direction: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("bankReconciliation.action")}</label>
              <Dropdown value={v.action} options={["journal", "returned-cheque"].map((x) => ({ label: t(`bankReconciliation.actionValue.${x}`), value: x }))} onChange={(e) => set({ action: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("bankReconciliation.order")}</label><InputNumber value={v.sortOrder} onValueChange={(e) => set({ sortOrder: e.value })} className="w-full" /></div>
            {v.action === "journal" && (
              <>
                <div className="col-12 md:col-6"><label>{t("bankReconciliation.accountRole")}</label>
                  <Dropdown value={v.accountRole} showClear filter options={data.accountRoles.map((r) => ({ label: `${r.role} (${r.accountCode})`, value: r.role }))} onChange={(e) => set({ accountRole: e.value || "" })} className="w-full" /></div>
                <div className="col-12 md:col-6"><label>{t("bankReconciliation.orGlAccount")}</label><InputText value={v.glAccountCode} onChange={(e) => set({ glAccountCode: e.target.value })} className="w-full" /></div>
              </>
            )}
            <div className="col-12"><label>{t("bankReconciliation.matchPattern")}</label><InputText value={v.matchPattern} onChange={(e) => set({ matchPattern: e.target.value })} className="w-full" placeholder="service charge|svc chg" /></div>
            <div className="col-12 flex gap-4 flex-wrap">
              <span className="flex align-items-center gap-2"><Checkbox inputId="bt-over" checked={!!v.allowAccountOverride} onChange={(e) => set({ allowAccountOverride: e.checked })} /><label htmlFor="bt-over" className="m-0">{t("bankReconciliation.allowOverride")}</label></span>
              <span className="flex align-items-center gap-2"><Checkbox inputId="bt-appr" checked={!!v.requiresApproval} onChange={(e) => set({ requiresApproval: e.checked })} /><label htmlFor="bt-appr" className="m-0">{t("bankReconciliation.requiresApproval")}</label></span>
              <span className="flex align-items-center gap-2"><Checkbox inputId="bt-active" checked={!!v.active} onChange={(e) => set({ active: e.checked })} /><label htmlFor="bt-active" className="m-0">{t("bankReconciliation.status.active")}</label></span>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default TransactionTypes;
