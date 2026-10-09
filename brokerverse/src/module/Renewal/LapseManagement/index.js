import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import useMasterOptions from "../../../agentModule/component/useMasterOptions";
import StatCards from "../../../components/StatCards";
import FieldError from "../../../components/FieldError";
import { EmptyState, FilterBar, KeyFacts, PanelSection, RowActions, SectionCard, SidePanel, StatusChip } from "../../../components/RecordPage";
import { calendarDateFormat, formatDate, toIsoDate } from "../../../utility/dateFormat";
import { downloadCsv } from "../../../utility/csvExport";
import { formatPercent } from "../../../utility/numberFormat";
import { PolicyCell, RenewalHeader } from "../shared";
import "./index.scss";

const GRACE = "grace";
const LAPSED = "lapsed";
const CHANNELS = ["Email", "Phone", "SMS", "Letter", "Visit"];
const PAYMENT_TERMS = ["Standard", "Extended", "Installments", "Deferred"];
const BENEFITS = ["Waived reinstatement fee", "Free add-on coverage", "Extended payment terms", "Loyalty rewards", "Premium freeze", "Free policy review"];
const SEGMENTS = ["All Lapsed", "High Value", "Recent Lapse", "Long-term", "Price Sensitive"];

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return toIsoDate(d);
};
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * Operations > Renewals > Lapse Management: renewals in their grace period and lapsed renewals, with the win-back offers
 * made to each client and the win-back campaigns. Actions follow the state: a renewal in its grace period can be marked
 * lapsed; a lapsed one can receive a win-back offer and be reinstated while it is within renewals.reinstatement_days.
 */
const LapseManagement = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode, locale } = useFormatCurrency();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [reason, setReason] = useState("");
  const [panelId, setPanelId] = useState(null);
  const [winBack, setWinBack] = useState(null);
  const [lapse, setLapse] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [campaignErrors, setCampaignErrors] = useState({});
  // lapse reasons: Master > Insurance Management > Reason Codes (used for: lapse); the detail is free text
  const lapseCodes = useMasterOptions("reason-code", { filter: (r) => r.context === "lapse" });

  const showError = useCallback((e) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message || String(e), life: 5000 }), [t]);
  const done = (summary, detail) => toast.current?.show({ severity: "success", summary, detail, life: 3000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lapsed, queue, list, settings] = await Promise.all([
        renewalsWorkspaceService.getLapsed(),
        renewalsWorkspaceService.getQueue(),
        renewalsWorkspaceService.getCampaigns(),
        renewalsWorkspaceService.getSettings("renewals"),
      ]);
      const graceDays = settings["renewals.grace_period_days"];
      const grace = queue.items.filter((p) => p.inGracePeriod).map((p) => ({
        id: p.id, policyNumber: p.policyNumber, insuredName: p.insuredName, product: p.product, state: GRACE, statusLabel: p.status,
        graceEnd: addDays(p.expiryDate, graceDays), premiumLost: p.currentPremium, lapseReason: null, winBackAttempts: [], reinstatementEligible: false,
      }));
      setRows([...lapsed.map((p) => ({ ...p, state: LAPSED })), ...grace]);
      setCampaigns(list);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [showError]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!state || r.state === state || (state === "eligible" && r.reinstatementEligible))
      && (!reason || r.lapseReasonCode === reason)
      && (!q || [r.policyNumber, r.insuredName].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, search, state, reason]);
  const selected = rows.find((r) => r.id === panelId) || null;

  const figures = [
    { key: "lapsed", label: t("lapse.figures.lapsed"), value: rows.filter((r) => r.state === LAPSED).length, onClick: () => setState(state === LAPSED ? "" : LAPSED), active: state === LAPSED },
    { key: "grace", label: t("lapse.figures.grace"), value: rows.filter((r) => r.state === GRACE).length, onClick: () => setState(state === GRACE ? "" : GRACE), active: state === GRACE },
    { key: "eligible", label: t("lapse.figures.eligible"), value: rows.filter((r) => r.reinstatementEligible).length, onClick: () => setState(state === "eligible" ? "" : "eligible"), active: state === "eligible" },
    { key: "premium", label: t("lapse.figures.premium"), value: formatCurrency(rows.reduce((s, r) => s + (Number(r.premiumLost) || 0), 0)) },
  ];

  // ---------------------------------------------------------------- actions
  const activeCampaign = campaigns.find((c) => c.status === "active");
  const openWinBack = (row) => setWinBack({
    row, method: "Email", discount: activeCampaign?.offer?.discount ?? 0, paymentTerms: "Standard", validUntil: inDays(30), benefits: [], response: "",
    campaignId: activeCampaign?.id || null,
  });
  const sendWinBack = async () => {
    setSaving(true);
    try {
      const { row } = winBack;
      const offer = [
        winBack.discount ? t("lapse.offerDiscount", { pct: winBack.discount }) : null,
        ...winBack.benefits.map((b) => t(`lapse.benefits.${b}`, b)),
        t("lapse.offerTerms", { terms: t(`lapse.paymentTerms.${winBack.paymentTerms}`, winBack.paymentTerms) }),
        t("lapse.offerValid", { date: formatDate(winBack.validUntil) }),
      ].filter(Boolean).join(", ");
      await renewalsWorkspaceService.winBack(row.id, { offer, method: winBack.method, campaignId: winBack.campaignId || undefined, response: winBack.response.trim() || undefined });
      setWinBack(null);
      done(t("lapse.offerRecorded"), row.policyNumber);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const codeRecord = lapseCodes.find((o) => o.value === lapse?.code)?.record;
  const noteNeeded = !codeRecord || codeRecord.requiresNote === true || String(codeRecord.requiresNote).toLowerCase() === "true";
  const confirmLapse = async () => {
    setSaving(true);
    try {
      await renewalsWorkspaceService.lapse(lapse.row.id, lapse.note.trim(), lapse.code);
      done(t("lapse.markedLapsed"), lapse.row.policyNumber);
      setLapse(null);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };
  const reinstate = (row) => confirmDialog({
    header: t("lapse.reinstate"),
    message: t("lapse.reinstateConfirm", { policy: row.policyNumber }),
    acceptLabel: t("lapse.reinstate"),
    rejectLabel: t("common.cancel", "Cancel"),
    accept: async () => {
      try {
        await renewalsWorkspaceService.reinstate(row.id);
        done(t("lapse.reinstated"), row.policyNumber);
        load();
      } catch (e) {
        showError(e);
      }
    },
  });

  const openCampaign = () => {
    setCampaignErrors({});
    setCampaign({ name: "", startDate: new Date(), endDate: inDays(30), targetSegment: "All Lapsed", discount: 0, benefits: [], budget: null });
  };
  const saveCampaign = async () => {
    const errors = {};
    if (campaign.name.trim().length < 2) errors.name = t("lapse.required");
    if (!campaign.startDate) errors.startDate = t("lapse.required");
    if (!campaign.endDate) errors.endDate = t("lapse.required");
    else if (campaign.startDate && campaign.endDate < campaign.startDate) errors.endDate = t("lapse.endBeforeStart");
    setCampaignErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await renewalsWorkspaceService.createCampaign({
        campaignName: campaign.name.trim(), targetSegment: campaign.targetSegment, startDate: toIsoDate(campaign.startDate), endDate: toIsoDate(campaign.endDate),
        discount: campaign.discount || 0, budget: campaign.budget || 0, offers: campaign.benefits,
      });
      done(t("lapse.campaignCreated"), campaign.name);
      setCampaign(null);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(`lapse-management-${toIsoDate(new Date())}.csv`, filtered, [
      { header: t("lapse.policy"), field: "policyNumber" },
      { header: t("lapse.col.insured"), field: "insuredName" },
      { header: t("lapse.col.product"), field: "product" },
      { header: t("lapse.col.status"), field: (r) => (r.state === GRACE ? t("lapse.status.grace") : t("lapse.status.lapsed")) },
      { header: t("lapse.graceEnd"), field: (r) => formatDate(r.graceEnd, { empty: "" }) },
      { header: t("lapse.lapseDate"), field: (r) => formatDate(r.lapseDate, { empty: "" }) },
      { header: t("lapse.col.days"), field: (r) => (r.state === LAPSED ? r.daysLapsed || 0 : "") },
      { header: t("lapse.col.premium"), field: "premiumLost" },
      { header: t("lapse.col.reason"), field: "lapseReason" },
      { header: t("lapse.reinstateBy"), field: (r) => formatDate(r.reinstatementDeadline, { empty: "" }) },
      { header: t("lapse.col.winBack"), field: (r) => (r.state === LAPSED ? r.winBackAttempts?.length || 0 : "") },
    ]);
    done(t("renewal.exportStarted"), t("renewal.rowsExported", { count: filtered.length }));
  };

  // ---------------------------------------------------------------- columns
  const statusBody = (r) => (r.state === GRACE
    ? <StatusChip label={t("lapse.status.grace")} severity="warning" />
    : <StatusChip label={t("lapse.status.lapsed")} severity="danger" />);
  const daysBody = (r) => {
    if (r.state === GRACE) {
      const left = Math.max(0, Math.round((new Date(`${r.graceEnd}T00:00:00`) - new Date(toIsoDate(new Date()))) / 86400000));
      return <span className="bv-cell-stack"><span>{t("lapse.graceLeft", { count: left })}</span><small>{t("lapse.graceEnds", { date: formatDate(r.graceEnd) })}</small></span>;
    }
    return <span className="bv-cell-stack"><span>{t("lapse.daysLapsed", { count: r.daysLapsed || 0 })}</span><small>{formatDate(r.lapseDate)}</small></span>;
  };
  const reasonBody = (r) => (r.lapseReason
    ? <span className="bv-cell-clip" title={r.lapseReason}>{r.lapseReason}</span>
    : <span className="bv-muted">—</span>);
  const winBackBody = (r) => {
    if (r.state === GRACE) return <span className="bv-muted">—</span>;
    const n = r.winBackAttempts?.length || 0;
    return n ? <span>{t("lapse.offersMade", { count: n })}</span> : <span className="bv-muted">{t("lapse.noOffer")}</span>;
  };
  const actionsOf = (r) => [
    { key: "offer", label: t("lapse.recordOffer"), icon: "pi pi-send", onClick: () => openWinBack(r), hidden: r.state !== LAPSED || !r.reinstatementEligible },
    { key: "reinstate", label: t("lapse.reinstate"), icon: "pi pi-replay", onClick: () => reinstate(r), hidden: r.state !== LAPSED || !r.reinstatementEligible, primary: true },
    { key: "lapse", label: t("lapse.markLapsed"), icon: "pi pi-ban", onClick: () => setLapse({ row: r, code: null, note: "" }), hidden: r.state !== GRACE, danger: true },
  ].filter((a) => !a.hidden);
  const actionsBody = (r) => (
    <RowActions actions={[{ icon: "pi pi-eye", label: t("lapse.view"), onClick: () => setPanelId(r.id) }]}
      menu={actionsOf(r).map((a) => ({ label: a.label, icon: a.icon, command: a.onClick, className: a.danger ? "bv-menu-danger" : undefined }))} />
  );

  const listTab = (
    <SectionCard>
      <FilterBar active={!!(search || state || reason)} onClear={() => { setSearch(""); setState(""); setReason(""); }}
        end={<Button icon="pi pi-download" outlined label={t("lapse.export")} tooltip={t("renewal.exportToCsv")} tooltipOptions={{ position: "top" }}
          onClick={exportCsv} disabled={!filtered.length} />}>
        <span className="p-input-icon-left bv-filter-bar__search">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("lapse.searchHint")} aria-label={t("lapse.searchHint")} />
        </span>
        <Dropdown value={state} onChange={(e) => setState(e.value || "")} aria-label={t("lapse.col.status")}
          options={[{ label: t("lapse.allStates"), value: "" }, { label: t("lapse.status.lapsed"), value: LAPSED }, { label: t("lapse.status.grace"), value: GRACE },
            { label: t("lapse.figures.eligible"), value: "eligible" }]} />
        <Dropdown value={reason} onChange={(e) => setReason(e.value || "")} filter aria-label={t("lapse.col.reason")}
          options={[{ label: t("lapse.allReasons"), value: "" }, ...lapseCodes]} />
      </FilterBar>
      <DataTable value={filtered} dataKey="id" loading={loading} paginator rows={20} size="small"
        emptyMessage={<EmptyState icon="pi-check-circle" title={t("lapse.emptyTitle")} text={rows.length ? t("lapse.emptyFiltered") : t("lapse.emptyText")} />}>
        <Column field="policyNumber" header={t("lapse.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.insuredName} onOpen={() => setPanelId(r.id)} />} />
        <Column field="product" header={t("lapse.col.product")} sortable />
        <Column field="state" header={t("lapse.col.status")} sortable body={statusBody} />
        <Column field="daysLapsed" header={t("lapse.col.days")} sortable body={daysBody} />
        <Column field="premiumLost" header={t("lapse.col.premium")} sortable body={(r) => formatCurrency(r.premiumLost)} className="bv-num" headerClassName="bv-num" />
        <Column field="lapseReason" header={t("lapse.col.reason")} body={reasonBody} />
        <Column header={t("lapse.col.winBack")} body={winBackBody} />
        <Column header={t("lapse.col.actions")} body={actionsBody} className="bv-actions" headerClassName="bv-actions" />
      </DataTable>
    </SectionCard>
  );

  const campaignsTab = (
    <SectionCard flush actions={<Button icon="pi pi-plus" label={t("lapse.newCampaign")} onClick={openCampaign} />} title={t("lapse.campaigns")}>
      <DataTable value={campaigns} dataKey="id" loading={loading} size="small" paginator={campaigns.length > 20} rows={20}
        emptyMessage={<EmptyState icon="pi-megaphone" title={t("lapse.noCampaigns")} text={t("lapse.noCampaignsText")}
          action={<Button outlined icon="pi pi-plus" label={t("lapse.newCampaign")} onClick={openCampaign} />} />}>
        <Column field="campaignName" header={t("lapse.campaign.name")} body={(c) => <span className="bv-cell-stack"><span>{c.campaignName}</span><small>{c.campaignId}</small></span>} />
        <Column header={t("lapse.campaign.period")} body={(c) => `${formatDate(c.startDate)} - ${formatDate(c.endDate)}`} />
        <Column field="targetSegment" header={t("lapse.campaign.target")} body={(c) => t(`lapse.segments.${c.targetSegment}`, c.targetSegment || "—")} />
        <Column header={t("lapse.campaign.discount")} body={(c) => `${Number(c.offer?.discount || 0)}%`} className="bv-num" headerClassName="bv-num" />
        <Column header={t("lapse.campaign.contacted")} body={(c) => c.statistics?.contacted ?? 0} className="bv-num" headerClassName="bv-num" />
        <Column header={t("lapse.campaign.converted")} body={(c) => c.statistics?.converted ?? 0} className="bv-num" headerClassName="bv-num" />
        <Column header={t("lapse.campaign.rate")} body={(c) => formatPercent(c.statistics?.conversionRate || 0)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("lapse.campaign.recovered")} body={(c) => formatCurrency(c.statistics?.revenueRecovered || 0)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("lapse.campaign.status")} body={(c) => <StatusChip status={c.status} />} />
      </DataTable>
    </SectionCard>
  );

  return (
    <div className="bv-ops-page lapse-page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <RenewalHeader title={t("lapse.title")}
        actions={<Button icon="pi pi-refresh" text rounded aria-label={t("lapse.refresh")} tooltip={t("lapse.refresh")} tooltipOptions={{ position: "top" }} onClick={load} loading={loading} />} />
      <StatCards items={figures} />
      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)} className="bv-tabbar">
        <TabPanel header={t("lapse.tabList")} />
        <TabPanel header={t("lapse.tabCampaigns")} />
      </TabView>
      {tab === 0 ? listTab : campaignsTab}

      <SidePanel visible={!!selected} onHide={() => setPanelId(null)} wide title={selected ? `${selected.policyNumber} · ${selected.insuredName || ""}` : ""}
        meta={selected ? statusBody(selected) : null}
        footer={selected ? actionsOf(selected).map((a) => (
          <Button key={a.key} label={a.label} icon={a.icon} outlined={!a.primary} severity={a.danger ? "danger" : undefined} onClick={a.onClick} />
        )) : null}>
        {selected ? (
          <>
            <PanelSection title={t("lapse.policy")}>
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "product", label: t("lapse.col.product"), value: selected.product },
                { key: "premium", label: t("lapse.col.premium"), value: formatCurrency(selected.premiumLost) },
                selected.state === LAPSED
                  ? { key: "lapsed", label: t("lapse.lapseDate"), value: formatDate(selected.lapseDate) }
                  : { key: "grace", label: t("lapse.graceEnd"), value: formatDate(selected.graceEnd) },
                selected.state === LAPSED ? { key: "deadline", label: t("lapse.reinstateBy"), value: formatDate(selected.reinstatementDeadline) } : null,
                { key: "reason", label: t("lapse.col.reason"), value: selected.lapseReason },
              ]} />
            </PanelSection>
            {selected.state === LAPSED ? (
              <PanelSection title={t("lapse.history")}>
                {selected.winBackAttempts?.length ? (
                  <table className="bv-detail-table">
                    <thead>
                      <tr>
                        <th>{t("lapse.historyCol.date")}</th>
                        <th>{t("lapse.historyCol.channel")}</th>
                        <th>{t("lapse.historyCol.offer")}</th>
                        <th>{t("lapse.historyCol.response")}</th>
                        <th>{t("lapse.historyCol.by")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.winBackAttempts.map((a) => (
                        <tr key={a.id}>
                          <td className="bv-nowrap">{formatDate(a.date)}</td>
                          <td>{t(`lapse.channels.${a.method}`, a.method || "—")}</td>
                          <td>{a.offer || a.description || "—"}</td>
                          <td>{a.outcome || <span className="bv-muted">{t("lapse.noResponse")}</span>}</td>
                          <td>{a.by || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="bv-panel-note">{t("lapse.noHistory")}</p>}
              </PanelSection>
            ) : null}
          </>
        ) : null}
      </SidePanel>

      <Dialog header={t("lapse.recordOffer")} visible={!!winBack} onHide={() => setWinBack(null)} style={{ width: "44rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setWinBack(null)} />
            <Button label={t("lapse.save")} icon="pi pi-check" onClick={sendWinBack} loading={saving} />
          </div>
        )}>
        {winBack ? (
          <div className="grid">
            <div className="col-12"><p className="bv-panel-text">{`${winBack.row.policyNumber} · ${winBack.row.insuredName || ""} · ${formatCurrency(winBack.row.premiumLost)}`}</p></div>
            <div className="col-12 md:col-4">
              <label htmlFor="wb-channel">{t("lapse.historyCol.channel")}</label>
              <Dropdown inputId="wb-channel" value={winBack.method} onChange={(e) => setWinBack({ ...winBack, method: e.value })} className="w-full"
                options={CHANNELS.map((c) => ({ label: t(`lapse.channels.${c}`, c), value: c }))} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="wb-discount">{t("lapse.discount")}</label>
              <InputNumber inputId="wb-discount" value={winBack.discount} onValueChange={(e) => setWinBack({ ...winBack, discount: e.value || 0 })} min={0} max={100} suffix="%" className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="wb-valid">{t("lapse.validUntil")}</label>
              <Calendar inputId="wb-valid" value={winBack.validUntil} onChange={(e) => setWinBack({ ...winBack, validUntil: e.value })} dateFormat={calendarDateFormat()} minDate={new Date()} showIcon className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="wb-terms">{t("lapse.paymentTermsLabel")}</label>
              <Dropdown inputId="wb-terms" value={winBack.paymentTerms} onChange={(e) => setWinBack({ ...winBack, paymentTerms: e.value })} className="w-full"
                options={PAYMENT_TERMS.map((p) => ({ label: t(`lapse.paymentTerms.${p}`, p), value: p }))} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="wb-campaign">{t("lapse.campaignLabel")}</label>
              <Dropdown inputId="wb-campaign" value={winBack.campaignId} onChange={(e) => setWinBack({ ...winBack, campaignId: e.value || null })} showClear className="w-full"
                placeholder={t("lapse.noCampaign")} options={campaigns.map((c) => ({ label: `${c.campaignName} (${c.campaignId})`, value: c.id }))} />
            </div>
            <div className="col-12">
              <label>{t("lapse.benefitsLabel")}</label>
              <div className="lapse-benefits">
                {BENEFITS.map((b) => (
                  <span key={b} className="lapse-benefits__item">
                    <Checkbox inputId={`wb-${b}`} checked={winBack.benefits.includes(b)}
                      onChange={(e) => setWinBack({ ...winBack, benefits: e.checked ? [...winBack.benefits, b] : winBack.benefits.filter((x) => x !== b) })} />
                    <label htmlFor={`wb-${b}`}>{t(`lapse.benefits.${b}`, b)}</label>
                  </span>
                ))}
              </div>
            </div>
            <div className="col-12">
              <label htmlFor="wb-response">{t("lapse.clientResponse")}</label>
              <InputText id="wb-response" value={winBack.response} onChange={(e) => setWinBack({ ...winBack, response: e.target.value })} className="w-full" maxLength={500} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("lapse.markLapsed")} visible={!!lapse} onHide={() => setLapse(null)} style={{ width: "32rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setLapse(null)} />
            <Button label={t("lapse.markLapsed")} icon="pi pi-ban" severity="danger" onClick={confirmLapse} loading={saving}
              disabled={noteNeeded && (lapse?.note || "").trim().length < 3} />
          </div>
        )}>
        {lapse ? (
          <div className="grid">
            <div className="col-12"><p className="bv-panel-text">{`${lapse.row.policyNumber} · ${lapse.row.insuredName || ""}`}</p></div>
            <div className="col-12">
              <label htmlFor="lp-code">{t("lapse.reasonCode")}</label>
              <Dropdown inputId="lp-code" value={lapse.code} options={lapseCodes} onChange={(e) => setLapse({ ...lapse, code: e.value || null })} showClear className="w-full"
                placeholder={t("lapse.reasonCodeNone")} />
            </div>
            <div className="col-12">
              <label htmlFor="lp-note">{noteNeeded ? `${t("lapse.reasonNote")} *` : t("lapse.reasonNote")}</label>
              <InputTextarea id="lp-note" value={lapse.note} onChange={(e) => setLapse({ ...lapse, note: e.target.value })} rows={3} autoResize className="w-full" />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("lapse.newCampaign")} visible={!!campaign} onHide={() => setCampaign(null)} style={{ width: "44rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setCampaign(null)} />
            <Button label={t("lapse.createCampaign")} icon="pi pi-check" onClick={saveCampaign} loading={saving} />
          </div>
        )}>
        {campaign ? (
          <div className="grid">
            <div className="col-12">
              <label htmlFor="cp-name">{t("lapse.campaign.name")} *</label>
              <InputText id="cp-name" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} className="w-full" maxLength={200} />
              <FieldError error={campaignErrors.name} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="cp-start">{t("lapse.startDate")} *</label>
              <Calendar inputId="cp-start" value={campaign.startDate} onChange={(e) => setCampaign({ ...campaign, startDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" />
              <FieldError error={campaignErrors.startDate} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="cp-end">{t("lapse.endDate")} *</label>
              <Calendar inputId="cp-end" value={campaign.endDate} onChange={(e) => setCampaign({ ...campaign, endDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" />
              <FieldError error={campaignErrors.endDate} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="cp-target">{t("lapse.campaign.target")}</label>
              <Dropdown inputId="cp-target" value={campaign.targetSegment} onChange={(e) => setCampaign({ ...campaign, targetSegment: e.value })} className="w-full"
                options={SEGMENTS.map((s) => ({ label: t(`lapse.segments.${s}`, s), value: s }))} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="cp-discount">{t("lapse.campaign.discount")}</label>
              <InputNumber inputId="cp-discount" value={campaign.discount} onValueChange={(e) => setCampaign({ ...campaign, discount: e.value || 0 })} min={0} max={100} suffix="%" className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="cp-budget">{t("lapse.budget")}</label>
              <InputNumber inputId="cp-budget" value={campaign.budget} onValueChange={(e) => setCampaign({ ...campaign, budget: e.value })} mode="currency" currency={currencyCode} locale={locale} min={0} className="w-full" />
            </div>
            <div className="col-12">
              <label>{t("lapse.benefitsLabel")}</label>
              <div className="lapse-benefits">
                {BENEFITS.map((b) => (
                  <span key={b} className="lapse-benefits__item">
                    <Checkbox inputId={`cp-${b}`} checked={campaign.benefits.includes(b)}
                      onChange={(e) => setCampaign({ ...campaign, benefits: e.checked ? [...campaign.benefits, b] : campaign.benefits.filter((x) => x !== b) })} />
                    <label htmlFor={`cp-${b}`}>{t(`lapse.benefits.${b}`, b)}</label>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default LapseManagement;
