import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { openConfirm } from "../../../components/ConfirmDialog";
import StatusChip from "../../../components/StatusChip";

const ReferrerAccountDetail = () => {
  const { t } = useTranslation();
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
      showError(err, t("commissionLine.actionFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  // the bulk actions of the page, confirmed with the number of lines and their net amount
  const confirmBulk = (name, count, amount) =>
    openConfirm({
      title: t(`commissionLine.bulk.${name}Title`, { name: detail?.referrer?.name }),
      message: t(`commissionLine.bulk.${name}Message`),
      facts: [
        { label: t("commissionLine.referrer"), value: detail?.referrer?.name },
        { label: t("commissionLine.bulk.lines"), value: count, type: "number" },
        { label: t("commissionLine.netPayable"), value: amount, type: "amount", emphasis: true, hidden: amount === undefined },
      ],
      confirmLabel: t(`commissionLine.bulk.${name}`, { count }),
    });

  const handleGeneratePayout = async () => {
    if (!(await confirmBulk("payout", detail.actions.generatePayoutCount, detail.currentCycle?.totalNet))) return;
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
      showError(err, t("commissionLine.bulk.payoutFailed"));
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
      showError(err, t("commissionLine.whtFailed"));
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

  const statusBody = (row) => (
    <StatusChip code={String(row.status || "").toLowerCase()} label={t(`commissionLine.statuses.${row.status}`, { defaultValue: row.status })} />
  );

  const renderLinesTable = (lines, { clickable = false } = {}) => (
    <DataTable
      value={lines || []}
      emptyMessage={t("commissionLine.noLines")}
      className="cycle-table"
      rowClassName={() => (clickable ? "clickable-row" : "")}
      onRowClick={clickable ? (e) => openLineDrawer(e.data) : undefined}
    >
      <Column field="policyNo" header={t("commissionLine.policy")} />
      <Column field="productInsurer" header={t("commissionLine.productInsurer")} />
      <Column field="cycle" header={t("commissionLine.cycle")} />
      <Column field="comsub" header={t("commissionLine.comsub")} body={comsubBody} />
      <Column field="wht" header={t("commissionLine.wht")} body={(r) => formatAmount(r.wht)} />
      <Column field="net" header={t("commissionLine.netPayable")} body={netBody} />
      <Column field="status" header={t("commissionLine.status")} body={statusBody} />
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
          label={t("commissionLine.backToReferrers")}
          icon="pi pi-arrow-left"
          outlined
          className="back-btn"
          onClick={() => navigate("/commission/referrer-accounts")}
        />
        <p className="loading-msg">{t("commissionLine.notFound")}</p>
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

  return (
    <div className="referrer-detail-page">
      <Toast ref={toast} />
      <Button
        label={t("commissionLine.backToReferrers")}
        icon="pi pi-arrow-left"
        outlined
        className="back-btn"
        onClick={() => navigate("/commission/referrer-accounts")}
      />

      <div className="identity">
        <div className="badges">
          <StatusChip code={String(referrer.status || "").toLowerCase()} label={referrer.status} />
          <span className="type-badge">{typeLevel}</span>
        </div>
        <h1>{referrer.name}</h1>
        <p className="meta">
          {t("commissionLine.wht")}: {referrer.whtType || "—"} · {t("commissionLine.bank")}:{" "}
          {referrer.bankAccount || t("commissionLine.notOnFile")} ·{" "}
          {t("commissionLine.policiesOnBook", { count: referrer.policiesCount })}
        </p>
        <label className="wht-toggle">
          <Checkbox
            inputId="wht-applicable"
            checked={Boolean(referrer.whtApplicable)}
            disabled={actionLoading}
            onChange={(e) => handleWhtToggle(e.checked)}
          />
          <span>{t("commissionLine.applyWht")}{whtRateLabel ? ` (${whtRateLabel})` : ""}</span>
        </label>
        {payoutBlocked && (
          <Message
            severity="warn"
            className="mt-2 w-full justify-content-start"
            text={payoutBlocked}
          />
        )}
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <span className="label">
            {t("commissionLine.dueThisCycle", { cycle: summary.cycleLabel })}
          </span>
          <span className="value due">{formatAmount(summary.dueThisCycle)}</span>
        </div>
        <div className="summary-card">
          <span className="label">{t("commissionLine.upcoming")}</span>
          <span className="value">{formatAmount(summary.upcoming)}</span>
        </div>
        <div className="summary-card">
          <span className="label">{t("commissionLine.paidToDate")}</span>
          <span className="value paid">{formatAmount(summary.paidToDate)}</span>
        </div>
      </div>

      <section className="cycle-section current">
        <div className="section-head">
          <h2>
            {t("commissionLine.currentCycle", { cycle: currentCycle.label })} ·{" "}
            {formatAmount(currentCycle.totalNet)}
          </h2>
          <div className="actions">
            <Button
              label={t("commissionLine.bulk.approve", { count: actions.approveCount })}
              className="p-button-sm p-button-outlined approve-btn"
              disabled={!actions.approveCount || actionLoading || Boolean(payoutBlocked)}
              tooltip={payoutBlocked || undefined}
              tooltipOptions={{ showOnDisabled: true }}
              onClick={async () => {
                if (await confirmBulk("approve", actions.approveCount)) runAction(CommissionService.approveLines);
              }}
            />
            <Button
              label={t("commissionLine.bulk.payout", { count: actions.generatePayoutCount })}
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
            {t("commissionLine.futureCycles")} ·{" "}
            {formatAmount(futureCycles.totalNet)}
          </h2>
          <Button
            label={t("commissionLine.bulk.eligible", { count: actions.markEligibleCount })}
            className="p-button-outlined p-button-sm mark-btn"
            disabled={!actions.markEligibleCount || actionLoading}
            onClick={async () => {
              if (await confirmBulk("eligible", actions.markEligibleCount)) runAction(CommissionService.markEligible);
            }}
          />
        </div>
        {renderLinesTable(futureCycles.lines, { clickable: true })}
      </section>

      <section className="cycle-section past">
        <div className="section-head">
          <h2>{t("commissionLine.past")} · {formatAmount(past.totalNet)}</h2>
        </div>
        {past.lines?.length ? (
          renderLinesTable(past.lines, { clickable: true })
        ) : (
          <p className="empty-past">{t("commissionLine.noPast")}</p>
        )}
      </section>

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
        onError={(err) => showError(err, t("commissionLine.actionFailed"))}
      />
    </div>
  );
};

export default ReferrerAccountDetail;
