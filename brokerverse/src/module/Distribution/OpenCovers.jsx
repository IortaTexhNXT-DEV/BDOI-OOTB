import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { RecordActivityLog } from "../../components/ActivityLog";
import { ClientPicker, Field, PageHeader, StatusTag, date, isoDay, money, num, printFile, showError, showSuccess, useInsurers } from "./common";

const BASE = "/operations/open-covers";
const CONVEYANCES = ["Sea", "Air", "Land"];
const month = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

/** Periods (YYYY-MM) of the cover, up to this month, that have no declaration yet, latest first. */
const openPeriods = (cover) => {
  const taken = new Set(cover.declarations.map((d) => d.period));
  const first = String(cover.periodFrom).slice(0, 7);
  const today = new Date();
  let [y, m] = [String(cover.periodTo).slice(0, 7), month(today.getFullYear(), today.getMonth() + 1)].sort()[0].split("-").map(Number);
  const out = [];
  while (month(y, m) >= first) {
    if (!taken.has(month(y, m))) out.push(month(y, m));
    m -= 1;
    if (m === 0) [y, m] = [y - 1, 12];
  }
  return out;
};

const EMPTY_SHIPMENT = { kind: "certificate", shipmentDate: new Date(), conveyance: "Sea", vesselName: "", voyageFrom: "", voyageTo: "", billOfLading: "", goodsDescription: "", packing: "", consignee: "", invoiceValue: null, markupPercent: null };

/** Operations > Marine Open Covers: the list of open covers, and one cover with its certificates and declarations. */
const OpenCovers = () => {
  const { id } = useParams();
  return id ? <CoverDetail id={id} /> : <CoverList />;
};

const CoverList = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:marine");
  const insurers = useInsurers();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.openCovers({ status: status || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      const r = await service.createOpenCover({
        clientId: form.client.id, insuranceCompanyId: form.insuranceCompanyId, insurerReference: form.insurerReference || null, periodFrom: isoDay(form.periodFrom), periodTo: isoDay(form.periodTo),
        goodsDescription: form.goodsDescription, voyageScope: form.voyageScope || null, clauses: form.clauses || null, markupPercent: form.markupPercent, minimumPremium: form.minimumPremium || 0,
        declarationFrequency: form.declarationFrequency, rates: form.rates.filter((x) => x.ratePercent && x.limit),
      });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      showError(toast, e);
    }
  };
  const newForm = () => {
    const from = new Date();
    const to = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate() - 1);
    setForm({ client: null, insuranceCompanyId: null, insurerReference: "", periodFrom: from, periodTo: to, goodsDescription: "", voyageScope: "", clauses: "Institute Cargo Clauses (A); Institute War and Strikes Clauses (Cargo)",
      markupPercent: 10, minimumPremium: 500, declarationFrequency: "monthly", rates: CONVEYANCES.map((c) => ({ conveyance: c, ratePercent: null, limit: null })) });
  };
  const setRate = (i, patch) => setForm((f) => ({ ...f, rates: f.rates.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} title={t("distribution.oc.title", "Marine Open Covers")}
        subtitle={t("distribution.oc.subtitle", "Cargo open covers: limits and rates per conveyance, certificates for each shipment and the monthly declarations billed on the open policy.")}>
        {write ? <Button label={t("distribution.oc.new", "New open cover")} icon="pi pi-plus" onClick={newForm} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={status} options={["draft", "active", "expired", "cancelled"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} selectionMode="single" onRowClick={(e) => navigate(`${BASE}/${e.data.id}`)}
          emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="coverNumber" header={t("distribution.oc.number", "Open cover")} />
          <Column field="clientName" header={t("distribution.fl.client", "Client")} />
          <Column field="insurerName" header={t("distribution.fl.insurer", "Insurer")} />
          <Column field="policyNumber" header={t("distribution.fl.policy", "Policy")} />
          <Column header={t("distribution.fl.period", "Period")} body={(r) => `${date(r.periodFrom)} to ${date(r.periodTo)}`} />
          <Column header={t("distribution.oc.conveyances", "Conveyances")} body={(r) => r.rates.map((x) => `${x.conveyance} ${x.ratePercent}%`).join(", ")} />
          <Column field="certificates" header={t("distribution.oc.certificates", "Certificates")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.oc.billed", "Billed premium")} body={(r) => money(r.billedPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={t("distribution.oc.new", "New open cover")} visible={!!form} style={{ width: "min(860px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={create}
          disabled={!form?.client?.id || !form?.insuranceCompanyId || !form?.goodsDescription} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.fl.client", "Client")}><ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder={t("distribution.fl.findClient", "Find the client")} /></Field>
            <Field label={t("distribution.fl.insurer", "Insurer")}><Dropdown value={form.insuranceCompanyId} options={insurers} filter onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value })} /></Field>
            <Field label={t("distribution.fl.from", "Period from")}><Calendar value={form.periodFrom} dateFormat="yy-mm-dd" showIcon onChange={(e) => setForm({ ...form, periodFrom: e.value })} /></Field>
            <Field label={t("distribution.fl.to", "Period to")}><Calendar value={form.periodTo} dateFormat="yy-mm-dd" showIcon onChange={(e) => setForm({ ...form, periodTo: e.value })} /></Field>
            <Field label={t("distribution.oc.goods", "Goods insured")} full><InputText value={form.goodsDescription} onChange={(e) => setForm({ ...form, goodsDescription: e.target.value })} /></Field>
            <Field label={t("distribution.oc.voyages", "Voyages")} full><InputText value={form.voyageScope} onChange={(e) => setForm({ ...form, voyageScope: e.target.value })} /></Field>
            <Field label={t("distribution.oc.clauses", "Clauses")} full><InputTextarea rows={2} value={form.clauses} onChange={(e) => setForm({ ...form, clauses: e.target.value })} /></Field>
            {form.rates.map((r, i) => (
              <Field key={r.conveyance} label={`${t(`distribution.oc.conveyance.${r.conveyance}`, r.conveyance)}: ${t("distribution.oc.rateAndLimit", "rate % and limit per conveyance")}`} full>
                <span className="flex gap-2">
                  <InputNumber value={r.ratePercent} min={0} maxFractionDigits={4} placeholder={t("distribution.oc.rate", "Rate %")} onValueChange={(e) => setRate(i, { ratePercent: e.value })} />
                  <InputNumber value={r.limit} min={0} placeholder={t("distribution.oc.limit", "Limit any one conveyance")} onValueChange={(e) => setRate(i, { limit: e.value })} />
                </span>
              </Field>
            ))}
            <Field label={t("distribution.oc.markup", "Mark-up on invoice %")}><InputNumber value={form.markupPercent} min={0} max={100} onValueChange={(e) => setForm({ ...form, markupPercent: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.oc.minimum", "Minimum premium per certificate")}><InputNumber value={form.minimumPremium} min={0} onValueChange={(e) => setForm({ ...form, minimumPremium: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.oc.frequency", "Declarations")}>
              <Dropdown value={form.declarationFrequency} options={["monthly", "quarterly"].map((v) => ({ value: v, label: t(`distribution.oc.freq.${v}`, v) }))} onChange={(e) => setForm({ ...form, declarationFrequency: e.value })} />
            </Field>
            <Field label={t("distribution.oc.insurerReference", "Insurer's reference")}><InputText value={form.insurerReference} onChange={(e) => setForm({ ...form, insurerReference: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

const CoverDetail = ({ id }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:marine");
  const [cover, setCover] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [declaration, setDeclaration] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCover(await service.openCover(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, reload = true) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      if (reload) await load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const openDeclaration = async (d) => {
    try {
      setDeclaration(await service.declaration(d.id));
    } catch (e) {
      showError(toast, e);
    }
  };
  const saveShipment = async () => {
    const { kind, ...rest } = shipment;
    const body = { ...rest, shipmentDate: isoDay(rest.shipmentDate), markupPercent: rest.markupPercent ?? undefined };
    const r = await run(() => (kind === "declared" ? service.addDeclaredItem(cover.id, body) : service.issueCertificate(cover.id, body)));
    if (r) setShipment(null);
  };
  // an action asked in a confirmation: it runs in the dialog (a failure stays there), then the cover is reloaded
  const confirmRun = async (options, fn) => {
    let result = null;
    const done = await openConfirm({ ...options, onConfirm: async (value) => { result = await fn(value); } });
    if (!done) return null;
    if (result?.message) showSuccess(toast, result.message);
    await load();
    return result;
  };
  const coverFacts = () => [
    { label: t("distribution.oc.number", "Open cover"), value: cover.coverNumber },
    { label: t("distribution.fl.client", "Client"), value: cover.clientName },
    { label: t("distribution.fl.insurer", "Insurer"), value: cover.insurerName },
    { label: t("distribution.fl.period", "Period"), value: `${date(cover.periodFrom)} – ${date(cover.periodTo)}` },
  ];
  const activate = () => confirmRun({
    title: t("distribution.oc.activateTitle", "Activate open cover"),
    message: t("distribution.oc.activateMessage", "The open policy is issued. Premium is billed on the declarations."),
    facts: [...coverFacts(), { label: t("distribution.oc.minimum", "Minimum premium per certificate"), value: cover.minimumPremium, type: "amount" }],
    confirmLabel: t("distribution.oc.activateAction", "Activate open cover"),
  }, () => service.activateOpenCover(cover.id));
  const cancelCover = () => confirmRun({
    title: t("distribution.oc.cancelTitle", "Cancel open cover"),
    severity: "danger",
    message: t("distribution.oc.cancelMessage", "No certificate can be issued on the cover after it is cancelled."),
    facts: [...coverFacts(), { label: t("distribution.oc.certificates", "Certificates"), value: cover.certificates, type: "number" }],
    input: { type: "textarea", label: t("distribution.oc.reason", "Reason"), required: true },
    confirmLabel: t("distribution.oc.cancel", "Cancel cover"),
    cancelLabel: t("distribution.common.back", "Back"),
  }, (reason) => service.cancelOpenCover(cover.id, reason));
  const cancelCertificate = (x) => confirmRun({
    title: t("distribution.oc.cancelCert", "Cancel certificate"),
    severity: "danger",
    message: t("distribution.oc.cancelCertMessage", "The certificate is cancelled and left out of the declaration of its period."),
    facts: [
      { label: t("distribution.oc.certificate", "Certificate"), value: x.certificateNumber },
      { label: t("distribution.oc.shipped", "Shipped"), value: x.shipmentDate, type: "date" },
      { label: t("distribution.oc.voyage", "Voyage"), value: `${x.voyageFrom} – ${x.voyageTo}` },
      { label: t("distribution.oc.insured", "Insured value"), value: x.insuredValue, type: "amount" },
      { label: t("distribution.fl.premium", "Premium"), value: x.premium, type: "amount" },
    ],
    input: { type: "textarea", label: t("distribution.oc.reason", "Reason"), required: true },
    confirmLabel: t("distribution.oc.cancelCert", "Cancel certificate"),
    cancelLabel: t("distribution.common.back", "Back"),
  }, (reason) => service.cancelCertificate(x.id, reason));
  const newDeclaration = () => {
    const periods = openPeriods(cover);
    return confirmRun({
      title: t("distribution.oc.newDeclaration", "New declaration"),
      message: t("distribution.oc.newDeclarationMessage", "The shipments of the period are attached to the declaration and priced with the premium taxes."),
      facts: coverFacts(),
      input: {
        type: "select", label: t("distribution.oc.period", "Period"), required: true, defaultValue: periods[0] || null,
        options: periods.map((v) => ({ value: v, label: `${v.slice(5)}/${v.slice(0, 4)}` })),
      },
      confirmLabel: t("distribution.oc.openDeclaration", "Open declaration"),
    }, (period) => service.createDeclaration(cover.id, period));
  };
  const declAction = async (fn) => {
    const r = await run(fn);
    if (r && declaration) openDeclaration(declaration);
  };
  const deleteDeclaration = async () => {
    const r = await confirmRun({
      title: t("distribution.oc.deleteDeclarationTitle", "Delete declaration"),
      severity: "danger",
      message: t("distribution.oc.deleteDeclarationMessage", "The draft declaration is deleted. Its shipments stay on the cover for a new declaration of the period."),
      facts: [
        { label: t("distribution.oc.declaration", "Declaration"), value: declaration.declarationNumber },
        { label: t("distribution.oc.period", "Period"), value: declaration.period },
        { label: t("distribution.oc.shipments", "Shipments"), value: declaration.shipments, type: "number" },
        { label: t("distribution.oc.gross", "Premium with taxes"), value: declaration.grossPremium, type: "amount" },
      ],
      confirmLabel: t("distribution.oc.deleteDeclarationTitle", "Delete declaration"),
    }, () => service.deleteDeclaration(declaration.id));
    if (r) setDeclaration(null);
  };
  const conveyanceText = (c) => t(`distribution.oc.conveyance.${c}`, c);

  if (!cover) return <div className="pe-page"><Toast ref={toast} /></div>;
  const active = cover.status === "active";
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.oc.title", "Marine Open Covers")} title={`${cover.coverNumber} · ${cover.clientName}`}
        subtitle={`${cover.insurerName} · ${date(cover.periodFrom)} to ${date(cover.periodTo)}${cover.policyNumber ? ` · ${t("distribution.fl.policy", "Policy")} ${cover.policyNumber}` : ""}`}>
        <Button label={t("distribution.common.back", "Back")} icon="pi pi-arrow-left" text onClick={() => navigate(BASE)} />
        {write && cover.status === "draft" ? <Button label={t("distribution.oc.activate", "Activate")} icon="pi pi-check" disabled={busy}
          onClick={activate} /> : null}
        {write && ["draft", "active"].includes(cover.status) ? <Button label={t("distribution.oc.cancel", "Cancel cover")} icon="pi pi-times" severity="danger" outlined
          onClick={cancelCover} /> : null}
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.common.status", "Status")}</div><div className="pe-kpi-value"><StatusTag status={cover.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.oc.certificates", "Certificates")}</div><div className="pe-kpi-value">{cover.certificates}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.oc.declaredValue", "Insured value shipped")}</div><div className="pe-kpi-value">{money(cover.declaredInsured)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.oc.billed", "Billed premium")}</div><div className="pe-kpi-value">{money(cover.billedPremium)}</div></div>
      </div>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("distribution.oc.contract", "Contract")}>
            <KeyValueGrid columns={3} className="mb-3" items={[
              { label: t("distribution.oc.goods", "Goods insured"), value: cover.goodsDescription, span: 2 },
              { label: t("distribution.oc.insurerReference", "Insurer's reference"), value: cover.insurerReference },
              { label: t("distribution.oc.voyages", "Voyages"), value: cover.voyageScope, span: 2 },
              { label: t("distribution.oc.frequency", "Declarations"), value: t(`distribution.oc.freq.${cover.declarationFrequency}`, cover.declarationFrequency) },
              { label: t("distribution.oc.markup", "Mark-up on invoice %"), value: cover.markupPercent, type: "percent" },
              { label: t("distribution.oc.minimum", "Minimum premium per certificate"), value: cover.minimumPremium, type: "amount" },
              { label: t("distribution.oc.clauses", "Clauses"), value: cover.clauses, span: "full" },
            ]} />
            <DataTable value={cover.rates} size="small" stripedRows>
              <Column header={t("distribution.oc.conveyanceLabel", "Conveyance")} body={(r) => t(`distribution.oc.conveyance.${r.conveyance}`, r.conveyance)} />
              <Column header={t("distribution.oc.rate", "Rate %")} body={(r) => `${num(r.ratePercent, 4)}%`} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.oc.limit", "Limit any one conveyance")} body={(r) => money(r.limit)} className="bv-num" headerClassName="bv-num" />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.oc.certificates", "Certificates")}>
            {write && active ? (
              <div className="dist-toolbar">
                <Button label={t("distribution.oc.issue", "Issue certificate")} icon="pi pi-plus" size="small" onClick={() => setShipment({ ...EMPTY_SHIPMENT, kind: "certificate" })} />
                <Button label={t("distribution.oc.declared", "Shipment without certificate")} icon="pi pi-plus" outlined size="small" onClick={() => setShipment({ ...EMPTY_SHIPMENT, kind: "declared" })} />
              </div>
            ) : null}
            <DataTable value={cover.certificateList} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="certificateNumber" header={t("distribution.oc.certificate", "Certificate")} />
              <Column header={t("distribution.oc.kind", "Kind")} body={(x) => t(`distribution.oc.kinds.${x.kind}`, x.kind)} />
              <Column header={t("distribution.oc.shipped", "Shipped")} body={(x) => date(x.shipmentDate)} />
              <Column header={t("distribution.oc.conveyanceLabel", "Conveyance")} body={(x) => conveyanceText(x.conveyance)} />
              <Column header={t("distribution.oc.voyage", "Voyage")} body={(x) => `${x.voyageFrom} – ${x.voyageTo}`} />
              <Column field="vesselName" header={t("distribution.oc.vessel", "Vessel / flight")} />
              <Column header={t("distribution.oc.insured", "Insured value")} body={(x) => money(x.insuredValue)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.fl.premium", "Premium")} body={(x) => money(x.premium)} className="bv-num" headerClassName="bv-num" />
              <Column field="declarationNumber" header={t("distribution.oc.declaration", "Declaration")} />
              <Column header={t("distribution.common.status", "Status")} body={(x) => <StatusTag status={x.status} />} />
              <Column body={(x) => (
                <div className="dist-actions">
                  <Button icon="pi pi-print" text size="small" aria-label={t("distribution.oc.print", "Print")} tooltip={t("distribution.oc.print", "Print")} onClick={() => printFile(toast, `/marine/certificates/${encodeURIComponent(x.id)}/print`, `${x.certificateNumber}.pdf`)} />
                  {write && x.status === "issued" ? <Button icon="pi pi-times" text size="small" severity="danger" aria-label={t("distribution.oc.cancelCert", "Cancel certificate")}
                    tooltip={t("distribution.oc.cancelCert", "Cancel certificate")} onClick={() => cancelCertificate(x)} /> : null}
                </div>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.oc.declarations", "Declarations")}>
            {write && ["active", "expired"].includes(cover.status) ? (
              <div className="dist-toolbar"><Button label={t("distribution.oc.newDeclaration", "New declaration")} icon="pi pi-plus" size="small" onClick={newDeclaration} /></div>
            ) : null}
            <DataTable value={cover.declarations} dataKey="id" size="small" stripedRows selectionMode="single" onRowClick={(e) => openDeclaration(e.data)} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="declarationNumber" header={t("distribution.oc.declaration", "Declaration")} />
              <Column field="period" header={t("distribution.oc.period", "Period")} />
              <Column header={t("distribution.oc.due", "Due")} body={(d) => date(d.dueOn)} />
              <Column field="shipments" header={t("distribution.oc.shipments", "Shipments")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.fl.premium", "Premium")} body={(d) => money(d.premium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.oc.gross", "Premium with taxes")} body={(d) => money(d.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column field="billNumber" header={t("distribution.oc.bill", "Bill")} />
              <Column header={t("distribution.oc.balance", "Unpaid")} body={(d) => (d.billBalance === null ? "" : money(d.billBalance))} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.common.status", "Status")} body={(d) => <StatusTag status={d.status} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.common.history", "History")}>
            <RecordActivityLog entity="open_cover" recordId={cover.id} />
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={shipment?.kind === "declared" ? t("distribution.oc.declared", "Shipment without certificate") : t("distribution.oc.issue", "Issue certificate")}
        visible={!!shipment} style={{ width: "min(780px, 96vw)" }} onHide={() => setShipment(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setShipment(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" loading={busy} onClick={saveShipment}
          disabled={!shipment?.invoiceValue || !shipment?.voyageFrom || !shipment?.voyageTo} /></div>}>
        {shipment && (
          <div className="dist-grid">
            <Field label={t("distribution.oc.shipped", "Shipped")}><Calendar value={shipment.shipmentDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setShipment({ ...shipment, shipmentDate: e.value })} /></Field>
            <Field label={t("distribution.oc.conveyanceLabel", "Conveyance")}>
              <Dropdown value={shipment.conveyance} options={cover.rates.map((r) => ({ value: r.conveyance, label: `${r.conveyance} (${r.ratePercent}%, ${t("distribution.oc.upTo", "up to")} ${money(r.limit)})` }))}
                onChange={(e) => setShipment({ ...shipment, conveyance: e.value })} />
            </Field>
            {[["voyageFrom", "From"], ["voyageTo", "To"], ["vesselName", "Vessel / flight"], ["billOfLading", "Bill of lading / airway bill"], ["consignee", "Consignee"], ["packing", "Packing"]].map(([k, label]) => (
              <Field key={k} label={t(`distribution.oc.f.${k}`, label)}><InputText value={shipment[k]} onChange={(e) => setShipment({ ...shipment, [k]: e.target.value })} /></Field>
            ))}
            <Field label={t("distribution.oc.goods", "Goods insured")} full><InputText value={shipment.goodsDescription} placeholder={cover.goodsDescription} onChange={(e) => setShipment({ ...shipment, goodsDescription: e.target.value })} /></Field>
            <Field label={t("distribution.oc.invoice", "Invoice value")}><InputNumber value={shipment.invoiceValue} min={0} onValueChange={(e) => setShipment({ ...shipment, invoiceValue: e.value })} /></Field>
            <Field label={t("distribution.oc.markup", "Mark-up on invoice %")} help={t("distribution.oc.markupHelp", "Empty: the mark-up of the open cover")}>
              <InputNumber value={shipment.markupPercent} min={0} max={100} onValueChange={(e) => setShipment({ ...shipment, markupPercent: e.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <DetailDialog visible={!!declaration} onHide={() => setDeclaration(null)} size="lg"
        header={declaration ? `${t("distribution.oc.declaration", "Declaration")} ${declaration.declarationNumber}` : ""}
        footer={declaration ? (
          <>
            <Button label={t("distribution.common.close", "Close")} text onClick={() => setDeclaration(null)} />
            {write && declaration.status === "draft" ? (
              <>
                <Button label={t("distribution.oc.deleteDeclarationTitle", "Delete declaration")} icon="pi pi-trash" text severity="danger" disabled={busy} onClick={deleteDeclaration} />
                <Button label={t("distribution.oc.refresh", "Recompute")} icon="pi pi-refresh" outlined disabled={busy} onClick={() => declAction(() => service.refreshDeclaration(declaration.id))} />
                <Button label={t("distribution.oc.submit", "Submit")} icon="pi pi-send" disabled={busy} onClick={() => declAction(() => service.submitDeclaration(declaration.id))} />
              </>
            ) : null}
            {write && declaration.status === "submitted" ? <Button label={t("distribution.oc.billIt", "Bill")} icon="pi pi-dollar" disabled={busy} onClick={() => declAction(() => service.billDeclaration(declaration.id))} /> : null}
          </>
        ) : null}>
        {declaration && (
          <>
            <DetailHeader title={declaration.declarationNumber} status={{ code: declaration.status, label: t(`distribution.status.${declaration.status}`, declaration.status) }}
              subtitle={`${cover.coverNumber} · ${cover.clientName}`}
              meta={[
                { label: t("distribution.oc.period", "Period"), value: declaration.period },
                { label: t("distribution.oc.due", "Due"), value: declaration.dueOn, type: "date", hidden: !declaration.dueOn },
                { label: t("distribution.oc.bill", "Bill"), value: declaration.billNumber, hidden: !declaration.billNumber },
              ]}
              actions={<Button label={t("distribution.oc.print", "Print")} icon="pi pi-print" outlined
                onClick={() => printFile(toast, `/marine/declarations/${encodeURIComponent(declaration.id)}/print`, `${declaration.declarationNumber}.pdf`)} />} />
            <DetailSection title={t("distribution.oc.premium", "Premium")}>
              <KeyValueGrid columns={4} items={[
                { label: t("distribution.oc.shipments", "Shipments"), value: declaration.shipments, type: "number" },
                { label: t("distribution.oc.insured", "Insured value"), value: declaration.totalInsured, type: "amount" },
                { label: t("distribution.fl.premium", "Premium"), value: declaration.premium, type: "amount" },
                { label: t("distribution.oc.vat", "VAT"), value: declaration.vat, type: "amount" },
                { label: t("distribution.oc.dst", "Documentary stamp tax"), value: declaration.dst, type: "amount" },
                { label: t("distribution.oc.lgt", "Local government tax"), value: declaration.lgt, type: "amount" },
                { label: t("distribution.oc.gross", "Premium with taxes"), value: declaration.grossPremium, type: "amount" },
              ]} />
            </DetailSection>
            <DetailSection title={t("distribution.oc.shipments", "Shipments")} flush>
              <DataTable value={declaration.items} size="small" stripedRows emptyMessage={t("distribution.oc.nil", "No shipment in the period: a nil declaration")}>
                <Column field="certificateNumber" header={t("distribution.oc.certificate", "Certificate")} />
                <Column header={t("distribution.oc.shipped", "Shipped")} body={(x) => date(x.shipmentDate)} />
                <Column header={t("distribution.oc.conveyanceLabel", "Conveyance")} body={(x) => conveyanceText(x.conveyance)} />
                <Column header={t("distribution.oc.voyage", "Voyage")} body={(x) => `${x.voyageFrom} – ${x.voyageTo}`} />
                <Column header={t("distribution.oc.insured", "Insured value")} body={(x) => money(x.insuredValue)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.fl.premium", "Premium")} body={(x) => money(x.premium)} className="bv-num" headerClassName="bv-num" />
              </DataTable>
            </DetailSection>
            <DetailSection title={t("distribution.common.history", "History")}>
              <RecordActivityLog entity="marine_declaration" recordId={declaration.id} />
            </DetailSection>
          </>
        )}
      </DetailDialog>
    </div>
  );
};

export default OpenCovers;
