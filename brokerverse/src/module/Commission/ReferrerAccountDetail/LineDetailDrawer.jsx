import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import CommissionService from "../../../services/commissionService";
import { formatAmount } from "../utils/formatAmount";
import { currencySymbol } from "../../../utility/currencyConverter";
import logger from "../../../utility/logger";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import StatusChip from "../../../components/StatusChip";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { hasPermission } from "../../../utils/canOpen";

// the actions of a line by its status: the service call and whether it is destructive
const ACTIONS = {
  eligible: { call: CommissionService.markLineEligible, when: ["Accrued"] },
  approve: { call: CommissionService.approveLine, when: ["Eligible"] },
  pay: { call: CommissionService.payLine, when: ["Approved"] },
  reverse: { call: CommissionService.reverseLine, when: ["Accrued", "Eligible", "Approved"], danger: true },
};
// the requests a second user approves (commission.adjustment_approval_required): their reason context and when they apply
const REQUESTS = {
  rate: { context: "commission_rate_change", when: ["Accrued", "Eligible"] },
  reversal: { context: "commission_reversal", when: ["Accrued", "Eligible", "Approved", "Paid"] },
};

const chargesOf = (line) => {
  const value = Math.round((Number(line.grossPremium || 0) - Number(line.discountAmount || 0) - Number(line.netPremium || 0)) * 100) / 100;
  return value > 0 ? value : 0;
};
const shareUnit = (basis) => (basis === "variance" ? " pt" : basis === "fixed" ? "" : "%");

const LineDetailDrawer = ({
  visible,
  onHide,
  referrerId,
  referrerName,
  whtApplicable,
  line,
  controls,
  onUpdated,
  onError,
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
  const [ratePct, setRatePct] = useState(null);
  const [rateFixed, setRateFixed] = useState(0);
  const [activityKey, setActivityKey] = useState(0);
  const [request, setRequest] = useState(null);
  const [share, setShare] = useState(null);

  useEffect(() => {
    if (!line) return;
    setRatePct(line.comsubPct ?? 0);
    setRateFixed(line.comsubFixed ?? 0);
    setRequest(null);
    setShare(null);
  }, [line]);

  if (!line) return null;

  const reviewed = !!controls?.adjustmentApproval;
  const pending = line.pendingRequest || null;
  const canEditRate = !reviewed && ["Eligible", "Approved"].includes(line.status);
  const canChangeShare = !!line.share && ["Accrued", "Eligible"].includes(line.status) && hasPermission("write:commission-share") && !pending;

  const runLineAction = async (fn, args) => {
    setActionLoading(true);
    try {
      const res =
        args === undefined ? await fn(referrerId, line.id) : await fn(...args);
      const payload = res?.data || res;
      setActivityKey((k) => k + 1);
      onUpdated?.(payload);
      return payload;
    } catch (err) {
      logger.error("Line action failed", err);
      onError?.(err);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // a reversal (a clawback once paid) is recorded with its reason
  const confirmAction = async (name) => {
    const action = ACTIONS[name];
    const ok = await openConfirm({
      title: t(`commissionLine.confirm.${name}Title`, { policy: line.policyNo }),
      severity: action.danger ? "danger" : "neutral",
      message: t(`commissionLine.confirm.${name}Message`),
      facts: [
        { label: t("commissionLine.referrer"), value: referrerName },
        { label: t("commissionLine.policy"), value: line.policyNo },
        { label: t("commissionLine.comsub"), value: line.comsub, type: "amount" },
        { label: t("commissionLine.wht"), value: line.wht, type: "amount" },
        { label: t("commissionLine.netPayable"), value: line.net, type: "amount", emphasis: true },
      ],
      input: name === "reverse" ? { type: "textarea", label: t("commissionLine.reverseReason"), required: true, minLength: 3, maxLength: 500 } : undefined,
      confirmLabel: t(`commissionLine.confirm.${name}`),
    });
    if (!ok) return;
    // with a field the answer is the reason typed in
    runLineAction(action.call, name === "reverse" ? [referrerId, line.id, ok] : undefined);
  };

  const applyRateOverride = async () => {
    const ok = await openConfirm({
      title: t("commissionLine.confirm.rateTitle", { policy: line.policyNo }),
      message: t("commissionLine.confirm.rateMessage"),
      facts: [
        { label: t("commissionLine.currentRate"), value: `${formatAmount(line.comsubFixed)} + ${line.comsubPct}%` },
        { label: t("commissionLine.newRate"), value: `${formatAmount(rateFixed)} + ${ratePct}%` },
        { label: t("commissionLine.netPremium"), value: line.netPremium, type: "amount" },
      ],
      confirmLabel: t("commissionLine.confirm.rate"),
    });
    if (!ok) return;
    runLineAction(CommissionService.updateLineRate, [
      referrerId,
      line.id,
      { comsubPct: ratePct, comsubFixed: rateFixed },
    ]);
  };

  // requests: the change waits for a second user holding approve:commission
  const openRequest = (kind) => setRequest({ kind, comsubPct: line.comsubPct ?? 0, comsubFixed: line.comsubFixed ?? 0, reason: null, tried: false });
  const sendRequest = async () => {
    if (reasonProblem(request.reason)) { setRequest((r) => ({ ...r, tried: true })); return; }
    const body = { kind: request.kind, ...reasonPayload(request.reason), ...(request.kind === "rate" ? { comsubPct: request.comsubPct, comsubFixed: request.comsubFixed } : {}) };
    const payload = await runLineAction(CommissionService.requestLineChange, [referrerId, line.id, body]);
    if (payload) setRequest(null);
  };
  const openShare = () => setShare({ value: line.share.value ?? 0, reason: null, tried: false });
  const sendShare = async () => {
    if (reasonProblem(share.reason)) { setShare((s) => ({ ...s, tried: true })); return; }
    const payload = await runLineAction(CommissionService.changeShare, [referrerId, line.id, { value: share.value, ...reasonPayload(share.reason) }]);
    if (payload) setShare(null);
  };

  const rows = [
    { key: "gross", label: t("commissionLine.grossPremium"), value: line.grossPremium },
    { key: "discount", label: t("commissionLine.discount", { label: line.discountLabel }), value: -Number(line.discountAmount || 0), muted: true },
    // the premium taxes and charges taken out of the gross, so gross less discount less charges is the net premium
    { key: "charges", label: t("commissionLine.taxesAndCharges"), value: -chargesOf(line), muted: true, hidden: !chargesOf(line) },
    { key: "net", label: t("commissionLine.netPremium"), value: line.netPremium, strong: true },
    { key: "brokerage", label: t("commissionLine.brokerage", { pct: line.brokeragePct }), value: line.brokerageAmount },
    { key: "comsub", label: line.share ? t("commissionLine.shareFormula", { basis: t(`sharingSchemes.bases.${line.share.basis}`, { defaultValue: line.share.basis }), note: line.share.note || `${line.share.value}${shareUnit(line.share.basis)}` }) : t("commissionLine.comsubFormula", { fixed: formatAmount(line.comsubFixed), pct: line.comsubPct }), value: line.comsub },
    {
      key: "wht",
      label: whtApplicable ? t("commissionLine.whtAt", { pct: line.whtPct }) : t("commissionLine.whtNotApplied"),
      value: -Number(line.wht || 0),
      muted: true,
    },
    { key: "payable", label: t("commissionLine.netPayable"), value: line.net, strong: true },
    { key: "margin", label: t("commissionLine.netMargin"), value: line.netMargin, strong: true, rule: true },
  ];

  // with the review of changes on, a line is never reversed or re-rated directly; the manual eligibility stays with the administrators' rule
  const available = Object.keys(ACTIONS).filter((name) => ACTIONS[name].when.includes(line.status) && !(reviewed && (name === "reverse" || name === "pay")) && !(name === "eligible" && controls?.eligibleRequiresRemittance));
  const requestable = reviewed && !pending ? Object.keys(REQUESTS).filter((kind) => REQUESTS[kind].when.includes(line.status)) : [];

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      className="line-detail-drawer"
      blockScroll
      dismissable
      showCloseIcon
    >
      <div className="drawer-body">
        <DetailHeader
          title={line.policyNo}
          subtitle={`${line.productInsurer || ""} · ${referrerName || ""}`}
          status={{ code: String(line.status || "").toLowerCase(), label: t(`commissionLine.statuses.${line.status}`, { defaultValue: line.status }) }}
          flags={pending ? [{ key: "pending", label: t("commissionLine.requests.pendingFlag", { kind: t(`commissionLine.requests.kinds.${pending.kind}`) }), severity: "warning" }] : undefined}
          meta={[
            { label: t("commissionLine.receipt"), value: line.receiptNo },
            { label: t("commissionLine.voucher"), value: line.voucherNo },
            ...(line.share?.schemeCode ? [{ label: t("commissionLine.scheme"), value: line.share.schemeCode }] : []),
          ]}
        />

        <DetailSection title={t("commissionLine.calculation")}>
          <table className="calc-table">
            <tbody>
              {rows.filter((r) => !r.hidden).map((r) => (
                <tr key={r.key} className={[r.muted && "muted", r.strong && "strong", r.rule && "rule"].filter(Boolean).join(" ") || undefined}>
                  <th scope="row">{r.label}</th>
                  <td>{formatAmount(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEditRate && (
            <div className="rate-override">
              <h4>{t("commissionLine.overrideRate")}</h4>
              <div className="rate-fields">
                <label>
                  {t("commissionLine.fixed", { symbol: currencySymbol() })}
                  <InputNumber
                    value={rateFixed}
                    onValueChange={(e) => setRateFixed(e.value ?? 0)}
                    min={0}
                    mode="decimal"
                    minFractionDigits={0}
                    maxFractionDigits={2}
                  />
                </label>
                <label>
                  {t("commissionLine.rate")}
                  <InputNumber
                    value={ratePct}
                    onValueChange={(e) => setRatePct(e.value)}
                    min={0}
                    max={100}
                    mode="decimal"
                    minFractionDigits={0}
                    maxFractionDigits={2}
                    suffix="%"
                  />
                </label>
                <Button
                  label={t("commissionLine.confirm.rate")}
                  size="small"
                  outlined
                  disabled={
                    actionLoading || ratePct === null || ratePct === undefined
                    // nothing to apply until the rate differs from the line's own
                    || (Number(rateFixed || 0) === Number(line.comsubFixed || 0) && Number(ratePct) === Number(line.comsubPct))
                  }
                  onClick={applyRateOverride}
                />
              </div>
            </div>
          )}
        </DetailSection>

        {line.share && (
          <DetailSection title={t("commissionLine.share")} actions={canChangeShare ? <Button label={t("commissionLine.changeShare")} size="small" outlined onClick={openShare} disabled={actionLoading} /> : null}>
            <KeyValueGrid columns={2} items={[
              { label: t("commissionLine.scheme"), value: line.share.schemeCode || t("commissionLine.noScheme") },
              { label: t("commissionLine.shareBasis"), value: t(`sharingSchemes.bases.${line.share.basis}`, { defaultValue: line.share.basis }) },
              { label: t("commissionLine.shareValue"), value: `${line.share.value ?? "—"}${shareUnit(line.share.basis)}` },
              { label: t("commissionLine.shareLimits"), value: `${line.share.min ?? 0} – ${line.share.max ?? "—"}` },
            ]} />
          </DetailSection>
        )}

        {pending && (
          <DetailSection title={t("commissionLine.requests.title")}>
            <KeyValueGrid columns={2} items={[
              { label: t("commissionLine.requests.kind"), value: <StatusChip code="for-approval" label={t(`commissionLine.requests.kinds.${pending.kind}`)} /> },
              { label: t("commissionLine.requests.requestedBy"), value: pending.requestedBy },
              { label: t("commissionLine.requests.reason"), value: pending.reason, span: "full" },
            ]} />
          </DetailSection>
        )}

        <DetailSection title={t("commissionLine.activity")}>
          <RecordActivityLog key={activityKey} entity="commission_line" recordId={line.id} />
        </DetailSection>

        {(available.length > 0 || requestable.length > 0) && (
          <div className="drawer-actions">
            {available.map((name) => (
              <Button
                key={name}
                label={t(`commissionLine.confirm.${name}`)}
                severity={ACTIONS[name].danger ? "danger" : undefined}
                outlined={name !== "approve"}
                disabled={actionLoading}
                onClick={() => confirmAction(name)}
              />
            ))}
            {requestable.map((kind) => (
              <Button key={kind} label={t(`commissionLine.requests.${kind}`)} outlined severity={kind === "reversal" ? "danger" : undefined} disabled={actionLoading} onClick={() => openRequest(kind)} />
            ))}
          </div>
        )}
      </div>

      <Dialog header={request ? t(`commissionLine.requests.${request.kind}Title`, { policy: line.policyNo }) : ""} visible={!!request} onHide={() => setRequest(null)} style={{ width: "min(520px, 96vw)" }}
        footer={<div><Button label={t("numberingMasters.cancel")} text onClick={() => setRequest(null)} /><Button label={t("commissionLine.requests.send")} icon="pi pi-send" onClick={sendRequest} loading={actionLoading} /></div>}>
        {request && (
          <div className="dn__form">
            {request.kind === "rate" ? (
              <div className="rate-fields">
                <label>
                  {t("commissionLine.fixed", { symbol: currencySymbol() })}
                  <InputNumber value={request.comsubFixed} onValueChange={(e) => setRequest((r) => ({ ...r, comsubFixed: e.value ?? 0 }))} min={0} mode="decimal" maxFractionDigits={2} />
                </label>
                <label>
                  {t("commissionLine.rate")}
                  <InputNumber value={request.comsubPct} onValueChange={(e) => setRequest((r) => ({ ...r, comsubPct: e.value }))} min={0} max={100} mode="decimal" maxFractionDigits={2} suffix="%" />
                </label>
              </div>
            ) : null}
            <ReasonPicker context={REQUESTS[request.kind].context} value={request.reason} onChange={(reason) => setRequest((r) => ({ ...r, reason }))} label={t("commissionLine.requests.reason")} showErrors={request.tried} autoFocus />
          </div>
        )}
      </Dialog>

      <Dialog header={t("commissionLine.changeShareTitle", { policy: line.policyNo })} visible={!!share} onHide={() => setShare(null)} style={{ width: "min(520px, 96vw)" }}
        footer={<div><Button label={t("numberingMasters.cancel")} text onClick={() => setShare(null)} /><Button label={t("commissionLine.changeShare")} icon="pi pi-check" onClick={sendShare} loading={actionLoading} /></div>}>
        {share && (
          <div className="dn__form">
            <label className="rate-fields">
              {t("commissionLine.shareValue")}
              <InputNumber value={share.value} onValueChange={(e) => setShare((s) => ({ ...s, value: e.value }))} min={line.share?.min ?? 0} max={line.share?.max ?? undefined} mode="decimal" maxFractionDigits={4} suffix={shareUnit(line.share?.basis)} />
            </label>
            <small className="dn__muted">{t("commissionLine.shareLimitsNote", { min: line.share?.min ?? 0, max: line.share?.max ?? "—" })}</small>
            <ReasonPicker context="commission_share_change" value={share.reason} onChange={(reason) => setShare((s) => ({ ...s, reason }))} label={t("commissionLine.requests.reason")} showErrors={share.tried} />
          </div>
        )}
      </Dialog>
    </Sidebar>
  );
};

export default LineDetailDrawer;
