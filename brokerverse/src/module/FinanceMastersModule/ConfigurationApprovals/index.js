import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import postingRulesService from "../../../services/postingRulesService";
import { openConfirm } from "../../../components/ConfirmDialog";
import { isInitiator } from "../../../components/ApprovalActions";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import { humanize } from "../../../components/ActivityLog";
import { formatInstant } from "../../../utility/dateFormat";
import "../PostingRules/index.scss";

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "all"];
const SEVERITY = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "secondary" };
const MIN_REASON = 5;

const plain = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(plain).join(", ");
  if (typeof v === "object") return Object.entries(v).map(([k, x]) => `${humanize(k)} ${plain(x)}`).join(", ");
  return String(v);
};

/** A requested or previous configuration value: one line per setting, its name in words. */
const ChangeValue = ({ value }) => {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object" || Array.isArray(value)) return plain(value);
  return (
    <dl className="config-approvals__values">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{humanize(k)}</dt>
          <dd>{plain(v)}</dd>
        </div>
      ))}
    </dl>
  );
};

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

  const requested = (r) => (r.kind === "commission-taxes" ? r.payload?.body : r.payload);

  const factsOf = (r) => [
    { label: t("postingRules.changeKind"), value: r.kindLabel },
    { label: t("postingRules.changeTarget"), value: r.target },
    { label: t("postingRules.version"), value: r.rule ? `v${r.rule.version}` : null, hidden: !r.rule },
    { label: t("postingRules.effectiveFrom"), value: r.rule?.effectiveFrom, type: "date", hidden: !r.rule },
    { label: t("postingRules.requestedBy"), value: r.requestedBy },
    { label: t("postingRules.requestedAt"), value: r.requestedAt, type: "datetime" },
  ];

  const ask = (r, action) => {
    const common = { facts: factsOf(r), message: t(`postingRules.confirm.${action}Message`) };
    if (action === "approve") {
      return openConfirm({ ...common, title: t("postingRules.confirm.approveTitle"), severity: "neutral", confirmLabel: t("postingRules.confirm.approveAction"),
        note: t("postingRules.confirm.approveNote"), input: { type: "textarea", label: t("postingRules.approveRemarks"), maxLength: 500 } });
    }
    if (action === "reject") {
      return openConfirm({ ...common, title: t("postingRules.confirm.rejectTitle"), severity: "danger", confirmLabel: t("postingRules.confirm.rejectAction"),
        input: { type: "textarea", label: t("postingRules.rejectReason"), required: true, minLength: MIN_REASON, maxLength: 500 } });
    }
    return openConfirm({ ...common, title: t("postingRules.confirm.withdrawTitle"), severity: "warning", confirmLabel: t("postingRules.confirm.withdrawAction") });
  };

  const act = async (row, action) => {
    const answer = await ask(row, action);
    if (answer === null || answer === false) return;
    const remarks = typeof answer === "string" ? answer : undefined;
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

  const detail = (r) => (
    <div className="config-approvals__detail">
      <KeyValueGrid columns={4} items={[
        ...factsOf(r).filter((f) => !f.hidden),
        { label: t("postingRules.changeNote"), value: r.changeNote, hidden: !r.changeNote, span: "full" },
        { label: t("postingRules.decidedBy"), value: r.decidedBy, hidden: !r.decidedBy },
        { label: t("postingRules.decidedAt"), value: r.decidedAt, type: "datetime", hidden: !r.decidedAt },
        { label: t("postingRules.decisionRemarks"), value: r.decisionRemarks, hidden: !r.decisionRemarks, span: 2 },
      ]} />
      {r.rule ? (
        <DataTable value={r.rule.lines} size="small" dataKey="lineNo" className="mt-3">
          <Column field="lineNo" header="#" />
          <Column header={t("postingRules.side")} body={(l) => (l.side === "Cr" || l.side === "credit" ? t("postingRules.credit") : t("postingRules.debit"))} />
          <Column header={t("postingRules.account")} body={(l) => `${l.account}${l.fallbackRole ? ` (${humanize(l.fallbackRole)})` : ""}`} />
          <Column header={t("postingRules.accountSource")} body={(l) => humanize(l.accountType)} />
          <Column header={t("postingRules.amount")} body={(l) => humanize(l.amountKey)} />
          <Column field="narration" header={t("postingRules.lineNarration")} />
        </DataTable>
      ) : null}
    </div>
  );

  const actions = (r) => {
    if (r.status !== "pending") return null;
    const own = isInitiator({ id: r.requestedById });
    const blocked = own ? t("makerChecker.ownRecord") : undefined;
    return (
      <div className="flex gap-1">
        <span title={blocked}>
          <Button icon="pi pi-check" className="p-button-text p-button-sm" tooltip={blocked ? undefined : t("postingRules.approve")} disabled={own}
            onClick={() => act(r, "approve")} aria-label={t("postingRules.approve")} />
        </span>
        <span title={blocked}>
          <Button icon="pi pi-times" className="p-button-text p-button-danger p-button-sm" tooltip={blocked ? undefined : t("postingRules.reject")} disabled={own}
            onClick={() => act(r, "reject")} aria-label={t("postingRules.reject")} />
        </span>
        <Button icon="pi pi-undo" className="p-button-text p-button-sm" tooltip={t("postingRules.withdraw")} onClick={() => act(r, "withdraw")} aria-label={t("postingRules.withdraw")} />
      </div>
    );
  };

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
          <Column expander style={{ width: "3rem" }} />
          <Column field="id" header="#" />
          <Column field="kindLabel" header={t("postingRules.changeKind")} />
          <Column field="target" header={t("postingRules.changeTarget")} />
          <Column header={t("postingRules.changeBefore")} body={(r) => <ChangeValue value={r.before} />} />
          <Column header={t("postingRules.changeAfter")} body={(r) => <ChangeValue value={requested(r)} />} />
          <Column header={t("postingRules.requested")} body={(r) => (
            <div className="config-approvals__who">
              <span>{r.requestedBy || "—"}</span>
              <small>{formatInstant(r.requestedAt)}</small>
            </div>
          )} />
          <Column header={t("postingRules.status")} body={(r) => <StatusChip code={r.status} label={t(`postingRules.approval.${r.status}`)} severity={SEVERITY[r.status]} />} />
          <Column header={t("postingRules.decided")} body={(r) => (r.decidedBy ? (
            <div className="config-approvals__who">
              <span>{r.decidedBy}</span>
              <small>{formatInstant(r.decidedAt)}</small>
              {r.decisionRemarks ? <small>{r.decisionRemarks}</small> : null}
            </div>
          ) : "—")} />
          <Column body={actions} />
        </DataTable>
      </div>
    </div>
  );
};

export default ConfigurationApprovals;
