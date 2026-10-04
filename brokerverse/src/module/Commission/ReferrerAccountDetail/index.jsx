import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import CommissionService from "../../../services/commissionService";
import { formatAmount } from "../utils/formatAmount";
import LineDetailDrawer from "./LineDetailDrawer";
import "./style.scss";
import logger from "../../../utility/logger";
import { DetailPageSkeleton } from "../../../components/Skeletons";

const ReferrerAccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const toast = useRef(null);

  const showError = (err, fallback) => {
    toast.current?.show({
      severity: "error",
      summary: fallback,
      detail: err?.response?.data?.message || err?.message || fallback,
      life: 6000,
    });
  };

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getReferrerAccount(id);
      setDetail(res?.data || res);
    } catch (err) {
      logger.error("Failed to load referrer detail", err);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const runAction = async (fn) => {
    setActionLoading(true);
    try {
      const res = await fn(id);
      setDetail(res?.data || res);
    } catch (err) {
      showError(err, "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePayout = async () => {
    setActionLoading(true);
    try {
      const res = await CommissionService.generatePayout(id);
      const data = res?.data || res;
      const referrerId = data?.redirect?.referrerId || id;
      navigate("/accounts/paymentvoucher/createvoucher", {
        state: {
          preselectedReferrerId: referrerId,
          referrerId,
          referrerName: data?.redirect?.referrerName,
        },
      });
    } catch (err) {
      showError(err, "Generate payout failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openLineDrawer = (row) => {
    setSelectedLine(row);
    setDrawerVisible(true);
  };

  const handleLineUpdated = (payload) => {
    if (payload?.account) {
      setDetail(payload.account);
    }
    if (payload?.line) {
      // After pay, close drawer so the row is clearly under Past
      if (payload.line.status === "Paid") {
        setDrawerVisible(false);
        setSelectedLine(null);
        return;
      }
      setSelectedLine(payload.line);
    } else if (payload && Object.prototype.hasOwnProperty.call(payload, "line")) {
      setDrawerVisible(false);
      setSelectedLine(null);
    }
  };

  const handleWhtToggle = async (checked) => {
    setActionLoading(true);
    try {
      const res = await CommissionService.setWhtApplicable(id, checked);
      const account = res?.data || res;
      setDetail(account);
      if (selectedLine?.id && account?.currentCycle) {
        const allLines = [
          ...(account.currentCycle?.lines || []),
          ...(account.futureCycles?.lines || []),
          ...(account.past?.lines || []),
        ];
        const refreshed = allLines.find((l) => l.id === selectedLine.id);
        if (refreshed) setSelectedLine(refreshed);
      }
    } catch (err) {
      showError(err, "Failed to update WHT setting");
    } finally {
      setActionLoading(false);
    }
  };

  const comsubBody = (row) => (
    <div className="comsub-cell">
      <span className="comsub-amt">{formatAmount(row.comsub)}</span>
      <span className="comsub-rate">{row.comsubRateLabel}</span>
    </div>
  );

  const netBody = (row) => (
    <span className="net-amt">{formatAmount(row.net)}</span>
  );

  const statusBody = (row) => {
    if (row.status === "Accrued") {
      return <span className="status-pill accrued">Accrued</span>;
    }
    if (row.status === "Paid") {
      return <span className="status-pill paid">Paid</span>;
    }
    return <span className="status-text">{row.status}</span>;
  };

  const renderLinesTable = (lines, { clickable = false } = {}) => (
    <DataTable
      value={lines || []}
      emptyMessage="No lines"
      className="cycle-table"
      rowClassName={() => (clickable ? "clickable-row" : "")}
      onRowClick={clickable ? (e) => openLineDrawer(e.data) : undefined}
    >
      <Column field="policyNo" header="POLICY" />
      <Column field="productInsurer" header="PRODUCT • INSURER" />
      <Column field="cycle" header="CYCLE" />
      <Column field="comsub" header="COMSUB" body={comsubBody} />
      <Column field="wht" header="WHT" body={(r) => formatAmount(r.wht)} />
      <Column field="net" header="NET" body={netBody} />
      <Column field="status" header="STATUS" body={statusBody} />
    </DataTable>
  );

  if (loading && !detail) {
    return (
      <div className="referrer-detail-page">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="referrer-detail-page">
        <Button
          label="← Referrers"
          className="p-button-outlined back-btn"
          onClick={() => navigate("/commission/referrer-accounts")}
        />
        <p className="loading-msg">Referrer not found.</p>
      </div>
    );
  }

  const { referrer, summary, currentCycle, futureCycles, past, actions } =
    detail;
  const typeLevel = [referrer.type, referrer.level].filter(Boolean).join(" · ");
  // WHT rate configured for this referrer (commission service whtPctFor); never a hard-coded rate
  const whtRateLabel =
    referrer.whtPct !== undefined && referrer.whtPct !== null
      ? `${referrer.whtPct}%`
      : String(referrer.whtType || "").match(/[\d.]+%/)?.[0] || "";
  const payoutBlocked = referrer.payoutBlockedReason || null;
  // licence missing or expired while compliance.referrer_licence_check is "warn": allowed, shown as a warning
  const payoutWarning = referrer.payoutWarning || null;

  return (
    <div className="referrer-detail-page">
      <Toast ref={toast} />
      <Button
        label="← Referrers"
        className="p-button-outlined back-btn"
        onClick={() => navigate("/commission/referrer-accounts")}
      />

      <div className="identity">
        <div className="badges">
          <span
            className={`status-badge ${
              referrer.status === "Active" ? "active" : "on-hold"
            }`}
          >
            {referrer.status}
          </span>
          <span className="type-badge">{typeLevel}</span>
        </div>
        <h1>{referrer.name}</h1>
        <p className="meta">
          WHT: {referrer.whtType || "—"} • Bank:{" "}
          {referrer.bankAccount || "Not on file"} •{" "}
          {referrer.policiesCount} policies on the book
        </p>
        <label className="wht-toggle">
          <Checkbox
            inputId="wht-applicable"
            checked={Boolean(referrer.whtApplicable)}
            disabled={actionLoading}
            onChange={(e) => handleWhtToggle(e.checked)}
          />
          <span>Apply WHT{whtRateLabel ? ` (${whtRateLabel})` : ""}</span>
          <span className="wht-hint">
            Deselect when withholding tax does not apply to this referrer
          </span>
        </label>
        {payoutBlocked && (
          <Message
            severity="warn"
            className="mt-2 w-full justify-content-start"
            text={payoutBlocked}
          />
        )}
        {!payoutBlocked && payoutWarning && (
          <Message
            severity="info"
            className="mt-2 w-full justify-content-start"
            text={payoutWarning}
          />
        )}
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <span className="label">
            Due this cycle ({summary.cycleLabel})
          </span>
          <span className="value due">{formatAmount(summary.dueThisCycle)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Upcoming (future)</span>
          <span className="value">{formatAmount(summary.upcoming)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Paid to date</span>
          <span className="value paid">{formatAmount(summary.paidToDate)}</span>
        </div>
      </div>

      <section className="cycle-section current">
        <div className="section-head">
          <h2>
            Current cycle: {currentCycle.label} (due now) ·{" "}
            {formatAmount(currentCycle.totalNet)}
          </h2>
          <div className="actions">
            <Button
              label={`Approve ${actions.approveCount}`}
              className="p-button-sm approve-btn"
              disabled={!actions.approveCount || actionLoading || Boolean(payoutBlocked)}
              tooltip={payoutBlocked || undefined}
              tooltipOptions={{ showOnDisabled: true }}
              onClick={() => runAction(CommissionService.approveLines)}
            />
            <Button
              label={`Generate payout (${actions.generatePayoutCount})`}
              className="p-button-sm payout-btn"
              disabled={!actions.generatePayoutCount || actionLoading || Boolean(payoutBlocked)}
              tooltip={payoutBlocked || undefined}
              tooltipOptions={{ showOnDisabled: true }}
              onClick={handleGeneratePayout}
            />
          </div>
        </div>
        {renderLinesTable(currentCycle.lines, { clickable: true })}
      </section>

      <section className="cycle-section future">
        <div className="section-head">
          <h2>
            Future cycles (accrued, not yet payable) ·{" "}
            {formatAmount(futureCycles.totalNet)}
          </h2>
          <Button
            label={`Mark eligible (${actions.markEligibleCount})`}
            className="p-button-outlined p-button-sm mark-btn"
            disabled={!actions.markEligibleCount || actionLoading}
            onClick={() => runAction(CommissionService.markEligible)}
          />
        </div>
        {renderLinesTable(futureCycles.lines, { clickable: true })}
      </section>

      <section className="cycle-section past">
        <div className="section-head">
          <h2>Past (paid history) · {formatAmount(past.totalNet)}</h2>
        </div>
        {past.lines?.length ? (
          renderLinesTable(past.lines, { clickable: true })
        ) : (
          <p className="empty-past">No past payouts.</p>
        )}
      </section>

      <p className="footer-note">
        Each row is a policy at its own comsub rate — click a row to open the
        line. &apos;Due this cycle&apos; = Eligible + Approved; future = Accrued
        (awaits customer payment).
      </p>

      <LineDetailDrawer
        visible={drawerVisible}
        onHide={() => {
          setDrawerVisible(false);
          setSelectedLine(null);
        }}
        referrerId={id}
        referrerName={referrer.name}
        whtApplicable={Boolean(referrer.whtApplicable)}
        line={selectedLine}
        onUpdated={handleLineUpdated}
        onError={(err) => showError(err, "Line action failed")}
      />
    </div>
  );
};

export default ReferrerAccountDetail;
