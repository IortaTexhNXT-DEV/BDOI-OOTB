import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import DetailSection from "../../../components/DetailSection";
import DialogFooter from "../../../components/DialogFooter";
import ImportDialog from "../../../components/ImportDialog";
import InputField from "../../../components/InputField";
import LoadingBar from "../../../components/LoadingBar";
import PageActions from "../../../components/PageActions";
import PageHeader from "../../../components/PageHeader";
import StatusChip from "../../../components/StatusChip";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { formatCurrency, numberLocale } from "../../../utility/currencyConverter";
import { hasPermission } from "../../../utils/canOpen";
import { notifyError } from "../../../utility/dialogs";
import { showSuccess } from "../../Remittance/shared";
import { APPROVE, WRITE } from "../common";
import "../incentive.scss";

const STATUSES = ["draft", "pending-approval", "approved", "superseded", "withdrawn"];
const SEVERITY = { draft: "secondary", "pending-approval": "warning", approved: "success", superseded: "secondary", withdrawn: "secondary" };

/** Months from six back to twelve ahead: { label: "November 2026", value: "2026-11" }. */
export const targetMonths = (now = new Date()) => Array.from({ length: 19 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() + 12 - i, 1);
  return { label: d.toLocaleDateString(numberLocale(), { month: "long", year: "numeric" }), value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
});

const EMPTY = { scope: "agent", agentId: null, salesUnitId: null, period: null, targetAmount: null, remarks: "" };

/**
 * Master > Finance > Sales Targets (TIS-BRD-RPT-02): the commission target of each agent or sales unit per month. A
 * target is added or uploaded as a draft, sent for approval and approved (or returned with a note) by a second user;
 * only approved targets count in Agent Policy Conversion (Target, Variance) and Sales Target Variance.
 */
const SalesTargets = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(null);
  const [importing, setImporting] = useState(false);
  const canWrite = hasPermission(WRITE);
  const canApprove = hasPermission(APPROVE);
  const months = useMemo(() => targetMonths(), []);

  const loader = useCallback(() => Promise.all([incentiveService.listSalesTargets({ status: status || undefined, search: search.trim() || undefined }),
    incentiveService.salesTargetOptions()]).then(([rows, options]) => ({ rows: rows || [], options: options || { agents: [], salesUnits: [] } })), [status, search]);
  const { data, loading, refreshing, reload } = useStableLoad(loader);
  const rows = data?.rows || [];
  const options = data?.options || { agents: [], salesUnits: [] };
  const drafts = selected.filter((r) => r.status === "draft");
  const pending = selected.filter((r) => r.status === "pending-approval");

  const run = async (fn, message) => {
    try {
      await fn();
      setSelected([]);
      await reload();
      if (message) showSuccess(toast, message);
      return true;
    } catch (e) {
      notifyError(e.message);
      return false;
    }
  };
  const save = async () => {
    setSaving(true);
    const body = { scope: form.scope, agentId: form.scope === "agent" ? form.agentId : undefined, salesUnitId: form.scope === "unit" ? form.salesUnitId : undefined,
      period: form.period, targetAmount: form.targetAmount, remarks: form.remarks };
    const done = await run(() => (form.id ? incentiveService.updateSalesTarget(form.id, body) : incentiveService.createSalesTarget(body)), t("salesTargets.saved"));
    setSaving(false);
    if (done) setForm(null);
  };
  const decide = (list, decision, note) => run(() => incentiveService.decideSalesTargets(list.map((r) => r.id), decision, note),
    decision === "approve" ? t("salesTargets.approved") : t("salesTargets.returned"));

  const actions = (
    <PageActions onUpload={canWrite ? () => setImporting(true) : null} onAdd={canWrite ? () => setForm({ ...EMPTY }) : null} addLabel={t("salesTargets.add")}>
      {canWrite && drafts.length ? (
        <Button type="button" icon="pi pi-send" outlined label={t("salesTargets.submit", { count: drafts.length })}
          onClick={() => run(() => incentiveService.submitSalesTargets(drafts.map((r) => r.id)), t("salesTargets.submitted"))} />
      ) : null}
      {canApprove && pending.length ? (
        <>
          <Button type="button" icon="pi pi-undo" outlined label={t("salesTargets.return")} onClick={() => setReturning({ list: pending, note: "" })} />
          <Button type="button" icon="pi pi-check" outlined label={t("salesTargets.approve", { count: pending.length })} onClick={() => decide(pending, "approve")} />
        </>
      ) : null}
    </PageActions>
  );

  return (
    <div className="inc-page">
      <Toast ref={toast} />
      <PageHeader title={t("salesTargets.title")} home={t("sidebar.Master")} section={t("sidebar.Finance")} trail={[t("salesTargets.title")]}
        help={t("salesTargets.help")} actions={actions} />
      <DetailSection className="bv-loading-host" flush>
        <LoadingBar active={refreshing} />
        <div className="inc-filters">
          <InputField placeholder={t("salesTargets.search")} value={search} onChange={(e) => setSearch(e.target.value)} icon={<SvgSearchIcon />} aria-label={t("salesTargets.search")} />
          <Dropdown value={status} options={STATUSES.map((s) => ({ label: t(`salesTargets.status.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} showClear
            placeholder={t("salesTargets.inForceAndOpen")} aria-label={t("salesTargets.statusLabel")} />
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} paginator={rows.length > 20} rows={20} size="small" className="inc-table"
          selectionMode="checkbox" selection={selected} onSelectionChange={(e) => setSelected(e.value)} emptyMessage={t("salesTargets.empty")}>
          <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
          <Column header={t("salesTargets.month")} body={(r) => months.find((m) => m.value === r.period)?.label || r.period} className="bv-nowrap" />
          <Column header={t("salesTargets.targetFor")} body={(r) => (r.scope === "agent" ? t("salesTargets.agent") : t("salesTargets.salesUnit"))} />
          <Column header={t("salesTargets.name")} body={(r) => <strong>{r.name}</strong>} />
          <Column header={t("salesTargets.amount")} body={(r) => formatCurrency(r.targetAmount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("salesTargets.remarks")} body={(r) => r.decisionNote || r.remarks || "-"} />
          <Column header={t("salesTargets.statusLabel")} body={(r) => <StatusChip label={t(`salesTargets.status.${r.status}`)} severity={SEVERITY[r.status]} />} />
          <Column header={t("salesTargets.actions")} body={(r) => (r.status === "draft" && canWrite ? (
            <div className="bv-row-actions">
              <Button type="button" icon="pi pi-pencil" text rounded aria-label={t("common.edit", "Edit")} tooltip={t("common.edit", "Edit")}
                onClick={() => setForm({ id: r.id, scope: r.scope, agentId: r.agentId, salesUnitId: r.salesUnitId, period: r.period, targetAmount: r.targetAmount, remarks: r.remarks || "" })} />
              <Button type="button" icon="pi pi-times" text rounded severity="danger" aria-label={t("salesTargets.withdraw")} tooltip={t("salesTargets.withdraw")}
                onClick={() => run(() => incentiveService.withdrawSalesTarget(r.id), t("salesTargets.withdrawn"))} />
            </div>
          ) : null)} style={{ width: "6rem" }} />
        </DataTable>
      </DetailSection>

      <Dialog visible={!!form} onHide={() => setForm(null)} header={form?.id ? t("salesTargets.editTitle") : t("salesTargets.addTitle")} style={{ width: "32rem" }}
        footer={<DialogFooter onClose={() => setForm(null)} closeLabel={t("common.cancel", "Cancel")} primary={{ label: t("salesTargets.save"), icon: "pi pi-check", onClick: save, loading: saving }} />}>
        {form ? (
          <div className="inc-target-form">
            <label htmlFor="st-scope">{t("salesTargets.targetFor")}</label>
            <Dropdown inputId="st-scope" value={form.scope} options={[{ label: t("salesTargets.agent"), value: "agent" }, { label: t("salesTargets.salesUnit"), value: "unit" }]}
              onChange={(e) => setForm({ ...form, scope: e.value })} />
            {form.scope === "agent" ? (
              <>
                <label htmlFor="st-agent">{t("salesTargets.agent")}</label>
                <Dropdown inputId="st-agent" value={form.agentId} options={options.agents.map((a) => ({ label: `${a.name} (${a.payeeType})`, value: a.id }))} filter
                  onChange={(e) => setForm({ ...form, agentId: e.value })} placeholder={t("salesTargets.chooseAgent")} />
              </>
            ) : (
              <>
                <label htmlFor="st-unit">{t("salesTargets.salesUnit")}</label>
                <Dropdown inputId="st-unit" value={form.salesUnitId} options={options.salesUnits.map((u) => ({ label: u.name, value: u.id }))} filter
                  onChange={(e) => setForm({ ...form, salesUnitId: e.value })} placeholder={t("salesTargets.chooseUnit")} />
              </>
            )}
            <label htmlFor="st-month">{t("salesTargets.month")}</label>
            <Dropdown inputId="st-month" value={form.period} options={months} onChange={(e) => setForm({ ...form, period: e.value })} placeholder={t("salesTargets.chooseMonth")} />
            <label htmlFor="st-amount">{t("salesTargets.amount")}</label>
            <InputNumber inputId="st-amount" value={form.targetAmount} onValueChange={(e) => setForm({ ...form, targetAmount: e.value })} mode="decimal" prefix="₱ "
              minFractionDigits={2} maxFractionDigits={2} min={0} />
            <label htmlFor="st-remarks">{t("salesTargets.remarks")}</label>
            <InputTextarea id="st-remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} maxLength={250} />
          </div>
        ) : null}
      </Dialog>

      <Dialog visible={!!returning} onHide={() => setReturning(null)} header={t("salesTargets.returnTitle")} style={{ width: "28rem" }}
        footer={<DialogFooter onClose={() => setReturning(null)} closeLabel={t("common.cancel", "Cancel")}
          primary={{ label: t("salesTargets.return"), icon: "pi pi-undo",
            onClick: async () => { if (await decide(returning.list, "return", returning.note)) setReturning(null); } }} />}>
        {returning ? (
          <div className="inc-target-form">
            <label htmlFor="st-note">{t("salesTargets.returnNote")}</label>
            <InputTextarea id="st-note" value={returning.note} onChange={(e) => setReturning({ ...returning, note: e.target.value })} rows={3} />
          </div>
        ) : null}
      </Dialog>

      <ImportDialog visible={importing} onHide={() => setImporting(false)} title={t("salesTargets.uploadTitle")}
        targets={[incentiveService.salesTargetUploadTarget(t("salesTargets.title"))]} help={t("salesTargets.uploadHelp")}
        onDone={() => { setImporting(false); reload(); }} />
    </div>
  );
};

export default SalesTargets;
