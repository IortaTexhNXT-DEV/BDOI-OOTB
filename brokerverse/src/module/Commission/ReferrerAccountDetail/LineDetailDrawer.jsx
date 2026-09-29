import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import CommissionService from "../../../services/commissionService";
import { formatBaht } from "../utils/formatBaht";

const stepDate = (value) => value || "—";

const LineDetailDrawer = ({
  visible,
  onHide,
  referrerId,
  referrerName,
  whtApplicable,
  line,
  onUpdated,
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [ratePct, setRatePct] = useState(null);
  const [rateFixed, setRateFixed] = useState(0);

  useEffect(() => {
    if (!line) return;
    setRatePct(line.comsubPct ?? 0);
    setRateFixed(line.comsubFixed ?? 0);
  }, [line]);

  if (!line) {
    return (
      <Sidebar
        visible={visible}
        position="right"
        onHide={onHide}
        className="line-detail-drawer"
        blockScroll
      />
    );
  }

  const isAccrued = line.status === "Accrued";
  const isEligible = line.status === "Eligible";
  const isApproved = line.status === "Approved";
  const isPaid = line.status === "Paid";

  const statusClass = isEligible
    ? "eligible"
    : isApproved
      ? "approved"
      : isPaid
        ? "paid"
        : "accrued";

  const canMarkEligible = isAccrued;
  const canApprove = isEligible;
  const canPay = isApproved;
  const canReverse = isAccrued || isEligible || isApproved;
  const canEditRate = isEligible || isApproved;
  const lifecycle = line.lifecycle || {};

  const stepState = (key) => {
    const order = ["Accrued", "Eligible", "Approved", "Paid"];
    const current = order.indexOf(line.status);
    const step = order.indexOf(key);
    if (step < current) return "done";
    if (step === current) {
      // Accrued current = solid gray; Eligible/Approved current = blue highlight
      return key === "Accrued" ? "done" : "current";
    }
    return "upcoming";
  };

  const stepLabel = (key, dateValue) => {
    if (key === "Approved" && isApproved) {
      return "Approved ✓";
    }
    return `${key} ${stepDate(dateValue)}`;
  };

  const runLineAction = async (fn, args) => {
    setActionLoading(true);
    try {
      const res =
        args === undefined ? await fn(referrerId, line.id) : await fn(...args);
      const payload = res?.data || res;
      onUpdated?.(payload);
    } catch (err) {
      console.error("Line action failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  const applyRateOverride = () => {
    runLineAction(CommissionService.updateLineRate, [
      referrerId,
      line.id,
      { comsubPct: ratePct, comsubFixed: rateFixed },
    ]);
  };

  const whtLabel = whtApplicable
    ? `WHT @ ${line.whtPct}%`
    : "WHT (not applied)";

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
        <div className="drawer-header">
          <span className={`line-status-pill ${statusClass}`}>
            {line.status}
          </span>
          <h2>{line.policyNo}</h2>
          <p className="subtitle">
            {line.productInsurer} · Referrer: {referrerName}
          </p>
        </div>

        <div className="drawer-card calc-card">
          <h3 className="card-title">CALCULATION</h3>
          <div className="calc-row">
            <span>Gross premium</span>
            <span>{formatBaht(line.grossPremium)}</span>
          </div>
          <div className="calc-row muted">
            <span>- Discount ({line.discountLabel})</span>
            <span>-{formatBaht(line.discountAmount)}</span>
          </div>
          <div className="calc-row strong">
            <span>Net premium</span>
            <span>{formatBaht(line.netPremium)}</span>
          </div>
          <div className="calc-row">
            <span>Brokerage @ {line.brokeragePct}%</span>
            <span className="amt-with-badge">
              <span className="income-amt">
                {formatBaht(line.brokerageAmount)}
              </span>
              <span className="badge income">INCOME</span>
            </span>
          </div>
          <div className="calc-row">
            <span>
              Comsub = {formatBaht(line.comsubFixed)} + {line.comsubPct}% of
              net
            </span>
            <span className="amt-with-badge">
              <span className="payable-amt">{formatBaht(line.comsub)}</span>
              <span className="badge payable">PAYABLE</span>
            </span>
          </div>
          <div className="calc-row muted">
            <span>{whtLabel}</span>
            <span>-{formatBaht(line.wht)}</span>
          </div>
          <div className="calc-row strong">
            <span>Net payable</span>
            <span>{formatBaht(line.net)}</span>
          </div>
          <div className="calc-row strong margin-row">
            <span>Net margin</span>
            <span className="margin-amt">{formatBaht(line.netMargin)}</span>
          </div>

          {canEditRate && (
            <div className="rate-override">
              <h4>Override policy rate</h4>
              <p className="rate-hint">
                Each line keeps its own comsub rate — change it for this policy
                only.
              </p>
              <div className="rate-fields">
                <label>
                  Fixed (₱)
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
                  Rate (%)
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
                  label="Apply rate"
                  className="p-button-sm apply-rate-btn"
                  disabled={
                    actionLoading || ratePct === null || ratePct === undefined
                  }
                  onClick={applyRateOverride}
                />
              </div>
            </div>
          )}
        </div>

        <div className="drawer-card lifecycle-card">
          <h3 className="card-title">LIFECYCLE</h3>
          <div className="stepper">
            <div className={`step-pill ${stepState("Accrued")}`}>
              {stepLabel("Accrued", lifecycle.accruedAt)}
            </div>
            <span className="step-arrow">→</span>
            <div className={`step-pill ${stepState("Eligible")}`}>
              {stepLabel("Eligible", lifecycle.eligibleAt)}
            </div>
            <span className="step-arrow">→</span>
            <div className={`step-pill ${stepState("Approved")}`}>
              {stepLabel("Approved", lifecycle.approvedAt)}
            </div>
            <span className="step-arrow">→</span>
            <div className={`step-pill ${stepState("Paid")}`}>
              {stepLabel("Paid", lifecycle.paidAt)}
            </div>
          </div>
          <p className="meta-line">
            Receipt: {line.receiptNo || "—"} · Voucher: {line.voucherNo || "—"}
          </p>
          <div className="drawer-actions">
            {canMarkEligible && (
              <Button
                label="Mark eligible"
                className="p-button-outlined mark-eligible-btn"
                disabled={actionLoading}
                onClick={() =>
                  runLineAction(CommissionService.markLineEligible)
                }
              />
            )}
            {canApprove && (
              <Button
                label="Approve"
                className="approve-line-btn"
                disabled={actionLoading}
                onClick={() => runLineAction(CommissionService.approveLine)}
              />
            )}
            {canPay && (
              <Button
                label="Pay (voucher)"
                className="pay-line-btn"
                disabled={actionLoading}
                onClick={() => runLineAction(CommissionService.payLine)}
              />
            )}
            {canReverse && (
              <Button
                label="Reverse (claw-back)"
                className="reverse-line-btn"
                disabled={actionLoading}
                onClick={() => runLineAction(CommissionService.reverseLine)}
              />
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  );
};

export default LineDetailDrawer;
