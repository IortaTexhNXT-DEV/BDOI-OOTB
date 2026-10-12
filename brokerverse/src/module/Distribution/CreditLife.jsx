import React, { useCallback, useEffect, useRef, useState } from "react";
import FileField from "../../components/FileField";
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
import { ClientPicker, Field, PageHeader, StatusTag, date, fieldErrors, isoDay, money, printFile, showError, showSuccess, useInsurers } from "./common";

const BASE = "/operations/credit-life";
const thisMonth = () => new Date().toISOString().slice(0, 7);
const EMPTY_MEMBER = { customerNo: "", lastName: "", firstName: "", birthDate: null, loanAccount: "", loanAmount: null, loanTermMonths: 60, releaseDate: new Date(), accountCount: null, sumInsured: null,
  email: "", mobile: "", address: "", city: "", province: "", gender: null, bookingDate: null, maturityDate: null, outstandingBalance: null };

/** Operations > Credit Life (PJRN-01, PJRN-02): the monthly batches of the financing bank and the master policies of its customers. */
const CreditLife = () => {
  const { id } = useParams();
  return id ? <BatchDetail id={id} /> : <BatchList />;
};

const BatchList = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:credit-life");
  const insurers = useInsurers();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [masters, setMasters] = useState([]);
  const [search, setSearch] = useState("");
  const [master, setMaster] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [choices, setChoices] = useState({ products: [] });

  const load = useCallback(async () => {
    try {
      setRows(await service.creditLifeBatches({ status: status || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.creditLifeChoices().then(setChoices).catch(() => {}); }, []);
  const findMasters = async () => {
    try {
      setMasters(await service.creditLifeMasterPolicies({ search }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const openMaster = async (m) => {
    try {
      setMaster(await service.creditLifeMasterPolicy(m.id));
    } catch (e) {
      showError(toast, e);
    }
  };
  const create = async () => {
    setErrors({});
    try {
      const r = await service.createCreditLifeBatch({ financingClientId: form.client?.id, insuranceCompanyId: form.insuranceCompanyId, productId: form.productId, period: form.period, notes: form.notes || null });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      setErrors(fieldErrors(e));
      showError(toast, e);
    }
  };
  const defaultProduct = () => choices.products.find((p) => p.code === choices.defaultProduct)?.value ?? null;

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Policy servicing")} title={t("creditLife.title", "Credit Life")}
        subtitle={t("creditLife.subtitle", "Monthly Credit Life batches of the financing bank: members checked against the Credit Life rules, one master policy per customer, certificates of cover e-mailed as password-protected PDFs.")}>
        {write ? <Button label={t("creditLife.newBatch", "New batch")} icon="pi pi-plus" onClick={() => { setErrors({}); setForm({ client: null, insuranceCompanyId: null, productId: defaultProduct(), period: thisMonth(), notes: "" }); }} /> : null}
      </PageHeader>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("creditLife.batches", "Batches")}>
            <div className="dist-toolbar">
              <Dropdown value={status} options={["draft", "issued", "sent"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")}
                aria-label={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
            </div>
            <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} selectionMode="single" onRowClick={(e) => navigate(`${BASE}/${e.data.id}`)}
              emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="batchNumber" header={t("creditLife.batch", "Batch")} />
              <Column field="period" header={t("creditLife.period", "Month")} />
              <Column field="bankName" header={t("creditLife.bank", "Financing bank")} />
              <Column field="insurerName" header={t("distribution.fl.insurer", "Insurer")} />
              <Column field="members" header={t("creditLife.members", "Members")} className="bv-num" headerClassName="bv-num" />
              <Column field="errors" header={t("creditLife.failed", "Failed")} className="bv-num" headerClassName="bv-num" />
              <Column field="issued" header={t("creditLife.issued", "Issued")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditLife.premium", "Premium")} body={(r) => money(r.totalPremium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
              <Column header={t("common.actions", "Actions")} body={(r) => <RowActions onView={() => navigate(`${BASE}/${r.id}`)} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("creditLife.masterPolicies", "Master policies")}>
            <div className="dist-toolbar">
              <InputText value={search} placeholder={t("creditLife.searchMasters", "Master policy, name or customer number")} aria-label={t("creditLife.searchMasters", "Master policy, name or customer number")}
                onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") findMasters(); }} />
              <Button label={t("distribution.oc.find", "Find")} icon="pi pi-search" size="small" text onClick={findMasters} />
            </div>
            <DataTable value={masters} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="masterNumber" header={t("creditLife.masterPolicy", "Master policy")} />
              <Column field="borrowerName" header={t("creditLife.borrower", "Borrower")} />
              <Column field="customerNo" header={t("creditLife.customerNo", "Customer no.")} />
              <Column field="bankName" header={t("creditLife.bank", "Financing bank")} />
              <Column field="insurerName" header={t("distribution.fl.insurer", "Insurer")} />
              <Column field="certificates" header={t("creditLife.certificates", "Certificates")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditLife.sumInsured", "Sum insured")} body={(m) => money(m.sumInsured)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("common.actions", "Actions")} body={(m) => <RowActions onView={() => openMaster(m)} />} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>
      <Dialog className="pe-dialog" header={t("creditLife.newBatchTitle", "New Batch")} visible={!!form} style={{ width: "min(720px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={create}
          disabled={!form?.client?.id || !form?.insuranceCompanyId} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("creditLife.bank", "Financing bank")} required error={errors.financingClientId}>
              <ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder={t("distribution.fl.findClient", "Find the client")} />
            </Field>
            <Field label={t("distribution.fl.insurer", "Insurer")} htmlFor="cl-insurer" required error={errors.insuranceCompanyId}>
              <Dropdown inputId="cl-insurer" value={form.insuranceCompanyId} options={insurers} filter onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value })} />
            </Field>
            <Field label={t("creditLife.product", "Product")} htmlFor="cl-product">
              <Dropdown inputId="cl-product" value={form.productId} options={choices.products} onChange={(e) => setForm({ ...form, productId: e.value })} />
            </Field>
            <Field label={t("creditLife.period", "Month")} htmlFor="cl-period" required error={errors.period}>
              <InputText id="cl-period" value={form.period} placeholder="YYYY-MM" onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
      <DetailDialog visible={!!master} onHide={() => setMaster(null)} size="lg" header={master ? `${t("creditLife.masterPolicy", "Master policy")} ${master.masterNumber}` : ""}
        footer={master ? <Button label={t("distribution.common.close", "Close")} text onClick={() => setMaster(null)} /> : null}>
        {master && (
          <>
            <DetailHeader title={master.masterNumber} subtitle={`${master.borrowerName} · ${master.bankName}`}
              meta={[{ label: t("creditLife.customerNo", "Customer no."), value: master.customerNo }, { label: t("creditLife.birthDate", "Birth date"), value: master.birthDate, type: "date" },
                { label: t("distribution.fl.insurer", "Insurer"), value: master.insurerName }]}
              actions={<Button label={t("distribution.oc.print", "Print")} icon="pi pi-print" outlined onClick={() => printFile(toast, `/credit-life/master-policies/${encodeURIComponent(master.id)}/print`, `${master.masterNumber}.pdf`)} />} />
            <DetailSection title={t("creditLife.certificates", "Certificates")} flush>
              <DataTable value={master.certificates} size="small" stripedRows dataKey="id">
                <Column field="certificateNumber" header={t("creditLife.certificate", "Certificate")} />
                <Column field="loanAccount" header={t("creditLife.loanAccount", "Loan account")} />
                <Column header={t("creditLife.cover", "Period of cover")} body={(m) => `${date(m.coverFrom)} – ${date(m.coverTo)}`} />
                <Column header={t("creditLife.sumInsured", "Sum insured")} body={(m) => money(m.sumInsured)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.common.status", "Status")} body={(m) => <StatusTag status={m.status} />} />
              </DataTable>
            </DetailSection>
          </>
        )}
      </DetailDialog>
    </div>
  );
};

const BatchDetail = ({ id }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:credit-life");
  const [batch, setBatch] = useState(null);
  const [status, setStatus] = useState(null);
  const [member, setMember] = useState(null);
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBatch(await service.creditLifeBatch(id, { status: status || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [id, status]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      await load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const upload = async () => {
    const r = await run(() => service.uploadCreditLife(batch.id, file));
    if (r) setResult({ message: r.message, ...r.data });
  };
  const saveMember = async () => {
    setErrors({});
    try {
      const r = await service.addCreditLifeMember(batch.id, { ...member, birthDate: isoDay(member.birthDate), releaseDate: isoDay(member.releaseDate),
        bookingDate: isoDay(member.bookingDate), maturityDate: isoDay(member.maturityDate) });
      showSuccess(toast, r.message);
      setMember(null);
      load();
    } catch (e) {
      setErrors({ ...fieldErrors(e), form: e.message });
    }
  };
  const issue = () => openConfirm({
    title: t("creditLife.issueTitle", "Issue the batch"),
    message: t("creditLife.issueMessage", "A certificate of cover is issued for every valid member and e-mailed to the borrowers with an e-mail address."),
    facts: [{ label: t("creditLife.batch", "Batch"), value: batch.batchNumber }, { label: t("creditLife.valid", "Valid members"), value: batch.valid, type: "number" },
      { label: t("creditLife.failed", "Failed"), value: batch.errors, type: "number" }, { label: t("creditLife.premium", "Premium"), value: batch.totalPremium, type: "amount" }],
    confirmLabel: t("creditLife.issue", "Issue certificates"),
    onConfirm: async () => { const r = await service.issueCreditLifeBatch(batch.id); showSuccess(toast, r.message); },
  }).then((ok) => ok && load());
  const send = () => openConfirm({
    title: t("creditLife.sendTitle", "Send to insurer"),
    facts: [{ label: t("creditLife.batch", "Batch"), value: batch.batchNumber }, { label: t("creditLife.issued", "Issued"), value: batch.issued, type: "number" }],
    input: { type: "text", label: t("creditLife.insurerEmail", "Insurer e-mail (empty: the insurer's contact e-mail)"), required: false },
    confirmLabel: t("creditLife.send", "Send"),
    onConfirm: async (to) => { const r = await service.sendCreditLifeBatch(batch.id, to || undefined); showSuccess(toast, r.message); },
  }).then((ok) => ok !== null && load());
  const sendSoa = () => openConfirm({
    title: t("creditLife.sendSoa", "Send SOA to bank"),
    facts: [{ label: t("creditLife.batch", "Batch"), value: batch.batchNumber }, { label: t("creditLife.premium", "Premium"), value: batch.totalPremium, type: "amount" }],
    input: { type: "text", label: t("creditLife.bankEmail", "Bank e-mail (empty: the bank's e-mail)"), required: false },
    confirmLabel: t("creditLife.send", "Send"),
    onConfirm: async (to) => { const r = await service.sendCreditLifeSoa(batch.id, to || undefined); showSuccess(toast, r.message); },
  }).then((ok) => ok !== null && load());
  const cancel = (m) => openConfirm({
    title: t("creditLife.cancelTitle", "Cancel certificate"), severity: "danger",
    facts: [{ label: t("creditLife.certificate", "Certificate"), value: m.certificateNumber }, { label: t("creditLife.borrower", "Borrower"), value: m.borrowerName },
      { label: t("creditLife.loanAccount", "Loan account"), value: m.loanAccount }],
    input: { type: "textarea", label: t("distribution.oc.reason", "Reason"), required: true },
    confirmLabel: t("creditLife.cancelTitle", "Cancel certificate"), cancelLabel: t("distribution.common.back", "Back"),
    onConfirm: async (reason) => { const r = await service.cancelCreditLifeMember(m.id, reason); showSuccess(toast, r.message); },
  }).then((ok) => ok && load());

  if (!batch) return <div className="pe-page"><Toast ref={toast} /></div>;
  const draft = batch.status === "draft";
  const text = (k, label, required = false) => (
    <Field key={k} label={label} htmlFor={`clm-${k}`} required={required}>
      <InputText id={`clm-${k}`} value={member[k] || ""} onChange={(e) => setMember({ ...member, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Policy servicing")} section={t("creditLife.title", "Credit Life")} title={`${batch.batchNumber} · ${batch.bankName}`}
        subtitle={`${batch.insurerName} · ${batch.productName || ""} · ${batch.period}`}>
        <Button label={t("distribution.common.back", "Back")} icon="pi pi-arrow-left" text onClick={() => navigate(BASE)} />
        {write && draft ? <Button label={t("creditLife.issue", "Issue certificates")} icon="pi pi-check" disabled={busy || !batch.valid} onClick={issue} /> : null}
        {write && ["issued", "sent"].includes(batch.status) ? <Button label={t("creditLife.sendTitle", "Send to insurer")} icon="pi pi-envelope" outlined disabled={busy} onClick={send} /> : null}
        {write && batch.status === "sent" ? <Button label={t("creditLife.sendSoa", "Send SOA to bank")} icon="pi pi-send" outlined disabled={busy} onClick={sendSoa} /> : null}
        {!draft ? <Button label={t("creditLife.soa", "Statement of account")} icon="pi pi-print" text
          onClick={() => printFile(toast, `/credit-life/batches/${encodeURIComponent(batch.id)}/soa`, `${batch.batchNumber}-soa.pdf`)} /> : null}
        {!draft ? <Button label={t("creditLife.accountsList", "Accounts list")} icon="pi pi-file-excel" text onClick={() => service.creditLifeBatchList(batch.id).catch((e) => showError(toast, e))} /> : null}
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.common.status", "Status")}</div><div className="pe-kpi-value"><StatusTag status={batch.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("creditLife.members", "Members")}</div><div className="pe-kpi-value">{batch.members}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("creditLife.failed", "Failed")}</div><div className="pe-kpi-value">{batch.errors}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("creditLife.premium", "Premium")}</div><div className="pe-kpi-value">{money(batch.totalPremium)}</div></div>
      </div>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("creditLife.members", "Members")}>
            {write && draft ? (
              <div className="dist-toolbar">
                <FileField accept=".xlsx" value={file} chooseLabel={t("creditLife.file", "Members file (.xlsx)")} onChange={setFile} />
                <Button label={t("distribution.oc.upload", "Upload")} icon="pi pi-upload" size="small" outlined disabled={!file || busy} onClick={upload} />
                <Button label={t("distribution.oc.template", "Download template")} icon="pi pi-download" size="small" text onClick={() => service.creditLifeTemplate().catch((e) => showError(toast, e))} />
                <Button label={t("creditLife.addMember", "Add member")} icon="pi pi-plus" size="small" outlined onClick={() => { setErrors({}); setMember({ ...EMPTY_MEMBER }); }} />
              </div>
            ) : null}
            {result ? (
              <div className="mb-3">
                <strong>{result.message}</strong>
                {(result.errors || []).slice(0, 200).map((x) => <div key={x.text} className="bv-text-alert">{x.text}</div>)}
              </div>
            ) : null}
            <div className="dist-toolbar">
              <Dropdown value={status} options={["valid", "error", "issued", "cancelled"].map((v) => ({ value: v, label: t(`creditLife.status.${v}`, v) }))} showClear
                placeholder={t("distribution.common.status", "Status")} aria-label={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
            </div>
            <DataTable value={batch.memberList} dataKey="id" size="small" stripedRows paginator rows={25} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="rowNo" header={t("creditLife.row", "Row")} className="bv-num" headerClassName="bv-num" />
              <Column field="loanAccount" header={t("creditLife.loanAccount", "Loan account")} />
              <Column header={t("creditLife.borrower", "Borrower")} body={(m) => <span>{m.borrowerName}<br /><small className="pe-muted">{m.customerNo}</small></span>} />
              <Column header={t("creditLife.birthDate", "Birth date")} body={(m) => date(m.birthDate)} />
              <Column header={t("creditLife.cover", "Period of cover")} body={(m) => (m.coverFrom ? `${date(m.coverFrom)} – ${date(m.coverTo)}` : "")} />
              <Column header={t("creditLife.sumInsured", "Sum insured")} body={(m) => money(m.sumInsured)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditLife.premium", "Premium")} body={(m) => money(m.premium)} className="bv-num" headerClassName="bv-num" />
              <Column field="certificateNumber" header={t("creditLife.certificate", "Certificate")} />
              <Column header={t("distribution.common.status", "Status")} body={(m) => (
                <span>
                  <StatusTag status={m.status === "error" ? "failed" : m.status} />
                  {(m.errors || []).map((e) => <div key={e} className="bv-text-alert"><small>{e}</small></div>)}
                </span>
              )} />
              <Column header={t("common.actions", "Actions")} body={(m) => (
                <RowActions>
                  {m.certificateNumber ? <Button icon="pi pi-print" text rounded aria-label={t("distribution.oc.print", "Print")} tooltip={t("distribution.oc.print", "Print")}
                    onClick={() => printFile(toast, `/credit-life/members/${encodeURIComponent(m.id)}/certificate`, `${m.certificateNumber}.pdf`)} /> : null}
                  {write && m.status === "issued" ? <Button icon="pi pi-times" text rounded severity="danger" aria-label={t("creditLife.cancelTitle", "Cancel certificate")}
                    tooltip={t("creditLife.cancelTitle", "Cancel certificate")} onClick={() => cancel(m)} /> : null}
                  {write && draft ? <Button icon="pi pi-trash" text rounded severity="danger" aria-label={t("creditLife.remove", "Remove member")} tooltip={t("creditLife.remove", "Remove member")}
                    onClick={() => run(() => service.removeCreditLifeMember(m.id))} /> : null}
                </RowActions>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("creditLife.batchTab", "Batch")}>
            <KeyValueGrid columns={3} items={[
              { label: t("creditLife.bank", "Financing bank"), value: batch.bankName }, { label: t("distribution.fl.insurer", "Insurer"), value: batch.insurerName },
              { label: t("creditLife.product", "Product"), value: batch.productName }, { label: t("creditLife.period", "Month"), value: batch.period },
              { label: t("creditLife.fileName", "File"), value: batch.fileName }, { label: t("creditLife.sumInsured", "Sum insured"), value: batch.totalSumInsured, type: "amount" },
              { label: t("creditLife.issuedOn", "Issued"), value: batch.issuedAt, type: "datetime" }, { label: t("creditLife.issuedBy", "Issued by"), value: batch.issuedBy },
              { label: t("creditLife.sentTo", "Sent to"), value: batch.sentTo },
            ]} />
          </TabPanel>
          <TabPanel header={t("distribution.common.history", "History")}>
            <RecordActivityLog entity="credit_life_batch" recordId={batch.id} />
          </TabPanel>
        </TabView>
      </div>
      <Dialog className="pe-dialog" visible={!!member} header={t("creditLife.addMemberTitle", "Add Member")} style={{ width: "min(860px, 96vw)" }} onHide={() => setMember(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setMember(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveMember} /></div>}>
        {member && (
          <div className="dist-grid">
            {text("customerNo", t("creditLife.customerNo", "Customer no."))}
            {text("loanAccount", t("creditLife.loanAccount", "Loan account"), true)}
            {text("lastName", t("creditLife.lastName", "Last name"), true)}
            {text("firstName", t("creditLife.firstName", "First name"), true)}
            <Field label={t("creditLife.birthDate", "Birth date")} htmlFor="clm-birth" required>
              <Calendar inputId="clm-birth" value={member.birthDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setMember({ ...member, birthDate: e.value })} />
            </Field>
            <Field label={t("creditLife.releaseDate", "Release date")} htmlFor="clm-release" required>
              <Calendar inputId="clm-release" value={member.releaseDate} dateFormat="yy-mm-dd" showIcon maxDate={new Date()} onChange={(e) => setMember({ ...member, releaseDate: e.value })} />
            </Field>
            <Field label={t("creditLife.gender")} htmlFor="clm-gender">
              <Dropdown inputId="clm-gender" value={member.gender} showClear onChange={(e) => setMember({ ...member, gender: e.value })}
                options={[{ label: t("creditLife.genderMale"), value: "M" }, { label: t("creditLife.genderFemale"), value: "F" }]} />
            </Field>
            <Field label={t("creditLife.bookingDate")} htmlFor="clm-booking">
              <Calendar inputId="clm-booking" value={member.bookingDate} dateFormat="yy-mm-dd" showIcon maxDate={new Date()} onChange={(e) => setMember({ ...member, bookingDate: e.value })} />
            </Field>
            <Field label={t("creditLife.maturityDate")} htmlFor="clm-maturity">
              <Calendar inputId="clm-maturity" value={member.maturityDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setMember({ ...member, maturityDate: e.value })} />
            </Field>
            <Field label={t("creditLife.outstandingBalance")} htmlFor="clm-outstanding">
              <InputNumber inputId="clm-outstanding" value={member.outstandingBalance} min={0} minFractionDigits={2} onValueChange={(e) => setMember({ ...member, outstandingBalance: e.value })} />
            </Field>
            <Field label={t("creditLife.term", "Loan term (months)")} htmlFor="clm-term" required>
              <InputNumber inputId="clm-term" value={member.loanTermMonths} min={1} useGrouping={false} onValueChange={(e) => setMember({ ...member, loanTermMonths: e.value })} />
            </Field>
            <Field label={t("creditLife.loanAmount", "Amount financed")} htmlFor="clm-amount">
              <InputNumber inputId="clm-amount" value={member.loanAmount} min={0} minFractionDigits={2} onValueChange={(e) => setMember({ ...member, loanAmount: e.value })} />
            </Field>
            <Field label={t("creditLife.accountCount", "Accounts with the bank")} htmlFor="clm-accounts">
              <InputNumber inputId="clm-accounts" value={member.accountCount} min={1} useGrouping={false} onValueChange={(e) => setMember({ ...member, accountCount: e.value })} />
            </Field>
            <Field label={t("creditLife.sumInsured", "Sum insured")} htmlFor="clm-si">
              <InputNumber inputId="clm-si" value={member.sumInsured} min={0} minFractionDigits={2} onValueChange={(e) => setMember({ ...member, sumInsured: e.value })} />
            </Field>
            {text("email", t("distribution.oc.email", "E-mail"))}
            {text("mobile", t("distribution.oc.mobile", "Mobile number"))}
            {text("address", t("creditLife.address", "Address"))}
            {text("city", t("distribution.oc.city", "City or municipality"))}
            {text("province", t("distribution.oc.province", "Province"))}
          </div>
        )}
        {errors.form ? <small className="p-error" role="alert">{errors.form}</small> : null}
      </Dialog>
    </div>
  );
};

export default CreditLife;
