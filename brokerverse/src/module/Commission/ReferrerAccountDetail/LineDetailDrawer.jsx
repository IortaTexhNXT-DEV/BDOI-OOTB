import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import CommissionService from "../../../services/commissionService";
import { formatAmount } from "../utils/formatAmount";
import { currencySymbol } from "../../../utility/currencyConverter";
import logger from "../../../utility/logger";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import { RecordActivityLog } from "../../../components/ActivityLog";

// the actions of a line by its status: the service call and whether it is destructive
const ACTIONS = {
  eligible: { call: CommissionService.markLineEligible, when: ["Accrued"] },
  approve: { call: CommissionService.approveLine, when: ["Eligible"] },
  pay: { call: CommissionService.payLine, when: ["Approved"] },
  reverse: { call: CommissionService.reverseLine, when: ["Accrued", "Eligible", "Approved"], danger: true },
};

const LineDetailDrawer = ({
  visible,
  onHide,
  referrerId,
  referrerName,
  whtApplicable,
  line,
  onUpdated,
  onError,
}) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
  const [ratePct, setRatePct] = useState(null);
  const [rateFixed, setRateFixed] = useState(0);
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    if (!line) return;
    setRatePct(line.comsubPct ?? 0);
    setRateFixed(line.comsubFixed ?? 0);
  }, [line]);

  if (!line) return null;

  const canEditRate = ["Eligible", "Approved"].includes(line.status);

  const runLineAction = async (fn, args) => {
    setActionLoading(true);
    try {
      const res =
        args === undefined ? await fn(referrerId, line.id) : await fn(...args);
      const payload = res?.data || res;
      setActivityKey((k) => k + 1);
      onUpdated?.(payload);
    } catch (err) {
      logger.error("Line action failed", err);
      onError?.(err);
    } finally {
      setActionLoading(false);
    }
  };

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
      confirmLabel: t(`commissionLine.confirm.${name}`),
    });
    if (ok) runLineAction(action.call);
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

  const rows = [
    { key: "gross", label: t("commissionLine.grossPremium"), value: line.grossPremium },
    { key: "discount", label: t("commissionLine.discount", { label: line.discountLabel }), value: -Number(line.discountAmount || 0), muted: true },
    { key: "net", label: t("commissionLine.netPremium"), value: line.netPremium, strong: true },
    { key: "brokerage", label: t("commissionLine.brokerage", { pct: line.brokeragePct }), value: line.brokerageAmount },
    { key: "comsub", label: t("commissionLine.comsubFormula", { fixed: formatAmount(line.comsubFixed), pct: line.comsubPct }), value: line.comsub },
    {
      key: "wht",
      label: whtApplicable ? t("commissionLine.whtAt", { pct: line.whtPct }) : t("commissionLine.whtNotApplied"),
      value: -Number(line.wht || 0),
      muted: true,
    },
    { key: "payable", label: t("commissionLine.netPayable"), value: line.net, strong: true },
    { key: "margin", label: t("commissionLine.netMargin"), value: line.netMargin, strong: true, rule: true },
  ];

  const available = Object.keys(ACTIONS).filter((name) => ACTIONS[name].when.includes(line.status));

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
          meta={[
            { label: t("commissionLine.receipt"), value: line.receiptNo },
            { label: t("commissionLine.voucher"), value: line.voucherNo },
          ]}
        />

        <DetailSection title={t("commissionLine.calculation")}>
          <table className="calc-table">
            <tbody>
              {rows.map((r) => (
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
                  }
                  onClick={applyRateOverride}
                />
              </div>
            </div>
          )}
        </DetailSection>

        <DetailSection title={t("commissionLine.activity")}>
          <RecordActivityLog key={activityKey} entity="commission_line" recordId={line.id} />
        </DetailSection>

        {available.length > 0 && (
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
          </div>
        )}
      </div>
    </Sidebar>
  );
};

export default LineDetailDrawer;
