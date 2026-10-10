import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Sidebar } from "primereact/sidebar";
import { Skeleton } from "primereact/skeleton";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import LoadingBar from "../../../components/LoadingBar";
import { ActivityLog, fromRemittanceActivity } from "../../../components/ActivityLog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { canOpen } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { formatInstant } from "../../../utility/dateFormat";
import { money } from "../shared";
import { severityOf, timelineSteps } from "./paymentsModel";

/** A link inside the app when the user's menu reaches it, else the text. */
export const AppLink = ({ to, children }) => (to && canOpen(to.split("?")[0]) ? <Link to={to} className="rm-ref">{children}</Link> : <span>{children}</span>);

AppLink.propTypes = { to: PropTypes.string, children: PropTypes.node.isRequired };
AppLink.defaultProps = { to: null };

const personText = (p) => (p ? [p.name, p.at ? formatInstant(p.at, { empty: "" }) : null].filter(Boolean).join(" · ") : null);

/**
 * The payment record (640px side panel; "View payment" and ?payment=PV-...): the voucher with its state, the sections
 * Payee, Payment, Amounts, Links and Approvals, the timeline in the header, the activity (folded) and Open remittance /
 * Open batch. The account number is masked; Show full number (write:disbursements) asks the server, which audits it.
 */
const PaymentPanel = ({ voucherId, onHide }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [revealError, setRevealError] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const loader = useCallback(() => remittanceService.getPayment(voucherId), [voucherId]);
  const { data: p, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !!voucherId });

  useEffect(() => {
    setAccount(null);
    setRevealError(null);
    setActivityOpen(false);
  }, [voucherId]);

  const reveal = async () => {
    setRevealError(null);
    try {
      setAccount(await remittanceService.revealPaymentAccount(p.id));
    } catch (e) {
      setRevealError(e.message);
    }
  };
  const download = (path, name) => remittanceService.download(path, name).catch((e) => setRevealError(e.message));

  const payee = p?.payee || {};
  const payment = p?.payment || {};
  const amounts = p?.amounts || {};
  const links = p?.links || {};
  const approvals = p?.approvals || {};
  const remittances = links.remittances || [];
  const remittanceNos = (p?.remittances || []).map((r) => r.remittanceNo);

  const accountValue = payee.accountMasked ? (
    <span className="rm-payment__account">
      <span>{account ? account.accountNumber : payee.accountMasked}</span>
      {payee.canReveal && !account ? <Button type="button" link size="small" label={t("remittance.payments.panel.showFull")} onClick={reveal} /> : null}
    </span>
  ) : <StatusChip label={payee.chip?.label} severity="secondary" />;

  const check = amounts.check ? (
    <span className="rm-payment__check">
      <StatusChip label={amounts.check.label} severity={amounts.check.code === "pass" ? "success" : "danger"} />
      {amounts.check.code !== "pass" && amounts.check.difference ? <span className="rm-num">{money(amounts.check.difference)}</span> : null}
    </span>
  ) : null;

  const remittanceApprovals = (approvals.remittances || []).map((a) => (
    <span key={`${a.remittanceNo}-${a.at}`} className="rm-payment__approval">
      {[a.remittanceNo, a.by, a.at ? formatInstant(a.at, { empty: "" }) : null].filter(Boolean).join(" · ")}
      {a.limitAtDecision !== null && a.limitAtDecision !== undefined ? (
        <span className="rm-payment__limit">{t("remittance.payments.panel.limitAt", { limit: money(a.limitAtDecision), source: a.limitSourceLabel || "" })}</span>
      ) : null}
    </span>
  ));

  const header = p ? (
    <DetailHeader title={p.voucherNo} status={{ code: p.state, label: p.stateLabel, severity: severityOf(p.state) }}
      subtitle={[p.insurer?.name, ...remittanceNos].filter(Boolean).join(" · ")} steps={timelineSteps(p.timeline)} />
  ) : null;

  const firstRemittance = remittances[0]?.link || null;
  const footer = p ? (
    <div className="rm-review__footer rm-payment__footer">
      {firstRemittance ? <Button type="button" label={t("remittance.payments.panel.openRemittance")} outlined onClick={() => navigate(firstRemittance)} /> : null}
      {links.batch?.link && canOpen("/accounts/bank-payment-files") ? (
        <Button type="button" label={t("remittance.payments.panel.openBatch")} outlined onClick={() => navigate(links.batch.link)} />
      ) : null}
    </div>
  ) : null;

  return (
    <Sidebar visible={!!voucherId} position="right" onHide={onHide} blockScroll className="rm-review rm-payment" aria-label={t("remittance.payments.panel.title")}
      header={<span className="rm-review__title">{t("remittance.payments.panel.title")}</span>}>
      <div className="rm-review__body bv-loading-host">
        <LoadingBar active={refreshing} />
        {error && !p ? (
          <div className="rm-inline-error" role="alert">
            <span>{error}</span>
            <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
          </div>
        ) : null}
        {loading && !p ? <Skeleton height="16rem" /> : null}
        {p ? (
          <>
            {header}
            {revealError ? <p className="rm-review__message rm-review__message--race" role="alert">{revealError}</p> : null}
            <DetailSection title={t("remittance.payments.panel.payee")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.panel.insurer"), value: p.insurer?.name },
                { label: t("remittance.payments.panel.bank"), value: payee.bank?.name },
                { label: t("remittance.payments.panel.accountName"), value: payee.accountName },
                { label: t("remittance.payments.panel.accountNo"), value: accountValue },
                { label: t("remittance.payments.panel.verification"), value: payee.verification ? <StatusChip label={payee.verification.label} severity="secondary" /> : null },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.payment")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.panel.method"), value: payment.method?.label },
                { label: t("remittance.payments.panel.amount"), value: money(payment.amount) },
                { label: t("remittance.payments.panel.valueDate"), value: payment.valueDate, type: "date" },
                { label: t("remittance.payments.panel.debitAccount"), value: payment.debitAccount?.label },
                { label: t("remittance.payments.panel.bankReference"), value: payment.bankReference },
                { label: t("remittance.payments.panel.paidOn"), value: payment.paidOn, type: "datetime" },
                { label: t("remittance.payments.panel.failureReason"), value: payment.failureReason, span: "full", hidden: !payment.failureReason },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.amounts")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.panel.dueToInsurer"), value: amounts.dueToInsurer === null ? null : money(amounts.dueToInsurer) },
                { label: t("remittance.payments.panel.refundCredits"), value: money(amounts.refundCredits) },
                { label: t("remittance.payments.panel.voucherAmount"), value: money(amounts.voucherAmount) },
                { label: t("remittance.payments.panel.bankAmount"), value: amounts.bankAmount === null ? null : money(amounts.bankAmount) },
                { label: t("remittance.payments.panel.check"), value: check },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.links")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.panel.remittance"), value: remittances.length ? (
                  <span className="rm-payment__links">{remittances.map((r) => <Link key={r.remittanceNo} to={r.link} className="rm-ref">{r.remittanceNo}</Link>)}</span>
                ) : null },
                { label: t("remittance.payments.panel.schedule"), value: remittances.length ? (
                  <span className="rm-payment__links">
                    {remittances.map((r) => (
                      <Button key={r.remittanceNo} type="button" link size="small" label={t("remittance.payments.panel.scheduleOf", { reference: r.remittanceNo })}
                        onClick={() => download(r.schedule, `${r.remittanceNo}-schedule.xlsx`)} />
                    ))}
                  </span>
                ) : null },
                { label: t("remittance.payments.panel.voucher"), value: links.voucher ? <AppLink to={links.voucher.link}>{links.voucher.number}</AppLink> : null },
                { label: t("remittance.payments.panel.batch"), value: links.batch ? <AppLink to={links.batch.link}>{links.batch.number}</AppLink> : null },
                { label: t("remittance.payments.panel.bankFile"), value: links.bankFile?.name },
                { label: t("remittance.payments.panel.statusFile"), value: links.statusFile ? [links.statusFile.name, formatInstant(links.statusFile.at, { empty: "" })].filter(Boolean).join(" · ") : null },
                { label: t("remittance.payments.panel.cheque"), value: links.cheque ? [links.cheque.number, links.cheque.status].filter(Boolean).join(" · ") : null },
                { label: t("remittance.payments.panel.journal"), value: links.journal?.number },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.approvals")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.panel.remittanceApproved"), value: remittanceApprovals.length ? <span className="rm-payment__links">{remittanceApprovals}</span> : null, span: "full" },
                { label: t("remittance.payments.panel.voucherMaker"), value: personText(approvals.voucherMaker) },
                { label: t("remittance.payments.panel.batchCreated"), value: personText(approvals.batchCreatedBy) },
                { label: t("remittance.payments.panel.batchApproved"), value: personText(approvals.batchApprovedBy) },
                { label: t("remittance.payments.panel.fileGenerated"), value: personText(approvals.fileGeneratedBy) },
                { label: t("remittance.payments.panel.resultImported"), value: approvals.resultImportedBy
                  ? [personText(approvals.resultImportedBy), approvals.resultImportedBy.source].filter(Boolean).join(" · ") : null },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.activity")}
              actions={<Button type="button" label={activityOpen ? t("remittance.review.hideActivity") : t("remittance.review.showActivity")} link size="small"
                aria-expanded={activityOpen} onClick={() => setActivityOpen((v) => !v)} />}>
              {activityOpen ? <ActivityLog entries={fromRemittanceActivity(p.activity || [])} /> : (
                <p className="rm-review__line">{t("remittance.review.activityCount", { count: (p.activity || []).length, at: formatInstant(p.activity?.at(-1)?.at, { empty: "" }) })}</p>
              )}
            </DetailSection>
          </>
        ) : null}
      </div>
      {footer}
    </Sidebar>
  );
};

PaymentPanel.propTypes = {
  /** the voucher shown (id or PV no.); null closes the panel */
  voucherId: PropTypes.string,
  onHide: PropTypes.func.isRequired,
};

PaymentPanel.defaultProps = { voucherId: null };

export default PaymentPanel;
