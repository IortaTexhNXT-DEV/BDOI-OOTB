import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import RowActions from "../../components/RowActions";
import { RecordActivityLog } from "../../components/ActivityLog";
import { ClientPicker, Field, PageHeader, StatusTag, date, fieldErrors, isoDay, money, num, printFile, showError, showSuccess, useInsurers } from "./common";
import { AcceptanceDialog, EndorsementChanges, ParcelDialog, TermsFields, UploadDialog, premiumOf, termsBody, termsForm, useCoverChoices } from "./OpenCoverForms";

const BASE = "/operations/open-covers";
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

const EMPTY_SHIPMENT = { kind: "certificate", shipmentDate: new Date(), conveyance: "Land", vesselName: "", voyageFrom: "", voyageTo: "", billOfLading: "", goodsDescription: "", packing: "", consignee: "", invoiceValue: null, markupPercent: null };

/** Operations > Marine Open Covers (PJRN-09): the list of open covers, and one cover with its certificates and declarations. */
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
  const choices = useCoverChoices();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [type, setType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.openCovers({ status: status || undefined, type: type || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [status, type]);
  useEffect(() => { load(); }, [load]);

  const newForm = (coverType = "parcel") => {
    const from = new Date();
    const to = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate() - 1);
    setErrors({});
    setForm({ coverType, client: null, insuranceCompanyId: null, periodFrom: from, ...termsForm(null, choices, coverType), periodTo: to });
  };
  const setFormState = (fn) => setForm((f) => (typeof fn === "function" ? fn(f) : fn));
  const create = async () => {
    setErrors({});
    try {
      const r = await service.createOpenCover({ coverType: form.coverType, clientId: form.client.id, insuranceCompanyId: form.insuranceCompanyId, periodFrom: isoDay(form.periodFrom), ...termsBody(form, form.coverType) });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      setErrors(fieldErrors(e));
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Policy servicing")} title={t("distribution.oc.title", "Marine Open Covers")}
        subtitle={t("distribution.oc.subtitle", "Open policies: Parcel / Courier covers with a certificate per customer, and Marine Cargo covers with a rate and limit per conveyance; daily and monthly declarations billed on the open policy.")}>
        {write ? <Button label={t("distribution.oc.new", "New open cover")} icon="pi pi-plus" onClick={() => newForm("parcel")} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={type} options={(choices.types || []).map((v) => ({ value: v.value, label: t(`distribution.oc.types.${v.value}`, v.label) }))} showClear placeholder={t("distribution.oc.type", "Type")}
            aria-label={t("distribution.oc.type", "Type")} onChange={(e) => setType(e.value || null)} />
          <Dropdown value={status} options={["draft", "active", "expired", "cancelled"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")}
            aria-label={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} selectionMode="single" onRowClick={(e) => navigate(`${BASE}/${e.data.id}`)}
          emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="coverNumber" header={t("distribution.oc.number", "Open cover")} />
          <Column header={t("distribution.oc.type", "Type")} body={(r) => t(`distribution.oc.types.${r.coverType}`, r.coverType)} />
          <Column field="clientName" header={t("distribution.fl.client", "Client")} />
          <Column field="insurerName" header={t("distribution.fl.insurer", "Insurer")} />
          <Column field="policyNumber" header={t("distribution.fl.policy", "Policy")} />
          <Column header={t("distribution.fl.period", "Period")} body={(r) => `${date(r.periodFrom)} to ${date(r.periodTo)}`} />
          <Column header={t("distribution.oc.conveyancesCovers", "Conveyances / covers")} body={(r) => (r.coverType === "parcel"
            ? r.covers.map((x) => `${x.name} ${money(x.sumInsured)}`).join(", ") : r.rates.map((x) => `${x.conveyance} ${x.ratePercent}%`).join(", "))} />
          <Column field="certificates" header={t("distribution.oc.certificates", "Certificates")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.oc.billed", "Billed premium")} body={(r) => money(r.billedPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("common.actions", "Actions")} body={(r) => <RowActions onView={() => navigate(`${BASE}/${r.id}`)} />} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={t("distribution.oc.newTitle", "New Open Cover")} visible={!!form} style={{ width: "min(1040px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={create}
          disabled={!form?.client?.id || !form?.insuranceCompanyId || !form?.goodsDescription} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.oc.type", "Open cover type")} htmlFor="oc-type" required error={errors.coverType}>
              <Dropdown inputId="oc-type" value={form.coverType} options={(choices.types || []).map((v) => ({ value: v.value, label: t(`distribution.oc.types.${v.value}`, v.label) }))}
                onChange={(e) => setForm({ ...form, ...termsForm(null, choices, e.value), coverType: e.value, periodTo: form.periodTo })} />
            </Field>
            <Field label={t("distribution.fl.client", "Client")} required error={errors.clientId}><ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder={t("distribution.fl.findClient", "Find the client")} /></Field>
            <Field label={t("distribution.fl.insurer", "Insurer")} htmlFor="oc-insurer" required error={errors.insuranceCompanyId}>
              <Dropdown inputId="oc-insurer" value={form.insuranceCompanyId} options={insurers} filter onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value })} />
            </Field>
            <Field label={t("distribution.fl.from", "Period from")} htmlFor="oc-from" error={errors.periodFrom}>
              <Calendar inputId="oc-from" value={form.periodFrom} dateFormat="yy-mm-dd" showIcon onChange={(e) => setForm({ ...form, periodFrom: e.value })} />
            </Field>
            <TermsFields type={form.coverType} form={form} setForm={setFormState} choices={choices} errors={errors} />
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
  const [params, setParams] = useSearchParams();
  const write = hasPermission("write:marine");
  const parcelWrite = hasPermission("write:parcel-certificates");
  const approver = hasPermission("approve:marine");
  const choices = useCoverChoices();
  const [cover, setCover] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [declaration, setDeclaration] = useState(null);
  const [addingParcel, setAddingParcel] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [endorseForm, setEndorseForm] = useState(null);
  const [endorseErrors, setEndorseErrors] = useState({});
  const [endorsement, setEndorsement] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [day, setDay] = useState(new Date());
  const [filter, setFilter] = useState({ search: "", from: null, to: null });
  const [certs, setCerts] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCover(await service.openCover(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // an approval opened from My Work
  useEffect(() => {
    const e = params.get("endorsement");
    if (e) service.endorsement(e).then(setEndorsement).catch((err) => showError(toast, err));
  }, [params]);
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
    facts: [...coverFacts(), cover.coverType === "parcel"
      ? { label: t("distribution.oc.premiumPerCertificate", "Premium per certificate"), value: cover.premiumPerCertificate, type: "amount" }
      : { label: t("distribution.oc.minimum", "Minimum premium per certificate"), value: cover.minimumPremium, type: "amount" }],
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
  const certFacts = (x) => [
    { label: t("distribution.oc.certificate", "Certificate"), value: x.certificateNumber },
    { label: x.kind === "parcel" ? t("distribution.oc.parcelDate", "Parcel date") : t("distribution.oc.shipped", "Shipped"), value: x.shipmentDate, type: "date" },
    x.kind === "parcel" ? { label: t("distribution.oc.customer", "Customer name"), value: x.customerName } : { label: t("distribution.oc.voyage", "Voyage"), value: `${x.voyageFrom} – ${x.voyageTo}` },
    { label: t("distribution.fl.premium", "Premium"), value: x.premium, type: "amount" },
  ];
  const reasonInput = (x) => (x.kind === "parcel"
    ? { type: "select", label: t("distribution.oc.reason", "Reason"), required: true, options: (choices.cancelReasons || []).map((r) => ({ value: r, label: r })) }
    : { type: "textarea", label: t("distribution.oc.reason", "Reason"), required: true });
  const cancelCertificate = (x) => confirmRun({
    title: t("distribution.oc.cancelCert", "Cancel certificate"), severity: "danger",
    message: t("distribution.oc.cancelCertMessage", "The certificate is cancelled and left out of the declaration of its period."),
    facts: certFacts(x), input: reasonInput(x), confirmLabel: t("distribution.oc.cancelCert", "Cancel certificate"), cancelLabel: t("distribution.common.back", "Back"),
  }, (reason) => service.cancelCertificate(x.id, reason));
  const reverseCertificate = (x) => confirmRun({
    title: t("distribution.oc.reverseCert", "Reverse certificate"), severity: "danger",
    message: t("distribution.oc.reverseMessage", "After approval the certificate is reversed on the next monthly declaration."),
    facts: certFacts(x), input: reasonInput(x), confirmLabel: t("distribution.oc.requestReversal", "Request reversal"), cancelLabel: t("distribution.common.back", "Back"),
  }, (reason) => service.requestReversal(x.id, reason));
  const decideReversal = (x, decision) => confirmRun({
    title: decision === "approve" ? t("distribution.oc.approveReversal", "Approve reversal") : t("distribution.oc.returnReversal", "Return reversal"),
    severity: decision === "approve" ? undefined : "danger", message: x.reversalReason, facts: certFacts(x),
    input: decision === "approve" ? undefined : { type: "textarea", label: t("distribution.oc.remark", "Remark"), required: true },
    confirmLabel: decision === "approve" ? t("distribution.oc.approve", "Approve") : t("distribution.oc.return", "Return"),
  }, (remark) => service.decideReversal(x.id, decision, typeof remark === "string" ? remark : undefined));
  const newDeclaration = () => {
    const periods = openPeriods(cover);
    return confirmRun({
      title: t("distribution.oc.newDeclaration", "New declaration"),
      message: t("distribution.oc.newDeclarationMessage", "The items of the period are attached to the declaration and priced."),
      facts: coverFacts(),
      input: { type: "select", label: t("distribution.oc.period", "Period"), required: true, defaultValue: periods[0] || null, options: periods.map((v) => ({ value: v, label: `${v.slice(5)}/${v.slice(0, 4)}` })) },
      confirmLabel: t("distribution.oc.openDeclaration", "Open declaration"),
    }, (period) => service.createDeclaration(cover.id, period));
  };
  const declAction = async (fn) => {
    const r = await run(fn);
    if (r && declaration) openDeclaration(declaration);
  };
  const deleteDeclaration = async () => {
    const r = await confirmRun({
      title: t("distribution.oc.deleteDeclarationTitle", "Delete declaration"), severity: "danger",
      message: t("distribution.oc.deleteDeclarationMessage", "The draft declaration is deleted. Its items stay on the cover for a new declaration of the period."),
      facts: [{ label: t("distribution.oc.declaration", "Declaration"), value: declaration.declarationNumber }, { label: t("distribution.oc.period", "Period"), value: declaration.period }],
      confirmLabel: t("distribution.oc.deleteDeclarationTitle", "Delete declaration"),
    }, () => service.deleteDeclaration(declaration.id));
    if (r) setDeclaration(null);
  };
  const searchCerts = async () => {
    try {
      setCerts(await service.coverCertificates(cover.id, { search: filter.search, from: isoDay(filter.from), to: isoDay(filter.to) }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const startEndorsement = () => {
    setEndorseErrors({});
    setEndorseForm({ effectiveFrom: new Date(), reason: "", ...termsForm(cover, choices, cover.coverType) });
  };
  const submitEndorsement = async () => {
    setEndorseErrors({});
    try {
      const r = await service.endorseCover(cover.id, { effectiveFrom: isoDay(endorseForm.effectiveFrom), reason: endorseForm.reason, changes: termsBody(endorseForm, cover.coverType) });
      showSuccess(toast, r.message);
      setEndorseForm(null);
      load();
    } catch (e) {
      setEndorseErrors(fieldErrors(e));
      showError(toast, e);
    }
  };
  const decideEndorsement = async (decision) => {
    const remark = decision === "return" ? await openConfirm({ title: t("distribution.oc.returnEndorsement", "Return endorsement"), severity: "danger",
      input: { type: "textarea", label: t("distribution.oc.remark", "Remark"), required: true }, confirmLabel: t("distribution.oc.return", "Return") }) : null;
    if (decision === "return" && !remark) return;
    const r = await run(() => service.decideEndorsement(endorsement.id, decision, remark || undefined));
    if (r) {
      setEndorsement(null);
      params.delete("endorsement");
      setParams(params);
    }
  };
  const conveyanceText = (c) => t(`distribution.oc.conveyance.${c}`, c);

  if (!cover) return <div className="pe-page"><Toast ref={toast} /></div>;
  const active = cover.status === "active";
  const parcel = cover.coverType === "parcel";
  const list = certs || cover.certificateList;
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Policy servicing")} section={t("distribution.oc.title", "Marine Open Covers")} title={`${cover.coverNumber} · ${cover.clientName}`}
        subtitle={`${t(`distribution.oc.types.${cover.coverType}`, cover.coverType)} · ${cover.insurerName} · ${date(cover.periodFrom)} to ${date(cover.periodTo)}${cover.policyNumber ? ` · ${t("distribution.fl.policy", "Policy")} ${cover.policyNumber}` : ""}`}>
        <Button label={t("distribution.common.back", "Back")} icon="pi pi-arrow-left" text onClick={() => navigate(BASE)} />
        {write && cover.status === "draft" ? <Button label={t("distribution.oc.activate", "Activate")} icon="pi pi-check" disabled={busy} onClick={activate} /> : null}
        {write && active ? <Button label={t("distribution.oc.endorse", "Endorse open policy")} icon="pi pi-pencil" outlined disabled={busy || Boolean(cover.pendingEndorsement)} onClick={startEndorsement} /> : null}
        {write && ["draft", "active"].includes(cover.status) ? <Button label={t("distribution.oc.cancel", "Cancel cover")} icon="pi pi-times" severity="danger" outlined onClick={cancelCover} /> : null}
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.common.status", "Status")}</div><div className="pe-kpi-value"><StatusTag status={cover.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.oc.certificates", "Certificates")}</div><div className="pe-kpi-value">{cover.certificates}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{parcel ? t("distribution.oc.premiumPerCertificate", "Premium per certificate") : t("distribution.oc.declaredValue", "Insured value shipped")}</div>
          <div className="pe-kpi-value">{money(parcel ? cover.premiumPerCertificate : cover.declaredInsured)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.oc.billed", "Billed premium")}</div><div className="pe-kpi-value">{money(cover.billedPremium)}</div></div>
      </div>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("distribution.oc.contract", "Contract")}>
            <KeyValueGrid columns={3} className="mb-3" items={[
              { label: t("distribution.oc.goods", "Goods insured"), value: cover.goodsDescription, span: 2 },
              { label: t("distribution.oc.insurerReference", "Insurer's reference"), value: cover.insurerReference },
              ...(parcel ? [] : [{ label: t("distribution.oc.voyages", "Voyages"), value: cover.voyageScope, span: 2 },
                { label: t("distribution.oc.frequency", "Declarations"), value: t(`distribution.oc.freq.${cover.declarationFrequency}`, cover.declarationFrequency) },
                { label: t("distribution.oc.markup", "Mark-up on invoice %"), value: cover.markupPercent, type: "percent" },
                { label: t("distribution.oc.minimum", "Minimum premium per certificate"), value: cover.minimumPremium, type: "amount" }]),
              { label: t("distribution.oc.remittanceBasis", "Remittance basis"), value: t(`distribution.oc.basis.${cover.remittanceBasis}`, cover.remittanceBasis) },
              { label: t("distribution.oc.dailyDeclaration", "Daily declaration"), value: cover.dailyDeclaration ? t("common.yes", "Yes") : t("common.no", "No") },
              { label: t("distribution.oc.fileFrequency", "Declaration file to the insurer"), value: cover.fileFrequency ? `${t(`distribution.oc.fileFreq.${cover.fileFrequency}`, cover.fileFrequency)} · ${cover.fileLayout || ""}` : t("distribution.oc.noFile", "No file") },
              { label: t("distribution.oc.declarationEmail", "Declaration file e-mail to"), value: cover.declarationEmail },
              { label: t("distribution.oc.clauses", "Clauses"), value: cover.clauses, span: "full" },
            ]} />
            {!parcel ? (
              <DataTable value={cover.rates} size="small" stripedRows>
                <Column header={t("distribution.oc.conveyanceLabel", "Conveyance")} body={(r) => conveyanceText(r.conveyance)} />
                <Column header={t("distribution.oc.rate", "Rate %")} body={(r) => `${num(r.ratePercent, 4)}%`} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.oc.limit", "Limit any one conveyance")} body={(r) => money(r.limit)} className="bv-num" headerClassName="bv-num" />
              </DataTable>
            ) : null}
          </TabPanel>
          {parcel ? (
            <TabPanel header={t("distribution.oc.coversTab", "Covers")}>
              <DataTable value={cover.covers} size="small" stripedRows dataKey="name">
                <Column field="name" header={t("distribution.oc.coverName", "Cover")} />
                <Column header={t("distribution.oc.line", "Line")} body={(c) => t(`distribution.oc.lines.${c.line}`, c.line)} />
                <Column field="insurerPolicyNo" header={t("distribution.oc.policyNo", "Insurer policy no.")} />
                <Column header={t("distribution.oc.sumInsured", "Sum insured")} body={(c) => money(c.sumInsured)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.oc.coverPremium", "Premium incl. taxes")} body={(c) => money(c.premium)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.oc.commissionPct", "Commission %")} body={(c) => `${num(c.commissionPercent)}%`} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.oc.coverDays", "Cover days")} body={(c) => c.coverDays || t("distribution.oc.transit", "Transit")} />
              </DataTable>
              <KeyValueGrid columns={4} className="mt-3" items={[
                { label: t("distribution.oc.premiumPerCertificate", "Premium per certificate"), value: premiumOf(cover.covers), type: "amount" },
                { label: t("distribution.oc.charge", "Charge per certificate billed to the client"), value: cover.chargePerCertificate, type: "amount" },
                { label: t("distribution.oc.serviceFee", "Service fee per certificate"), value: cover.serviceFeePerCertificate, type: "amount" },
                { label: t("distribution.oc.deliveryTypes", "Delivery types (reference)"), value: (cover.deliveryTypes || []).map((d) => `${d.label} ${money(d.charge)}`).join(" · ") },
              ]} />
            </TabPanel>
          ) : null}
          <TabPanel header={t("distribution.oc.certificates", "Certificates")}>
            <div className="dist-toolbar">
              {parcel && parcelWrite && active ? (
                <>
                  <Button label={t("distribution.oc.uploadParcels", "Upload parcels")} icon="pi pi-upload" size="small" onClick={() => setUploading("parcels")} />
                  <Button label={t("distribution.oc.addParcel", "Add parcel")} icon="pi pi-plus" size="small" outlined onClick={() => setAddingParcel(true)} />
                  <Calendar value={day} dateFormat="yy-mm-dd" showIcon maxDate={new Date()} aria-label={t("distribution.oc.parcelDate", "Parcel date")} onChange={(e) => setDay(e.value)} />
                  <Button label={t("distribution.oc.printDay", "Print certificates of the day")} icon="pi pi-print" size="small" text onClick={() => service.printDay(cover.id, isoDay(day)).catch((e) => showError(toast, e))} />
                </>
              ) : null}
              {!parcel && write && active ? (
                <>
                  <Button label={t("distribution.oc.issue", "Issue certificate")} icon="pi pi-plus" size="small" onClick={() => setShipment({ ...EMPTY_SHIPMENT, conveyance: cover.rates[0]?.conveyance || "Land", kind: "certificate" })} />
                  <Button label={t("distribution.oc.declared", "Shipment without certificate")} icon="pi pi-plus" outlined size="small" onClick={() => setShipment({ ...EMPTY_SHIPMENT, conveyance: cover.rates[0]?.conveyance || "Land", kind: "declared" })} />
                  <Button label={t("distribution.oc.uploadShipments", "Upload shipments")} icon="pi pi-upload" text size="small" onClick={() => setUploading("shipments")} />
                </>
              ) : null}
            </div>
            <div className="dist-toolbar">
              <InputText value={filter.search} placeholder={t("distribution.oc.searchCerts", "Name, loan account, waybill or certificate")} aria-label={t("distribution.oc.searchCerts", "Name, loan account, waybill or certificate")}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
              <Calendar value={filter.from} dateFormat="yy-mm-dd" showIcon placeholder={t("distribution.fl.from", "Period from")} aria-label={t("distribution.fl.from", "Period from")} onChange={(e) => setFilter({ ...filter, from: e.value })} />
              <Calendar value={filter.to} dateFormat="yy-mm-dd" showIcon placeholder={t("distribution.fl.to", "Period to")} aria-label={t("distribution.fl.to", "Period to")} onChange={(e) => setFilter({ ...filter, to: e.value })} />
              <Button label={t("distribution.oc.find", "Find")} icon="pi pi-search" size="small" text onClick={searchCerts} />
              {parcel ? <Button label={t("distribution.oc.export", "Export")} icon="pi pi-file-excel" size="small" text disabled={!list.length}
                onClick={() => service.certificateRegister(cover.id, { from: isoDay(filter.from), to: isoDay(filter.to) }).catch((e) => showError(toast, e))} /> : null}
            </div>
            <DataTable value={list} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="certificateNumber" header={t("distribution.oc.certificate", "Certificate")} />
              <Column header={parcel ? t("distribution.oc.parcelDate", "Parcel date") : t("distribution.oc.shipped", "Shipped")} body={(x) => date(x.shipmentDate)} />
              {parcel ? <Column header={t("distribution.oc.customerLoan", "Customer / loan account")} body={(x) => <span>{x.customerName}<br /><small className="pe-muted">{x.loanAccount}</small></span>} /> : null}
              {parcel ? <Column header={t("distribution.oc.waybillDelivery", "Waybill / delivery")} body={(x) => <span>{x.waybillNo}<br /><small className="pe-muted">{x.deliveryType}</small></span>} /> : null}
              {!parcel ? <Column header={t("distribution.oc.kind", "Kind")} body={(x) => t(`distribution.oc.kinds.${x.kind}`, x.kind)} /> : null}
              {!parcel ? <Column header={t("distribution.oc.voyage", "Voyage")} body={(x) => `${x.voyageFrom} – ${x.voyageTo}`} /> : null}
              {!parcel ? <Column header={t("distribution.oc.insured", "Insured value")} body={(x) => money(x.insuredValue)} className="bv-num" headerClassName="bv-num" /> : null}
              <Column header={t("distribution.fl.premium", "Premium")} body={(x) => money(x.premium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.oc.dailyDecl", "Daily declaration")} body={(x) => (x.dailyDeclarationNumber ? `${x.dailyDeclarationNumber}${x.late ? ` ${t("distribution.oc.late", "(late)")}` : ""}` : x.declarationNumber || "")} />
              <Column header={t("distribution.common.status", "Status")} body={(x) => (
                <span className="flex gap-1 flex-wrap">
                  <StatusTag status={x.status} />
                  {x.possibleDuplicate ? <StatusTag status="possible-duplicate" /> : null}
                  {x.reversalStatus === "pending" ? <StatusTag status="reversal-pending" /> : null}
                </span>
              )} />
              <Column header={t("common.actions", "Actions")} body={(x) => (
                <RowActions>
                  <Button icon="pi pi-print" text rounded aria-label={t("distribution.oc.print", "Print")} tooltip={t("distribution.oc.print", "Print")} onClick={() => printFile(toast, `/marine/certificates/${encodeURIComponent(x.id)}/print`, `${x.certificateNumber}.pdf`)} />
                  {x.status === "issued" && ((x.kind === "parcel" && parcelWrite) || (x.kind !== "parcel" && write)) ? <Button icon="pi pi-times" text rounded severity="danger" aria-label={t("distribution.oc.cancelCert", "Cancel certificate")}
                    tooltip={t("distribution.oc.cancelCert", "Cancel certificate")} onClick={() => cancelCertificate(x)} /> : null}
                  {x.status === "declared" && x.kind === "parcel" && parcelWrite && x.reversalStatus !== "pending" ? <Button icon="pi pi-replay" text rounded severity="danger" aria-label={t("distribution.oc.reverseCert", "Reverse certificate")}
                    tooltip={t("distribution.oc.reverseCert", "Reverse certificate")} onClick={() => reverseCertificate(x)} /> : null}
                  {x.reversalStatus === "pending" && approver ? (
                    <>
                      <Button icon="pi pi-check" text rounded aria-label={t("distribution.oc.approveReversal", "Approve reversal")} tooltip={t("distribution.oc.approveReversal", "Approve reversal")} onClick={() => decideReversal(x, "approve")} />
                      <Button icon="pi pi-undo" text rounded severity="danger" aria-label={t("distribution.oc.returnReversal", "Return reversal")} tooltip={t("distribution.oc.returnReversal", "Return reversal")} onClick={() => decideReversal(x, "return")} />
                    </>
                  ) : null}
                </RowActions>
              )} />
            </DataTable>
          </TabPanel>
          {cover.dailyDeclaration || cover.dailyDeclarations.length ? (
            <TabPanel header={t("distribution.oc.dailyTab", "Daily declarations")}>
              {write && active ? <div className="dist-toolbar"><Button label={t("distribution.oc.closeDays", "Close ended days")} icon="pi pi-lock" size="small" outlined disabled={busy} onClick={() => run(() => service.closeDays(cover.id))} /></div> : null}
              <DataTable value={cover.dailyDeclarations} dataKey="id" size="small" stripedRows paginator rows={31} emptyMessage={t("distribution.common.none", "Nothing to show")}>
                <Column field="declarationNumber" header={t("distribution.oc.dailyDecl", "Daily declaration")} />
                <Column header={t("distribution.oc.day", "Day")} body={(d) => date(d.date)} />
                <Column field="items" header={t("distribution.oc.certificates", "Certificates")} className="bv-num" headerClassName="bv-num" />
                <Column field="lateItems" header={t("distribution.oc.lateItems", "Late items")} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.fl.premium", "Premium")} body={(d) => money(d.premium)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.oc.closed", "Closed")} body={(d) => (d.closedAt ? date(d.closedAt) : "-")} />
                <Column field="monthlyDeclarationNumber" header={t("distribution.oc.monthlyDecl", "Monthly declaration")} />
                <Column header={t("distribution.common.status", "Status")} body={(d) => <StatusTag status={d.status} />} />
              </DataTable>
            </TabPanel>
          ) : null}
          <TabPanel header={t("distribution.oc.monthlyTab", "Monthly declarations")}>
            {write && ["active", "expired"].includes(cover.status) ? (
              <div className="dist-toolbar"><Button label={t("distribution.oc.newDeclaration", "New declaration")} icon="pi pi-plus" size="small" onClick={newDeclaration} /></div>
            ) : null}
            <DataTable value={cover.declarations} dataKey="id" size="small" stripedRows selectionMode="single" onRowClick={(e) => openDeclaration(e.data)} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="declarationNumber" header={t("distribution.oc.declaration", "Declaration")} />
              <Column field="period" header={t("distribution.oc.period", "Period")} />
              <Column header={t("distribution.oc.due", "Due")} body={(d) => date(d.dueOn)} />
              <Column header={t("distribution.oc.certificates", "Certificates")} body={(d) => d.shipments - d.reversals} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.fl.premium", "Premium")} body={(d) => money(d.premium)} className="bv-num" headerClassName="bv-num" />
              <Column header={parcel ? t("distribution.oc.chargeBilled", "Charge billed") : t("distribution.oc.gross", "Premium with taxes")} body={(d) => money(parcel ? d.chargeTotal : d.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column field="billNumber" header={t("distribution.oc.bill", "Bill")} />
              <Column header={t("distribution.oc.fileStatus", "File")} body={(d) => <StatusTag status={d.fileStatus} />} />
              <Column header={t("distribution.common.status", "Status")} body={(d) => <StatusTag status={d.status} />} />
              <Column header={t("common.actions", "Actions")} body={(d) => <RowActions onView={() => openDeclaration(d)} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.oc.endorsementsTab", "Endorsements")}>
            <DataTable value={cover.endorsements} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column header={t("distribution.oc.endorsement", "Endorsement")} body={(e) => e.endorsementNumber || "-"} />
              <Column header={t("distribution.oc.effectiveFrom", "Effective from")} body={(e) => date(e.effectiveFrom)} />
              <Column field="reason" header={t("distribution.oc.reason", "Reason")} />
              <Column header={t("distribution.oc.changedField", "Changed")} body={(e) => e.changedFields.map((k) => t(`distribution.oc.term.${k}`, k)).join(", ")} />
              <Column field="requestedByName" header={t("distribution.oc.maker", "Requested by")} />
              <Column field="decidedByName" header={t("distribution.oc.approver", "Approved by")} />
              <Column header={t("distribution.common.status", "Status")} body={(e) => <StatusTag status={e.status} />} />
              <Column header={t("common.actions", "Actions")} body={(e) => (
                <RowActions onView={() => setEndorsement(e)}>
                  {e.status === "pending" && write ? <Button icon="pi pi-undo" text rounded aria-label={t("distribution.oc.recall", "Recall")} tooltip={t("distribution.oc.recall", "Recall")}
                    onClick={() => run(() => service.recallEndorsement(e.id))} /> : null}
                </RowActions>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.common.history", "History")}>
            <RecordActivityLog entity="open_cover" recordId={cover.id} />
          </TabPanel>
        </TabView>
      </div>

      {addingParcel ? <ParcelDialog cover={cover} choices={choices} onHide={() => setAddingParcel(false)}
        onSaved={(r) => { showSuccess(toast, [r.message, ...(r.warnings || [])].join(" · ")); setAddingParcel(false); load(); }} /> : null}
      {uploading ? <UploadDialog cover={cover} kind={uploading} onHide={() => setUploading(null)} onDone={load} /> : null}

      <Dialog className="pe-dialog" header={shipment?.kind === "declared" ? t("distribution.oc.declared", "Shipment without certificate") : t("distribution.oc.issue", "Issue certificate")}
        visible={!!shipment} style={{ width: "min(780px, 96vw)" }} onHide={() => setShipment(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setShipment(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" loading={busy} onClick={saveShipment}
          disabled={!shipment?.invoiceValue || !shipment?.voyageFrom || !shipment?.voyageTo} /></div>}>
        {shipment && (
          <div className="dist-grid">
            <Field label={t("distribution.oc.shipped", "Shipped")} htmlFor="sh-date"><Calendar inputId="sh-date" value={shipment.shipmentDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setShipment({ ...shipment, shipmentDate: e.value })} /></Field>
            <Field label={t("distribution.oc.conveyanceLabel", "Conveyance")} htmlFor="sh-conv">
              <Dropdown inputId="sh-conv" value={shipment.conveyance} options={cover.rates.map((r) => ({ value: r.conveyance, label: `${r.conveyance} (${r.ratePercent}%, ${t("distribution.oc.upTo", "up to")} ${money(r.limit)})` }))}
                onChange={(e) => setShipment({ ...shipment, conveyance: e.value })} />
            </Field>
            {[["voyageFrom", "From"], ["voyageTo", "To"], ["vesselName", "Vessel / flight"], ["billOfLading", "Bill of lading / airway bill"], ["consignee", "Consignee"], ["packing", "Packing"]].map(([k, label]) => (
              <Field key={k} label={t(`distribution.oc.f.${k}`, label)} htmlFor={`sh-${k}`}><InputText id={`sh-${k}`} value={shipment[k]} onChange={(e) => setShipment({ ...shipment, [k]: e.target.value })} /></Field>
            ))}
            <Field label={t("distribution.oc.goods", "Goods insured")} htmlFor="sh-goods" full><InputText id="sh-goods" value={shipment.goodsDescription} placeholder={cover.goodsDescription} onChange={(e) => setShipment({ ...shipment, goodsDescription: e.target.value })} /></Field>
            <Field label={t("distribution.oc.invoice", "Invoice value")} htmlFor="sh-inv"><InputNumber inputId="sh-inv" value={shipment.invoiceValue} min={0} onValueChange={(e) => setShipment({ ...shipment, invoiceValue: e.value })} /></Field>
            <Field label={t("distribution.oc.markup", "Mark-up on invoice %")} htmlFor="sh-mk" help={t("distribution.oc.markupHelp", "Empty: the mark-up of the open cover")}>
              <InputNumber inputId="sh-mk" value={shipment.markupPercent} min={0} max={100} onValueChange={(e) => setShipment({ ...shipment, markupPercent: e.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("distribution.oc.endorseTitle", "Endorse Open Policy")} visible={!!endorseForm} style={{ width: "min(1040px, 96vw)" }} onHide={() => setEndorseForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setEndorseForm(null)} /><Button label={t("distribution.oc.submitApproval", "Submit for approval")} icon="pi pi-send" onClick={submitEndorsement} /></div>}>
        {endorseForm && (
          <div className="dist-grid">
            <Field label={t("distribution.oc.effectiveFrom", "Effective from")} htmlFor="en-eff" required error={endorseErrors.effectiveFrom}>
              <Calendar inputId="en-eff" value={endorseForm.effectiveFrom} dateFormat="yy-mm-dd" showIcon onChange={(e) => setEndorseForm({ ...endorseForm, effectiveFrom: e.value })} />
            </Field>
            <Field label={t("distribution.oc.reason", "Reason")} htmlFor="en-reason" required error={endorseErrors.reason}>
              <InputText id="en-reason" value={endorseForm.reason} onChange={(e) => setEndorseForm({ ...endorseForm, reason: e.target.value })} />
            </Field>
            <TermsFields type={cover.coverType} form={endorseForm} setForm={(fn) => setEndorseForm((f) => (typeof fn === "function" ? fn(f) : fn))} choices={choices} errors={endorseErrors} endorsing />
          </div>
        )}
      </Dialog>

      <DetailDialog visible={!!endorsement} onHide={() => setEndorsement(null)} size="lg"
        header={endorsement ? `${t("distribution.oc.endorsement", "Endorsement")} ${endorsement.endorsementNumber || ""}` : ""}
        footer={endorsement ? (
          <>
            <Button label={t("distribution.common.close", "Close")} text onClick={() => setEndorsement(null)} />
            {endorsement.status === "pending" && approver ? (
              <>
                <Button label={t("distribution.oc.return", "Return")} icon="pi pi-undo" text severity="danger" disabled={busy} onClick={() => decideEndorsement("return")} />
                <Button label={t("distribution.oc.approve", "Approve")} icon="pi pi-check" disabled={busy} onClick={() => decideEndorsement("approve")} />
              </>
            ) : null}
          </>
        ) : null}>
        {endorsement && (
          <>
            <DetailHeader title={endorsement.endorsementNumber || cover.coverNumber} status={{ code: endorsement.status, label: t(`distribution.status.${endorsement.status}`, endorsement.status) }}
              subtitle={endorsement.reason} meta={[
                { label: t("distribution.oc.effectiveFrom", "Effective from"), value: endorsement.effectiveFrom, type: "date" },
                { label: t("distribution.oc.maker", "Requested by"), value: endorsement.requestedByName },
                { label: t("distribution.oc.remark", "Remark"), value: endorsement.remark, hidden: !endorsement.remark },
              ]} />
            <DetailSection title={t("distribution.oc.changedField", "Changed")} flush><EndorsementChanges endorsement={endorsement} /></DetailSection>
          </>
        )}
      </DetailDialog>

      {accepting && declaration ? <AcceptanceDialog declaration={declaration} onHide={() => setAccepting(false)}
        onSaved={(r) => { showSuccess(toast, r.message); setAccepting(false); openDeclaration(declaration); load(); }} /> : null}

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
            {write && ["submitted", "billed", "nil"].includes(declaration.status) && cover.declarationEmail ? (
              <Button label={t("distribution.oc.sendInsurer", "Send to insurer")} icon="pi pi-envelope" outlined disabled={busy} onClick={() => declAction(() => service.sendDeclaration(declaration.id))} />
            ) : null}
            {write && ["submitted", "billed", "nil"].includes(declaration.status) ? (
              <Button label={t("distribution.oc.recordAcceptance", "Record insurer acceptance")} icon="pi pi-verified" outlined disabled={busy} onClick={() => setAccepting(true)} />
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
                { label: t("distribution.oc.fileStatus", "File"), value: t(`distribution.status.${declaration.fileStatus}`, declaration.fileStatus) },
              ]}
              actions={(
                <span className="flex gap-2 flex-wrap">
                  <Button label={parcel ? t("distribution.oc.summary", "Declaration summary") : t("distribution.oc.print", "Print")} icon="pi pi-print" outlined
                    onClick={() => printFile(toast, `/marine/declarations/${encodeURIComponent(declaration.id)}/print`, `${declaration.declarationNumber}.pdf`)} />
                  {declaration.files.length ? <Button label={t("distribution.oc.declarationFile", "Declaration file")} icon="pi pi-file-excel" outlined onClick={() => service.declarationFile(declaration.id).catch((e) => showError(toast, e))} /> : null}
                  {parcel ? <Button label={t("distribution.oc.register", "Certificate register")} icon="pi pi-list" outlined onClick={() => service.declarationRegister(declaration.id).catch((e) => showError(toast, e))} /> : null}
                </span>
              )} />
            <DetailSection title={t("distribution.oc.premium", "Premium")}>
              <KeyValueGrid columns={4} items={[
                { label: t("distribution.oc.certificates", "Certificates"), value: declaration.shipments - declaration.reversals, type: "number" },
                { label: t("distribution.oc.reversals", "Reversals"), value: declaration.reversals, type: "number", hidden: !declaration.reversals },
                { label: t("distribution.oc.insured", "Insured value"), value: declaration.totalInsured, type: "amount" },
                { label: parcel ? t("distribution.oc.premiumInclTaxes", "Premium (taxes inside)") : t("distribution.fl.premium", "Premium"), value: declaration.premium, type: "amount" },
                { label: t("distribution.oc.vat", "VAT"), value: declaration.vat, type: "amount" },
                { label: t("distribution.oc.dst", "Documentary stamp tax"), value: declaration.dst, type: "amount" },
                { label: t("distribution.oc.lgt", "Local government tax"), value: declaration.lgt, type: "amount" },
                ...(parcel ? [
                  { label: t("distribution.oc.chargeBilled", "Charge billed"), value: declaration.chargeTotal, type: "amount" },
                  { label: t("distribution.oc.serviceFee", "Service fee"), value: declaration.serviceFee, type: "amount" },
                  { label: t("distribution.oc.commission", "Commission due from the insurer"), value: declaration.commission, type: "amount" },
                ] : [{ label: t("distribution.oc.gross", "Premium with taxes"), value: declaration.grossPremium, type: "amount" }]),
              ]} />
            </DetailSection>
            {parcel ? (
              <DetailSection title={t("distribution.oc.coversTab", "Covers")} flush>
                <DataTable value={declaration.coverLines} size="small" stripedRows dataKey="cover">
                  <Column field="cover" header={t("distribution.oc.coverName", "Cover")} />
                  <Column field="certificates" header={t("distribution.oc.certificates", "Certificates")} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.coverPremium", "Premium incl. taxes")} body={(l) => money(l.premium)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.net", "Net premium")} body={(l) => money(l.net)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.vat", "VAT")} body={(l) => money(l.vat)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.dstShort", "DST")} body={(l) => money(l.dst)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.lgtShort", "LGT")} body={(l) => money(l.lgt)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.oc.commission", "Commission due from the insurer")} body={(l) => money(l.commission)} className="bv-num" headerClassName="bv-num" />
                </DataTable>
              </DetailSection>
            ) : null}
            {declaration.acceptance ? (
              <DetailSection title={t("distribution.oc.acceptance", "Insurer acceptance")}>
                <KeyValueGrid columns={3} items={[
                  { label: t("distribution.oc.acceptedOn", "Date"), value: declaration.acceptance.date, type: "date" },
                  { label: t("distribution.oc.insurerRef", "Insurer's reference"), value: declaration.acceptance.reference },
                  { label: t("distribution.oc.result", "Result"), value: t(`distribution.status.${declaration.acceptance.result}`, declaration.acceptance.result) },
                  { label: t("distribution.oc.rowsAccepted", "Rows accepted"), value: declaration.acceptance.rows, type: "number", hidden: declaration.acceptance.rows === null },
                  { label: t("distribution.oc.premiumAccepted", "Premium accepted"), value: declaration.acceptance.premium, type: "amount", hidden: declaration.acceptance.premium === null },
                  { label: t("distribution.oc.remark", "Remark"), value: declaration.acceptance.remark, span: "full", hidden: !declaration.acceptance.remark },
                ]} />
              </DetailSection>
            ) : null}
            <DetailSection title={t("distribution.oc.items", "Certificates and shipments")} flush>
              <DataTable value={[...declaration.items, ...declaration.reversalItems.map((x) => ({ ...x, reversalLine: true, id: `r-${x.id}` }))]} size="small" stripedRows dataKey="id" paginator rows={20}
                emptyMessage={t("distribution.oc.nil", "Nothing declared in the period: a nil declaration")}>
                <Column field="certificateNumber" header={t("distribution.oc.certificate", "Certificate")} />
                <Column header={parcel ? t("distribution.oc.parcelDate", "Parcel date") : t("distribution.oc.shipped", "Shipped")} body={(x) => date(x.shipmentDate)} />
                <Column header={parcel ? t("distribution.oc.customer", "Customer name") : t("distribution.oc.voyage", "Voyage")} body={(x) => (parcel ? x.customerName : `${x.voyageFrom} – ${x.voyageTo}`)} />
                <Column header={t("distribution.fl.premium", "Premium")} body={(x) => money(x.reversalLine ? -x.premium : x.premium)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.common.status", "Status")} body={(x) => <StatusTag status={x.reversalLine ? "reversal" : x.status} />} />
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
