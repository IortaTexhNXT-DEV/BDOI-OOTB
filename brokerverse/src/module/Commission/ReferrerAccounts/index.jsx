import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import CommissionService from "../../../services/commissionService";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import LoadingBar from "../../../components/LoadingBar";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { hasPermission } from "../../../utils/canOpen";
import { formatAmount } from "../utils/formatAmount";
import "./style.scss";

const REQUEST_KINDS = ["rate", "reversal", "wht"];
const valueText = (r) => {
  const v = r.toValue || {};
  if (r.kind === "rate") return `${formatAmount(v.comsubFixed || 0)} + ${v.comsubPct ?? 0}%`;
  if (r.kind === "wht") return v.whtApplicable ? "Applied" : "Not applied";
  return "";
};

/**
 * Commission > Agents/Referrer Accounts: one account per payee (agent, sub-agent, TFS team member, referral, dealer)
 * with what is payable this cycle, its withholding tax, bank account and sharing scheme; and, for the approvers, the
 * rate change, reversal and withholding tax requests waiting for a decision.
 */
const ReferrerAccounts = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`referrerAccounts.${key}`, opts);
  const navigate = useNavigate();
  const toast = useRef(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(null);
  const [version, setVersion] = useState(0);
  const canDecide = hasPermission("approve:commission");
  const loader = useCallback(() => CommissionService.getReferrerAccounts().then((r) => r?.data || r), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, refreshing } = useStableLoad(loader);
  const requestsLoader = useCallback(() => (canDecide ? CommissionService.listRequests({ status: "pending" }).then((r) => r?.data || r || []) : Promise.resolve([])), [canDecide, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: requests } = useStableLoad(requestsLoader, { initialData: [] });
  const referrers = data?.referrers || [];
  const summary = data?.summary;

  const types = useMemo(() => [...new Set(referrers.map((r) => r.type).filter(Boolean))].sort().map((v) => ({ label: v, value: v })), [referrers]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return referrers.filter((r) => (!type || r.type === type) && (!q || String(r.name || "").toLowerCase().includes(q)));
  }, [referrers, search, type]);

  const decide = async (r, action) => {
    const ok = await openConfirm({
      title: k(`requests.${action}Title`, { policy: r.policyNumber }), severity: action === "reject" ? "warning" : "neutral", message: k(`requests.${action}Message`),
      facts: [
        { label: t("commissionLine.referrer"), value: r.referrerName },
        { label: k("requests.kind"), value: k(`requests.kinds.${r.kind}`) },
        { label: k("requests.requested"), value: valueText(r), hidden: !valueText(r) },
        { label: k("requests.reason"), value: r.reason },
        { label: k("requests.requestedBy"), value: r.requestedBy },
      ],
      input: { type: "textarea", label: k("requests.note"), required: action === "reject", minLength: action === "reject" ? 3 : undefined, maxLength: 500 },
      confirmLabel: k(`requests.${action}`),
      onConfirm: (note) => CommissionService.decideRequest(r.id, action, { note: note || undefined }),
    });
    if (!ok) return;
    toast.current?.show({ severity: "success", summary: k("requests.title"), detail: k(`requests.${action}Done`), life: 4000 });
    setVersion((v) => v + 1);
  };

  return (
    <div className="referrer-accounts-page">
      <Toast ref={toast} />
      <PageHeader title={k("title")} home={t("commissionLine.commission")} trail={[k("title")]} help={k("help")} />
      <StatCards items={[
        { key: "due", label: summary?.cycleLabel ? k("dueThisCycle", { cycle: summary.cycleLabel }) : k("dueThisCycleNoLabel"), value: summary ? formatAmount(summary.dueThisCycle) : undefined },
        { key: "ready", label: k("readyToPay"), value: summary ? formatAmount(summary.readyToPay) : undefined },
        { key: "payees", label: k("payees"), value: data ? referrers.length : undefined },
        ...(canDecide ? [{ key: "requests", label: k("requests.pending"), value: requests ? requests.length : undefined }] : []),
      ]} />

      {canDecide && requests?.length ? (
        <div className="referrer-card bv-loading-host">
          <h2 className="referrer-card__title">{k("requests.title")}</h2>
          <DataTable value={requests} dataKey="id" size="small" stripedRows className="referrer-table" emptyMessage={k("requests.none")}>
            <Column field="referrerName" header={t("commissionLine.referrer")} />
            <Column field="policyNumber" header={t("commissionLine.policy")} />
            <Column header={k("requests.kind")} body={(r) => k(`requests.kinds.${REQUEST_KINDS.includes(r.kind) ? r.kind : "rate"}`)} />
            <Column header={k("requests.requested")} body={valueText} />
            <Column field="reason" header={k("requests.reason")} />
            <Column field="requestedBy" header={k("requests.requestedBy")} />
            <Column header="" body={(r) => (
              <div className="flex gap-2">
                <Button label={k("requests.approve")} icon="pi pi-check" size="small" onClick={() => decide(r, "approve")} />
                <Button label={k("requests.reject")} icon="pi pi-times" size="small" outlined severity="danger" onClick={() => decide(r, "reject")} />
              </div>
            )} />
          </DataTable>
        </div>
      ) : null}

      <div className="referrer-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <div className="toolbar">
          <span className="p-input-icon-left search-wrap">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={k("search")} aria-label={k("search")} className="search-input" />
          </span>
          <Dropdown value={type} options={types} onChange={(e) => setType(e.value)} placeholder={k("allTypes")} showClear aria-label={k("type")} className="w-14rem" />
        </div>
        <DataTable value={filtered} dataKey="id" loading={loading && !data} size="small" stripedRows paginator rows={20} emptyMessage={k("empty")} className="referrer-table"
          rowClassName={() => "clickable-row"} onRowClick={(e) => navigate(`/commission/referrer-accounts/${e.data.id}`)}>
          <Column field="name" header={k("columns.referrer")} bodyClassName="name-cell" sortable />
          <Column field="type" header={k("columns.type")} sortable />
          <Column header={k("columns.level")} body={(r) => r.level || "—"} />
          <Column header={k("columns.scheme")} body={(r) => r.schemeCode || "—"} />
          <Column field="policies" header={k("columns.policies")} className="bv-num" headerClassName="bv-num" />
          <Column header={k("columns.netPayable")} body={(r) => <span className="net-payable">{formatAmount(r.netPayable)}</span>} className="bv-num" headerClassName="bv-num" sortable sortField="netPayable" />
          <Column header={k("columns.wht")} body={(r) => (r.whtApplicable === false ? t("commissionLine.whtState.off") : r.whtType)} />
          <Column header={k("columns.bank")} body={(r) => r.bankAccount || <StatusChip code="on-hold" label={t("commissionLine.notOnFile")} />} />
          <Column header={k("columns.status")} body={(r) => <StatusChip code={String(r.status || "").toLowerCase()} label={r.status} />} />
        </DataTable>
      </div>
    </div>
  );
};

export default ReferrerAccounts;
