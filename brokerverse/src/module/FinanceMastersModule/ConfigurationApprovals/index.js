import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import postingRulesService from "../../../services/postingRulesService";
import { promptText } from "../../../utility/dialogs";
import "../PostingRules/index.scss";

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "all"];
const SEVERITY = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "secondary" };
const when = (v) => (v ? new Date(v).toLocaleString("en-PH") : "");
const show = (v) => (v === null || v === undefined ? "-" : typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : x}`).join(", ") : String(v));

/**
 * Master > Finance > Configuration Approvals: posting rule versions, their activation and account determination changes
 * waiting for a second user (approve:posting-rules). The requester cannot approve their own change.
 */
const ConfigurationApprovals = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await postingRulesService.changes(status));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("postingRules.error"), detail: e.message, life: 7000 });
    } finally {
      setLoading(false);
    }
  }, [status, t]);
  useEffect(() => { load(); }, [load]);

  const act = async (row, action) => {
    let remarks;
    if (action !== "withdraw") {
      remarks = await promptText(action === "approve" ? t("postingRules.approveRemarks") : t("postingRules.rejectReason"));
      if (remarks === null) return;
    }
    try {
      const call = { approve: () => postingRulesService.approveChange(row.id, remarks), reject: () => postingRulesService.rejectChange(row.id, remarks),
        withdraw: () => postingRulesService.withdrawChange(row.id) }[action];
      const out = await call();
      toast.current?.show({ severity: "success", summary: t("postingRules.saved"), detail: t("postingRules.changeDecided", { id: out.id, status: t(`postingRules.approval.${out.status}`) }), life: 4000 });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("postingRules.error"), detail: e.message, life: 7000 });
    }
  };

  const detail = (r) => (r.rule ? (
    <div className="p-2">
      <div className="mb-2">{r.rule.event} · v{r.rule.version} · {t("postingRules.effectiveFrom")} {r.rule.effectiveFrom}{r.changeNote ? ` · ${r.changeNote}` : ""}</div>
      <DataTable value={r.rule.lines} size="small" dataKey="lineNo">
        <Column field="lineNo" header="#" />
        <Column field="side" header={t("postingRules.side")} />
        <Column header={t("postingRules.account")} body={(l) => `${l.accountType}: ${l.account}${l.fallbackRole ? ` (${l.fallbackRole})` : ""}`} />
        <Column field="amountKey" header={t("postingRules.amount")} />
        <Column field="narration" header={t("postingRules.lineNarration")} />
      </DataTable>
    </div>
  ) : null);

  return (
    <div className="account-determination">
      <Toast ref={toast} />
      <div className="posting-rules__title">{t("postingRules.approvalsTitle")}</div>
      <BreadCrumb home={{ label: t("postingRules.master") }} className="posting-rules__crumbs" separatorIcon={<SvgDot color={"#000"} />}
        model={[{ label: t("postingRules.finance") }, { label: t("postingRules.approvalsTitle"), url: "/master/finance/configuration-approvals" }]} />
      <div className="posting-rules__card">
        <Dropdown value={status} options={STATUSES.map((s) => ({ label: t(`postingRules.approval.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} className="mb-2 w-12rem" />
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("postingRules.noChanges")}
          expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)} rowExpansionTemplate={detail}>
          <Column expander={(r) => !!r.rule} style={{ width: "3rem" }} />
          <Column field="id" header="#" />
          <Column field="kindLabel" header={t("postingRules.changeKind")} />
          <Column field="target" header={t("postingRules.changeTarget")} />
          <Column header={t("postingRules.changeBefore")} body={(r) => show(r.before)} />
          <Column header={t("postingRules.changeAfter")} body={(r) => show(r.kind === "commission-taxes" ? r.payload.body : r.payload)} />
          <Column header={t("postingRules.requested")} body={(r) => `${r.requestedBy || ""} ${when(r.requestedAt)}`} />
          <Column header={t("postingRules.status")} body={(r) => (
            <span><Tag value={t(`postingRules.approval.${r.status}`)} severity={SEVERITY[r.status]} />{r.decidedBy ? ` ${r.decidedBy}` : ""}{r.decisionRemarks ? `: ${r.decisionRemarks}` : ""}</span>
          )} />
          <Column body={(r) => (r.status === "pending" ? (
            <div className="flex gap-1">
              <Button icon="pi pi-check" className="p-button-text p-button-success p-button-sm" tooltip={t("postingRules.approve")} onClick={() => act(r, "approve")} aria-label={t("postingRules.approve")} />
              <Button icon="pi pi-times" className="p-button-text p-button-danger p-button-sm" tooltip={t("postingRules.reject")} onClick={() => act(r, "reject")} aria-label={t("postingRules.reject")} />
              <Button icon="pi pi-undo" className="p-button-text p-button-sm" tooltip={t("postingRules.withdraw")} onClick={() => act(r, "withdraw")} aria-label={t("postingRules.withdraw")} />
            </div>
          ) : null)} />
        </DataTable>
      </div>
    </div>
  );
};

export default ConfigurationApprovals;
