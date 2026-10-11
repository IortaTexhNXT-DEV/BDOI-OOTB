import React, { useCallback, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import CommissionService from "../../../services/commissionService";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import EligibilityNote from "../../../components/EligibilityNote";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { openConfirm } from "../../../components/ConfirmDialog";
import { hasPermission } from "../../../utils/canOpen";
import { formatAmount } from "../utils/formatAmount";
import "./style.scss";

const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`);

/**
 * Commission breakdown of a policy (TIS-BRD-COMM-06): per peril the sum insured, premium, issuing, insurer net and
 * TIS remitting rates, the insurer remitting amount, the commission and the variance share; the gross commission, the
 * shares of the scheme and what TISPH keeps; the remittance and billing statement that carry the policy. Read only;
 * Recompute (write:remittance) reads the rules register again while the policy is on no approved remittance.
 */
const CommissionBreakdown = ({ policyId }) => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`commissionBreakdown.${key}`, opts);
  const toast = useRef(null);
  const [version, setVersion] = useState(0);
  const loader = useCallback(() => CommissionService.policyBreakdown(policyId).then((d) => d?.data || d), [policyId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error } = useStableLoad(loader, { enabled: !!policyId });
  const canRecompute = hasPermission("write:remittance");

  const recompute = async () => {
    const ok = await openConfirm({
      title: k("recomputeTitle", { policy: data?.policyNumber }), message: k("recomputeMessage"),
      facts: [{ label: k("grossCommission"), value: data?.basis?.grossCommission, type: "amount" }], confirmLabel: k("recompute"),
      onConfirm: () => CommissionService.recomputePolicy(policyId).then((r) => { toast.current?.show({ severity: "success", summary: k("title"), detail: r?.data?.message || r?.message, life: 5000 }); }),
    });
    if (ok) setVersion((v) => v + 1);
  };

  if (loading && !data) return <p className="cb__muted">{t("common.loading", { defaultValue: "Loading" })}</p>;
  if (error || !data) return <p className="cb__muted">{k("unavailable")}</p>;
  const b = data.basis || {};
  const perPeril = b.rateBasis === "issuing-remitting";
  const perils = (b.perils || []).filter((p) => p.code !== "ALL");
  const statusCode = b.status === "rates-missing" ? "on-hold" : "approved";
  return (
    <div className="cb">
      <Toast ref={toast} />
      <div className="cb__head">
        <StatusChip code={statusCode} label={b.status === "rates-missing" ? k("ratesMissing") : k("rated")} />
        {b.ruleLevel ? <span className="cb__muted">{k("ruleApplied", { level: b.ruleLevel, version: b.ruleVersion || 1 })}</span> : null}
        {data.remittance ? <span className="cb__muted">{k("onRemittance", { number: data.remittance })}</span> : null}
        {data.billingStatement ? <span className="cb__muted">{k("onStatement", { number: data.billingStatement })}</span> : null}
        {canRecompute ? <Button label={k("recompute")} icon="pi pi-refresh" size="small" outlined className="cb__recompute" disabled={!data.recompute?.allowed} onClick={recompute} /> : null}
      </div>
      {!data.recompute?.allowed && data.recompute?.reason ? <EligibilityNote id={`cb-${policyId}`} reason={data.recompute.reason} /> : null}
      {perPeril ? (
        <DataTable value={perils} dataKey="code" size="small" className="cb__perils" responsiveLayout="scroll">
          <Column field="name" header={k("peril")} />
          <Column header={k("sumInsured")} body={(p) => (p.sumInsured ? formatAmount(p.sumInsured) : "—")} className="bv-num" headerClassName="bv-num" />
          <Column header={k("premium")} body={(p) => formatAmount(p.premium)} className="bv-num" headerClassName="bv-num" />
          <Column header={k("issuing")} body={(p) => pct(p.issuing)} className="bv-num" headerClassName="bv-num" />
          <Column header={k("insurerNet")} body={(p) => (p.basis === "premium-pct" ? pct(p.commissionPct) : pct(p.insurerNet))} className="bv-num" headerClassName="bv-num" />
          <Column header={k("insurerRemitting")} body={(p) => formatAmount(p.insurerRemitting)} className="bv-num" headerClassName="bv-num" />
          <Column header={k("commission")} body={(p) => <span className={p.commission < 0 ? "cb__negative" : undefined}>{formatAmount(p.commission)}</span>} className="bv-num" headerClassName="bv-num" />
          <Column header={k("tisRemitting")} body={(p) => pct(p.tisRemitting)} className="bv-num" headerClassName="bv-num" />
          <Column header={k("varianceShare")} body={(p) => (p.varianceShare ? formatAmount(p.varianceShare) : "—")} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      ) : null}
      <KeyValueGrid columns={4} items={[
        { label: k("netPremium"), value: b.netPremium, type: "amount" },
        { label: k("rateOfNetPremium"), value: pct(b.rate), hidden: perPeril },
        { label: k("insurerRemittingTotal"), value: b.insurerRemitting, type: "amount" },
        { label: k("grossCommission"), value: b.grossCommission, type: "amount" },
        { label: k("varianceShare"), value: b.varianceShare, type: "amount", hidden: !perPeril },
        { label: k("scheme"), value: b.scheme ? `${b.scheme.code} · ${b.scheme.name}` : k("noScheme") },
        { label: k("shared"), value: b.sharedTotal ?? 0, type: "amount" },
        { label: k("retained"), value: b.retained, type: "amount" },
        { label: k("settlementBasis"), value: data.settlementBasis ? k(`basis.${data.settlementBasis}`, { defaultValue: data.settlementBasis }) : null },
      ]} />
      {(b.shares || []).length ? (
        <DataTable value={b.shares} dataKey="lineNo" size="small" className="cb__shares" responsiveLayout="scroll">
          <Column field="name" header={k("paidTo")} />
          <Column header={k("shareBasis")} body={(s) => `${t(`sharingSchemes.bases.${s.basis}`, { defaultValue: s.basis })}${s.note ? ` (${s.note})` : ""}`} />
          <Column header={k("shareValue")} body={(s) => `${s.value}${s.basis === "variance" ? " pt" : s.basis === "fixed" ? "" : "%"}${s.max !== null && s.max !== undefined ? ` (${s.min ?? 0}–${s.max})` : ""}`} />
          <Column header={k("shareAmount")} body={(s) => formatAmount(s.amount)} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      ) : null}
      {(b.warnings || []).length ? <ul className="cb__warnings">{b.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
    </div>
  );
};

CommissionBreakdown.propTypes = { policyId: PropTypes.string };
CommissionBreakdown.defaultProps = { policyId: null };

export default CommissionBreakdown;
