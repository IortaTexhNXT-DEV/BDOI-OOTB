import React, { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import { Skeleton } from "primereact/skeleton";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import DetailHeader from "../../../components/DetailHeader";
import KeyValueGrid from "../../../components/KeyValueGrid";
import EligibilityNote from "../../../components/EligibilityNote";
import RowActions from "../../../components/RowActions";
import LoadingBar from "../../../components/LoadingBar";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { canOpen } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { REMITTANCE_ROUTES, money, statusChip } from "../shared";
import { RejectDialog, approveRemittance } from "../Approvals/decisions";
import { bannerOf, lifecycleSteps, sodLine, subtitleChips } from "./recordModel";
import { ActivityTab, DocumentsTab, LinesTab, PaymentTab } from "./RecordTabs";
import "../remittance.scss";

const OVERFLOW = ["download-schedule-xlsx", "download-schedule-pdf", "download-advice", "open-voucher"];

/** The record of the API, or the state of a failed load: not found (404), no access (403) or an error. */
const failureOf = (error, status) => {
  if (!error) return null;
  if (status === 404) return "notFound";
  if (status === 403) return "forbidden";
  return "error";
};

/**
 * Accounts > Remittance > Remittances > record (/finance/remittance/remittances/:id), R1: the DetailHeader with the
 * flags, the subtitle chips, the lifecycle stepper, the segregation-of-duties line and the checks of a pending approval;
 * one banner line with the next step or why the user cannot act; the actions the server allows this user (Submit,
 * Approve and Reject for an eligible checker, Remind for the submitter, the downloads, Open voucher); the totals strip
 * and the tabs Lines, Payment, Documents and Activity. A submitter never sees Approve or Reject: the banner names who
 * can decide. A 409 leaves the action undone and says what changed, with Reload.
 */
const RemittanceRecord = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const checksPanel = useRef(null);
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState(0);
  const loader = useCallback(() => remittanceService.getRemittance(id).catch((e) => {
    setStatus(e.status || null);
    throw e;
  }), [id]);
  const { data: r, loading, refreshing, error, reload } = useStableLoad(loader);
  const failure = !r ? failureOf(error, status) : null;

  const refresh = async () => {
    setNotice(null);
    await reload();
  };

  const header = (
    <PageHeader title={r?.remittanceNo || t("remittance.record.title")} home={t("remittance.common.accounts")}
      section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
      trail={[{ label: t("remittance.record.remittances"), to: REMITTANCE_ROUTES.remittances }, r?.remittanceNo || t("remittance.record.title")]}
      onBack={() => navigate(REMITTANCE_ROUTES.remittances)} />
  );

  if (failure) {
    return (
      <div className="rm-page">
        {header}
        <div className={failure === "error" ? "rm-inline-error" : "rm-state"} role={failure === "error" ? "alert" : "status"}>
          <span>{t(`remittance.record.states.${failure}`)}</span>
          {failure === "error" ? <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={refresh} /> : null}
          {failure === "notFound" ? <Button type="button" label={t("remittance.record.back")} outlined size="small" onClick={() => navigate(REMITTANCE_ROUTES.remittances)} /> : null}
        </div>
      </div>
    );
  }
  if (!r) {
    return (
      <div className="rm-page" aria-busy={loading}>
        {header}
        <Skeleton height="7rem" />
        <Skeleton height="3rem" />
        <Skeleton height="18rem" />
      </div>
    );
  }

  const approval = r.approval || null;
  const allowed = (list, code) => (list || []).find((a) => a.code === code);
  const submit = allowed(r.actions, "submit");
  const canApprove = r.statusCode === "for-approval" && !!r.decision?.canDecide && !!allowed(approval?.actions, "approve")?.allowed;
  const canReject = r.statusCode === "for-approval" && !!allowed(approval?.actions, "reject")?.allowed;
  const remind = r.statusCode === "for-approval" ? allowed(approval?.actions, "remind") : null;
  const overflow = (r.actions || []).filter((a) => OVERFLOW.includes(a.code) && a.allowed && (a.code !== "open-voucher" || canOpen(a.link)));

  const conflict = (message) => setNotice({ tone: "stale", text: message });

  const doSubmit = async () => {
    let stale = null;
    const done = await openConfirm({
      title: t("remittance.record.submitTitle", { reference: r.remittanceNo }),
      message: t("remittance.record.submitMessage", { reference: r.remittanceNo, amount: money(r.dueToInsurer) }),
      confirmLabel: t("remittance.record.submit"),
      onConfirm: async () => {
        const out = await remittanceService.submitRemittances([{ id: r.id, version: r.version }]);
        const result = (out.results || [])[0];
        if (result?.ok) return;
        if (["STALE", "ALREADY_SUBMITTED"].includes(result?.code)) {
          stale = result.message;
          return;
        }
        throw new Error(result?.message || t("remittance.record.submitFailed"));
      },
    });
    if (stale) conflict(stale);
    else if (done) {
      toast.current?.show({ severity: "success", summary: t("remittance.record.submitted"), life: 3000 });
      refresh();
    }
  };

  const doApprove = async () => {
    setBusy("approve");
    try {
      const result = await approveRemittance(t, { id: approval.id, version: approval.version, reference: r.remittanceNo, amount: approval.amount });
      if (result.race) conflict(result.race);
      else if (result.done) {
        toast.current?.show({ severity: "success", summary: t("remittance.decision.approved"), life: 4000 });
        refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const afterReject = (result) => {
    setRejecting(null);
    if (result.race) conflict(result.race);
    else if (result.done) {
      toast.current?.show({ severity: "success", summary: t("remittance.decision.rejected"), life: 4000 });
      refresh();
    }
  };

  const doRemind = async () => {
    setBusy("remind");
    try {
      const out = await remittanceService.remindApprovers(approval.id);
      toast.current?.show({ severity: "success", summary: t("remittance.inbox.reminded"), detail: out.message, life: 4000 });
      refresh();
    } catch (e) {
      if (e.status === 409) conflict(e.message);
      else toast.current?.show({ severity: "error", summary: t("remittance.inbox.remindFailed"), detail: e.message, life: 6000 });
    } finally {
      setBusy(null);
    }
  };

  const onOverflow = (action) => {
    if (action.code === "open-voucher") {
      navigate(action.link);
      return;
    }
    remittanceService.download(action.href, action.href.split("/").pop())
      .catch((e) => toast.current?.show({ severity: "error", summary: t("remittance.record.downloadFailed"), detail: e.message, life: 6000 }));
  };
  const overflowLabel = (a) => t(`remittance.record.actions.${a.code}`, { defaultValue: a.label });

  const actions = (
    <div className="rm-header-actions">
      {submit ? (
        <span className="rm-action-with-reason">
          <Button type="button" label={t("remittance.record.submit")} onClick={doSubmit} disabled={!submit.allowed} />
          {!submit.allowed && submit.blockedReason ? <span className="rm-action-reason">{submit.blockedReason}</span> : null}
        </span>
      ) : null}
      {canReject ? (
        <Button type="button" label={t("remittance.decision.reject")} outlined severity="danger" disabled={!!busy}
          onClick={() => setRejecting({ id: approval.id, version: approval.version, reference: r.remittanceNo, amount: approval.amount, makerName: approval.submittedBy?.name })} />
      ) : null}
      {canApprove ? <Button type="button" label={t("remittance.decision.approve")} onClick={doApprove} loading={busy === "approve"} disabled={!!busy} /> : null}
      {remind && (remind.allowed || remind.blockedReason) ? (
        <span className="rm-action-with-reason">
          <Button type="button" label={t("remittance.inbox.actions.remind")} outlined onClick={doRemind} disabled={!remind.allowed || !!busy} loading={busy === "remind"} />
          {!remind.allowed && remind.blockedReason ? <span className="rm-action-reason">{remind.blockedReason}</span> : null}
        </span>
      ) : null}
      {overflow.length ? <RowActions label={t("remittance.common.moreActions")} actions={overflow} labelOf={overflowLabel} onAction={onOverflow} /> : null}
    </div>
  );

  const flags = [
    r.flags?.offCycle ? { key: "off-cycle", label: r.flags.offCycleReason ? t("remittance.flags.offCycleReason", { reason: r.flags.offCycleReason }) : t("remittance.flags.offCycle"), severity: "info" } : null,
    r.flags?.overdue ? { key: "overdue", label: t("remittance.flags.overdue"), severity: "danger" } : null,
  ].filter(Boolean);
  const checks = approval?.checks || [];
  const passed = checks.filter((c) => c.result === "pass").length;
  const banner = bannerOf(r, t);
  const totals = [
    { label: t("remittance.record.totals.policies"), value: r.policyCount, type: "number" },
    { label: t("remittance.record.totals.premium"), value: money(r.premium) },
    { label: t("remittance.record.totals.commission"), value: money(r.commission) },
    { label: t("remittance.record.totals.tax"), value: money(r.tax) },
    { label: t("remittance.record.totals.adjustments"), value: money(r.adjustments), hidden: !Number(r.adjustments) },
    { label: t("remittance.record.totals.due"), value: money(r.dueToInsurer) },
    { label: t("remittance.record.totals.voucher"), value: r.voucher ? money(r.voucher.amount) : null },
    { label: t("remittance.record.totals.paidOn"), value: r.paidOn, type: "datetime" },
  ];

  return (
    <div className="rm-page bv-loading-host">
      <Toast ref={toast} />
      <LoadingBar active={refreshing} />
      {header}
      <div className="rm-card rm-record__head">
        <DetailHeader title={r.remittanceNo} status={statusChip(r.statusCode, r.statusLabel)} flags={flags}
          subtitle={<span className="rm-subtitle">{subtitleChips(r, t).map((c) => <span key={c} className="rm-subtitle__chip">{c}</span>)}</span>}
          steps={lifecycleSteps(r, t)} sod={sodLine(r, t)} actions={actions} />
        {checks.length ? (
          <>
            <Button type="button" label={t("remittance.record.checks", { passed, total: checks.length })} outlined size="small" className="rm-checks-chip"
              aria-haspopup="dialog" onClick={(e) => checksPanel.current?.toggle(e)} />
            <OverlayPanel ref={checksPanel} aria-label={t("remittance.review.checks")}>
              <ul className="rm-checks">
                {checks.map((c) => (
                  <li key={c.code} className={`rm-checks__item rm-checks__item--${c.result}`}>
                    <span>{t(`remittance.review.checkResult.${c.result}`)}</span>
                    <span>{c.label}</span>
                    {c.detail ? <span className="rm-checks__detail">{c.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </OverlayPanel>
          </>
        ) : null}
      </div>

      {notice ? (
        <div className="rm-banner rm-banner--stale" role="alert">
          <span>{t("remittance.record.stale", { message: notice.text })}</span>
          <Button type="button" label={t("remittance.record.reload")} outlined size="small" onClick={refresh} />
        </div>
      ) : null}
      {banner?.kind === "note" ? <EligibilityNote reason={banner.reason} approvers={banner.approvers} className="rm-banner" /> : null}
      {banner?.kind === "text" ? <p className={`rm-banner${banner.tone ? ` rm-banner--${banner.tone}` : ""}`} role="status">{banner.text}</p> : null}

      <div className="rm-card rm-record__totals"><KeyValueGrid columns={4} items={totals} /></div>

      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)} className="rm-record__tabs">
        <TabPanel header={t("remittance.record.tabs.lines", { count: (r.lines || []).length })}><LinesTab record={r} /></TabPanel>
        <TabPanel header={t("remittance.record.tabs.payment")}><PaymentTab record={r} /></TabPanel>
        <TabPanel header={t("remittance.record.tabs.documents")}><DocumentsTab record={r} /></TabPanel>
        <TabPanel header={t("remittance.record.tabs.activity")}><ActivityTab record={r} /></TabPanel>
      </TabView>

      <RejectDialog approval={rejecting} onHide={afterReject} />
    </div>
  );
};

export default RemittanceRecord;
