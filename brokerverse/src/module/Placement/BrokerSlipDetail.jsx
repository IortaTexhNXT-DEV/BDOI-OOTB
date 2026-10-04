import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { RadioButton } from "primereact/radiobutton";
import { SelectButton } from "primereact/selectbutton";
import { TabView, TabPanel } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import placementService from "../../services/placementService";
import s3Service from "../../services/s3Service";
import { useEmailSending, withQueuedNotice } from "../../utility/emailNotice";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { calendarDateFormat } from "../../utility/dateFormat";
import { Field, JourneyTimeline, PageHeader, StatusTag, formatDate, round2, usePlacementOptions } from "./shared";
import { isoDate, fromIso } from "./dates";
import canOpen from "../../utils/canOpen";
import "./index.scss";

const OPEN = ["draft", "submitted", "responses-in"];

/** Broker Slip detail: market responses, comparison of the offers and the next journey step from the selected offer(s). */
const BrokerSlipDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  // broker slips and placement slips go to the insurers by e-mail
  const emailSending = useEmailSending();
  const options = usePlacementOptions();
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [offerForm, setOfferForm] = useState(null);
  const [addInsurer, setAddInsurer] = useState(null);
  const [closing, setClosing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [leadOfferId, setLeadOfferId] = useState(null);
  const [shares, setShares] = useState({});

  const notify = (severity, detail) => toast.current?.show({ severity, summary: severity === "error" ? t("common.error") : t("placement.messages.done"), detail, life: severity === "error" ? 5000 : 3000 });
  const load = useCallback(async () => {
    try {
      const s = await placementService.getSlip(id);
      setSlip(s);
      if (s.status === "responses-in") setTab((current) => (current === 0 ? 1 : current));
    } catch (e) {
      notify("error", e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      const out = await fn();
      if (message) notify("success", typeof message === "function" ? message(out) : message);
      await load();
      return out;
    } catch (e) {
      notify("error", e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const offered = useMemo(() => (slip?.comparison?.rows || []).filter((o) => o.status === "offered").sort((a, b) => (a.rank || 99) - (b.rank || 99)), [slip]);
  const chosen = offered.filter((o) => selected.includes(o.id));
  const shareOf = (o) => (shares[o.id] !== undefined ? shares[o.id] : o.offeredShare);
  const selectedTotal = round2(chosen.reduce((s, o) => s + (Number(shareOf(o)) || 0), 0));
  const lead = chosen.find((o) => o.id === leadOfferId) || chosen[0];

  if (!slip) return <div className="placement-page"><Toast ref={toast} /><div className="placement-card">{t("placement.messages.loading")}</div></div>;
  const journey = slip.journey || {};
  const steps = [
    { key: "brokerSlip", done: true, reference: slip.slipNumber, id: slip.id, mode: journey.brokerSlip },
    { key: "quotationSlip", done: Boolean(slip.quoteId), reference: slip.quotationNumber, id: slip.quoteId, mode: journey.quotationSlip },
    { key: "placementSlip", done: Boolean(slip.placementId), reference: slip.placementNumber, id: slip.placementId, mode: journey.placementSlip },
    { key: "policy", done: Boolean(slip.policyId), reference: slip.policyNumber, id: slip.policyId, mode: "required" },
  ];
  const canSelect = ["submitted", "responses-in"].includes(slip.status);

  const saveOffer = async () => {
    const f = offerForm;
    const body = { status: f.status, remarks: f.remarks || undefined, insurerReference: f.insurerReference || undefined, attachmentKey: f.attachmentKey || undefined, attachmentName: f.attachmentName || undefined };
    if (f.status === "offered") Object.assign(body, { premium: f.premium, rate: f.rate ?? undefined, taxes: f.taxes ?? undefined, premiumTotal: f.premiumTotal ?? undefined,
      deductibles: f.deductibles || undefined, terms: f.terms || undefined, validityDate: isoDate(f.validityDate), offeredShare: f.offeredShare });
    else body.declineReason = f.declineReason || undefined;
    const ok = await act(() => placementService.recordOffer(slip.id, f.offerId, body), t("placement.messages.offerRecorded", { insurer: f.insuranceCompanyName }));
    if (ok) setOfferForm(null);
  };
  const upload = async (file) => {
    try {
      const r = await s3Service.uploadFile(file, "insurer-offers");
      setOfferForm((f) => ({ ...f, attachmentKey: r.key, attachmentName: file.name }));
    } catch (e) {
      notify("error", e.message);
    }
  };
  const openAttachment = async (key) => {
    const r = await s3Service.generatePresignedDownloadUrl(key);
    if (r.success) window.open(r.url, "_blank", "noopener,noreferrer");
    else notify("error", r.error);
  };
  const next = async (kind) => {
    const body = { offerIds: chosen.map((o) => o.id), leadOfferId: lead?.id, shares: Object.fromEntries(chosen.map((o) => [o.id, shareOf(o)])) };
    if (kind === "quotation") {
      const res = await act(() => placementService.prepareQuotation(slip.id, body), (r) => t("placement.messages.quotationPrepared", { number: r.data?.quotationNumber }));
      if (res?.quotationId) navigate(`/agent/quotedetailview/${res.quotationId}`);
    } else {
      const p = await act(() => placementService.preparePlacement(slip.id, body), (r) => t("placement.messages.placementPrepared", { number: r.placementNumber }));
      if (p?.id) navigate(`/placement/placement-slips/${p.id}`);
    }
  };

  const offerRow = (o) => (
    <tr key={o.id} className={o.isBest ? "best-row" : ""}>
      <td><strong>{o.insuranceCompanyName}</strong><div className="muted small">{o.offerNumber}</div></td>
      <td><StatusTag status={o.status} /></td>
      <td className="num">{o.premium == null ? "-" : formatCurrency(o.premium)}</td>
      <td className="num">{o.rate == null ? "-" : `${o.rate}%`}</td>
      <td className="num">{o.taxes == null ? "-" : formatCurrency(o.taxes)}</td>
      <td className="num">{o.premiumTotal == null ? "-" : <strong>{formatCurrency(o.premiumTotal)}</strong>}</td>
      <td className="num">{o.status === "offered" ? `${o.offeredShare}%` : "-"}</td>
      <td>{o.deductibles || (o.declineReason ? <span className="muted">{o.declineReason}</span> : "-")}</td>
      <td>{o.terms || "-"}</td>
      <td>{formatDate(o.validityDate)}</td>
      <td>{o.insurerReference || "-"}{o.attachmentKey && <Button icon="pi pi-paperclip" text rounded onClick={() => openAttachment(o.attachmentKey)} tooltip={o.attachmentName} aria-label={o.attachmentName} />}</td>
      <td className="actions-cell">
        {canSelect && <Button label={o.status === "pending" ? t("placement.actions.recordResponse") : t("placement.actions.edit")} size="small" text icon="pi pi-pencil"
          onClick={() => setOfferForm({ ...o, status: o.status === "pending" ? "offered" : o.status, validityDate: fromIso(o.validityDate) })} />}
        <Button icon="pi pi-file-pdf" text rounded size="small" onClick={() => placementService.openSlipPdf(slip.id, o.insuranceCompanyId).catch((e) => notify("error", e.message))} aria-label={t("placement.actions.slipPdf")} tooltip={t("placement.actions.slipPdf")} />
      </td>
    </tr>
  );

  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("placement.brokerSlip.title")} ${slip.slipNumber}`} subtitle={`${slip.insuredName || slip.customerName} - ${slip.productType || ""}`} onBack={() => navigate("/placement/broker-slips")}>
        <StatusTag status={slip.status} />
        <Button label={t("placement.actions.slipPdf")} icon="pi pi-file-pdf" severity="secondary" outlined onClick={() => placementService.openSlipPdf(slip.id).catch((e) => notify("error", e.message))} className="ml-2" />
        {!["draft", "cancelled"].includes(slip.status) && canOpen("/sales/comparison-reports") && (
          <Button label={t("distribution.cr.clientReport", "Client comparison report")} icon="pi pi-star" severity="secondary" outlined className="ml-2"
            onClick={() => navigate(`/sales/comparison-reports?brokerSlipId=${encodeURIComponent(slip.id)}&slipNumber=${encodeURIComponent(slip.slipNumber)}`)} />
        )}
        {OPEN.includes(slip.status) && <Button label={t("placement.actions.addInsurer")} icon="pi pi-plus" severity="secondary" outlined onClick={() => setAddInsurer({ insurer: null })} className="ml-2" />}
        {slip.status === "draft" && <Button label={t("placement.actions.submitToMarket")} icon="pi pi-send" onClick={() => act(() => placementService.submitSlip(slip.id), (r) => withQueuedNotice(t("placement.messages.submitted", { count: r.sent?.length || 0 }), emailSending))} loading={busy} className="ml-2" />}
        {OPEN.includes(slip.status) && <Button label={t("placement.actions.more")} icon="pi pi-times" severity="danger" text onClick={() => setClosing({ status: "cancelled", reason: "" })} className="ml-2" />}
      </PageHeader>

      <div className="placement-card"><JourneyTimeline steps={steps} /></div>

      <div className="placement-card">
        <div className="field-grid">
          <Field label={t("placement.fields.customer")}>{slip.customerName}</Field>
          <Field label={t("placement.fields.product")}>{slip.productType} ({slip.lob})</Field>
          <Field label={t("placement.fields.sumInsured")}>{formatCurrency(slip.sumInsured)}</Field>
          <Field label={t("placement.fields.period")}>{slip.inceptionDate ? `${formatDate(slip.inceptionDate)} - ${formatDate(slip.expiryDate)}` : "-"}</Field>
          <Field label={t("placement.fields.submitted")}>{formatDate(slip.submissionDate)}</Field>
          <Field label={t("placement.fields.responseDue")}>{formatDate(slip.responseDueDate)}</Field>
          <Field label={t("placement.fields.bestPremium")}>{slip.comparison.summary.bestPremium == null ? "-" : formatCurrency(slip.comparison.summary.bestPremium)}</Field>
          <Field label={t("placement.fields.createdBy")}>{slip.createdBy}</Field>
          {slip.remarks && <Field label={t("placement.fields.remarks")}>{slip.remarks}</Field>}
          {slip.cancelReason && <Field label={t("placement.fields.reason")}>{slip.cancelReason}</Field>}
        </div>
      </div>

      <div className="placement-card">
            <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
              <TabPanel header={t("placement.brokerSlip.tabResponses", { count: slip.offers.length })}>
                <div className="table-scroll">
                  <table className="participant-table readonly offers">
                    <thead><tr>
                      <th>{t("placement.fields.insurer")}</th><th>{t("placement.fields.status")}</th><th className="num">{t("placement.fields.premium")}</th><th className="num">{t("placement.fields.rate")}</th>
                      <th className="num">{t("placement.fields.taxes")}</th><th className="num">{t("placement.fields.grossPremium")}</th><th className="num">{t("placement.fields.line")}</th>
                      <th>{t("placement.fields.deductibles")}</th><th>{t("placement.fields.terms")}</th><th>{t("placement.fields.validUntil")}</th><th>{t("placement.fields.reference")}</th><th />
                    </tr></thead>
                    <tbody>{slip.offers.map((o) => offerRow(slip.comparison.rows.find((r) => r.id === o.id) || o))}</tbody>
                  </table>
                </div>
              </TabPanel>
              <TabPanel header={t("placement.brokerSlip.tabCompare")}>
                <div className="compare-summary">
                  <span><strong>{slip.comparison.summary.offered}</strong> {t("placement.compare.offers")}</span>
                  <span><strong>{slip.comparison.summary.declined}</strong> {t("placement.compare.declines")}</span>
                  <span><strong>{slip.comparison.summary.pending}</strong> {t("placement.compare.pending")}</span>
                  <span>{t("placement.compare.capacity")}: <strong>{slip.comparison.summary.capacityPercent}%</strong></span>
                </div>
                {offered.length ? (
                  <div className="table-scroll"><table className="participant-table compare">
                    <thead><tr>
                      <th className="center">{t("placement.compare.select")}</th><th className="center">{t("placement.participants.lead")}</th><th>#</th><th>{t("placement.fields.insurer")}</th>
                      <th className="num">{t("placement.fields.grossPremium")}</th><th className="num">{t("placement.compare.vsBest")}</th><th className="num">{t("placement.fields.rate")}</th>
                      <th>{t("placement.fields.deductibles")}</th><th>{t("placement.fields.terms")}</th><th className="num">{t("placement.fields.line")}</th><th className="num">{t("placement.compare.shareTaken")}</th>
                    </tr></thead>
                    <tbody>
                      {offered.map((o) => (
                        <tr key={o.id} className={o.isBest ? "best-row" : ""}>
                          <td className="center"><Checkbox checked={selected.includes(o.id)} disabled={!canSelect} onChange={(e) => setSelected(e.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} aria-label={o.insuranceCompanyName} /></td>
                          <td className="center"><RadioButton checked={lead?.id === o.id && selected.includes(o.id)} disabled={!selected.includes(o.id)} onChange={() => setLeadOfferId(o.id)} aria-label={t("placement.participants.lead")} /></td>
                          <td>{o.rank}{o.isBest && <Tag value={t("placement.compare.best")} severity="success" className="ml-2" />}</td>
                          <td>{o.insuranceCompanyName}</td>
                          <td className="num"><strong>{formatCurrency(o.premiumTotal)}</strong></td>
                          <td className="num">{o.differenceFromBest ? `+${formatCurrency(o.differenceFromBest)}` : "-"}</td>
                          <td className="num">{o.rate == null ? "-" : `${o.rate}%`}</td>
                          <td>{o.deductibles || "-"}</td>
                          <td>{o.terms || "-"}</td>
                          <td className="num">{o.offeredShare}%</td>
                          <td className="num" style={{ width: "8rem" }}>
                            <InputNumber value={shareOf(o)} onValueChange={(e) => setShares({ ...shares, [o.id]: e.value })} suffix="%" min={0} max={100} maxFractionDigits={4} disabled={!selected.includes(o.id)} inputClassName="w-full text-right" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={10} className="num">{t("placement.compare.selectedTotal")}</td>
                      <td className="num"><strong className={Math.abs(selectedTotal - 100) < 0.0001 ? "total-ok" : "total-bad"}>{selectedTotal}%</strong></td></tr></tfoot>
                  </table></div>
                ) : <div className="empty-note">{t("placement.compare.noOffers")}</div>}
                {canSelect && (
                  <div className="form-actions">
                    <span className="muted">{chosen.length > 1 ? t("placement.compare.coNote", { lead: lead?.insuranceCompanyName }) : t("placement.compare.singleNote")}</span>
                    {journey.quotationSlip !== "skip" && <Button label={t("placement.actions.prepareQuotation")} icon="pi pi-file-edit" disabled={!chosen.length || Math.abs(selectedTotal - 100) > 0.0001} loading={busy} onClick={() => next("quotation")} />}
                    {journey.quotationSlip !== "required" && journey.placementSlip !== "skip" && (
                      <Button label={t("placement.actions.preparePlacement")} icon="pi pi-briefcase" severity={journey.quotationSlip === "skip" ? undefined : "secondary"} outlined={journey.quotationSlip !== "skip"}
                        disabled={!chosen.length || Math.abs(selectedTotal - 100) > 0.0001} loading={busy} onClick={() => next("placement")} />
                    )}
                  </div>
                )}
              </TabPanel>
              <TabPanel header={t("placement.brokerSlip.tabRisk")}>
                <div className="field-grid">
                  {Object.entries(slip.riskDetails || {}).map(([k, v]) => <Field key={k} label={k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())}>{String(v)}</Field>)}
                  {slip.doc?.insuranceVehicleDetails?.[0] && ["vehicleBrand", "vehicleModel", "modelYear"].map((k) => <Field key={k} label={t(`placement.vehicle.${k}`)}>{slip.doc.insuranceVehicleDetails[0][k]}</Field>)}
                </div>
                <table className="participant-table readonly mt-3">
                  <thead><tr><th>{t("placement.fields.cover")}</th><th className="num">{t("placement.fields.sumInsured")}</th><th>{t("placement.fields.deductible")}</th></tr></thead>
                  <tbody>{(slip.requestedCovers || []).map((c, i) => <tr key={i}><td>{c.cover}</td><td className="num">{c.sumInsured == null ? "-" : formatCurrency(c.sumInsured)}</td><td>{c.deductible || "-"}</td></tr>)}</tbody>
                </table>
              </TabPanel>
            </TabView>
      </div>


      <Dialog className="placement-dialog" header={offerForm ? t("placement.offer.dialogTitle", { insurer: offerForm.insuranceCompanyName }) : ""} visible={Boolean(offerForm)} onHide={() => setOfferForm(null)} style={{ width: "46rem" }} breakpoints={{ "960px": "95vw" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setOfferForm(null)} /><Button label={t("placement.actions.save")} icon="pi pi-check" onClick={saveOffer} loading={busy} /></>}>
        {offerForm && (
          <div className="grid">
            <div className="col-12">
              <SelectButton value={offerForm.status} options={[{ label: t("placement.status.offered"), value: "offered" }, { label: t("placement.status.declined"), value: "declined" }, { label: t("placement.status.pending"), value: "pending" }]}
                onChange={(e) => e.value && setOfferForm({ ...offerForm, status: e.value })} />
            </div>
            {offerForm.status === "offered" ? (
              <>
                <div className="col-12 md:col-4"><label>{t("placement.offer.premium")} *</label><InputNumber value={offerForm.premium} onValueChange={(e) => setOfferForm({ ...offerForm, premium: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" /></div>
                <div className="col-12 md:col-4"><label>{t("placement.offer.rate")}</label><InputNumber value={offerForm.rate} onValueChange={(e) => setOfferForm({ ...offerForm, rate: e.value })} maxFractionDigits={6} suffix="%" className="w-full" inputClassName="w-full" placeholder={t("placement.offer.derived")} /></div>
                <div className="col-12 md:col-4"><label>{t("placement.offer.line")}</label><InputNumber value={offerForm.offeredShare} onValueChange={(e) => setOfferForm({ ...offerForm, offeredShare: e.value })} suffix="%" min={0} max={100} maxFractionDigits={4} className="w-full" inputClassName="w-full" /></div>
                <div className="col-12 md:col-4"><label>{t("placement.offer.taxes")}</label><InputNumber value={offerForm.taxes} onValueChange={(e) => setOfferForm({ ...offerForm, taxes: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" placeholder={t("placement.offer.computed")} /></div>
                <div className="col-12 md:col-4"><label>{t("placement.offer.gross")}</label><InputNumber value={offerForm.premiumTotal} onValueChange={(e) => setOfferForm({ ...offerForm, premiumTotal: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" placeholder={t("placement.offer.computed")} /></div>
                <div className="col-12 md:col-4"><label>{t("placement.offer.validity")}</label><Calendar value={offerForm.validityDate} onChange={(e) => setOfferForm({ ...offerForm, validityDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
                <div className="col-12"><label>{t("placement.offer.deductibles")}</label><InputText value={offerForm.deductibles || ""} onChange={(e) => setOfferForm({ ...offerForm, deductibles: e.target.value })} className="w-full" /></div>
                <div className="col-12"><label>{t("placement.offer.terms")}</label><InputTextarea value={offerForm.terms || ""} onChange={(e) => setOfferForm({ ...offerForm, terms: e.target.value })} rows={2} autoResize className="w-full" /></div>
              </>
            ) : offerForm.status === "declined" ? (
              <div className="col-12"><label>{t("placement.offer.declineReason")}</label><InputText value={offerForm.declineReason || ""} onChange={(e) => setOfferForm({ ...offerForm, declineReason: e.target.value })} className="w-full" /></div>
            ) : null}
            <div className="col-12 md:col-6"><label>{t("placement.offer.reference")}</label><InputText value={offerForm.insurerReference || ""} onChange={(e) => setOfferForm({ ...offerForm, insurerReference: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6">
              <label>{t("placement.offer.attachment")}</label>
              <div className="attachment-line">
                <input type="file" id="offer-file" className="hidden-file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button label={offerForm.attachmentName || t("placement.offer.attach")} icon="pi pi-upload" severity="secondary" outlined size="small" onClick={() => document.getElementById("offer-file").click()} />
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog className="placement-dialog" header={t("placement.actions.addInsurer")} visible={Boolean(addInsurer)} onHide={() => setAddInsurer(null)} style={{ width: "28rem" }}
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setAddInsurer(null)} /><Button label={t("placement.actions.add")} icon="pi pi-plus" disabled={!addInsurer?.insurer} loading={busy}
          onClick={async () => { const ok = await act(() => placementService.addInsurer(slip.id, addInsurer.insurer), t("placement.messages.insurerAdded")); if (ok) setAddInsurer(null); }} /></>}>
        <Dropdown value={addInsurer?.insurer} options={options.insurers.filter((i) => !slip.offers.some((o) => o.insuranceCompanyId === i.id)).map((i) => ({ label: i.name, value: i.id }))}
          onChange={(e) => setAddInsurer({ insurer: e.value })} filter className="w-full" placeholder={t("placement.participants.chooseInsurer")} />
      </Dialog>

      <Dialog className="placement-dialog" header={t("placement.brokerSlip.closeTitle")} visible={Boolean(closing)} onHide={() => setClosing(null)} style={{ width: "32rem" }}
        footer={<><Button label={t("placement.actions.back")} text onClick={() => setClosing(null)} />
          <Button label={t(closing?.status === "closed" ? "placement.actions.closeSlip" : "placement.actions.cancelSlip")} severity="danger" loading={busy}
            onClick={async () => { const ok = await act(() => (closing.status === "closed" ? placementService.closeSlip(slip.id, closing.reason) : placementService.cancelSlip(slip.id, closing.reason)), t("placement.messages.slipClosed")); if (ok) setClosing(null); }} /></>}>
        {closing && (
          <>
            <SelectButton value={closing.status} options={[{ label: t("placement.actions.cancelSlip"), value: "cancelled" }, { label: t("placement.actions.closeSlip"), value: "closed" }]} onChange={(e) => e.value && setClosing({ ...closing, status: e.value })} className="mb-3" />
            <label>{t("placement.fields.reason")}</label>
            <InputTextarea value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} rows={3} className="w-full" />
          </>
        )}
      </Dialog>
    </div>
  );
};

export default BrokerSlipDetail;
