import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { RadioButton } from "primereact/radiobutton";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import placementService from "../../services/placementService";
import quotationService from "../../services/quotationService";
import { hasPermission } from "../../utils/canOpen";
import { openConfirm } from "../../components/ConfirmDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import { Field, PageHeader, StatusTag, date, dateTime, money, printFile, showError, showSuccess } from "./common";

/** Offers a comparison report needs (the server refuses fewer). */
export const MIN_OPTIONS = 2;
/** Requests for quotation as drop-down options: the ones with enough offers first, the others disabled with their count. */
export const slipOptions = (slips) => slips
  .map((s) => ({ id: s.id, slipNumber: s.slipNumber, insuredName: s.insuredName || s.customerName || "", offers: Number(s.offersReceived) || 0, disabled: (Number(s.offersReceived) || 0) < MIN_OPTIONS }))
  .sort((a, b) => Number(a.disabled) - Number(b.disabled));

/**
 * Operations > Sales & Marketing > Comparison Reports: the printable, branded report given to a client comparing the
 * insurers' offers (of a request for quotation, or of quotations prepared for the client), with the option the broker
 * recommends and why. Never shows commission. E-mailed to the client from here; the client's choice is recorded.
 * A comparison needs two options: the request for quotation list shows each one's offers and only those with two or
 * more can be chosen; quotations are chosen from the list, those of the same prospect or client as the first.
 */
const ComparisonReports = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params] = useSearchParams();
  const write = hasPermission("write:quotations");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [create, setCreate] = useState(null); // { source, slipId, quotes }
  const [slips, setSlips] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [edit, setEdit] = useState(null);
  const [defaults, setDefaults] = useState({ reasons: [] });

  const load = useCallback(async () => {
    try {
      setRows(await service.comparisonReports({ status: status || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.comparisonDefaults().then(setDefaults).catch(() => null); }, []);
  useEffect(() => {
    const slipId = params.get("brokerSlipId");
    if (slipId && write) setCreate({ source: "broker_slip", slipId, quotes: [] });
  }, [params, write]);
  // the requests for quotation that have offers to compare, when the dialog opens
  const creating = Boolean(create);
  useEffect(() => {
    if (!creating) return;
    placementService.listSlips({ status: "submitted,responses-in,closed", pageSize: 200 })
      .then((r) => setSlips(slipOptions(r?.data || [])))
      .catch(() => setSlips([]));
  }, [creating]);

  const searchQuotes = async (e) => {
    const first = create.quotes[0];
    const r = await quotationService.getAllQuotations(1, 20, first?.leadRefId || null, e.query || null);
    const chosen = new Set(create.quotes.map((q) => q.id));
    setQuotes((r.success ? r.data : [])
      .filter((q) => !chosen.has(q.id) && (!first || (first.clientId ? q.clientId === first.clientId : q.leadRefId === first.leadRefId)))
      .map((q) => ({ id: q.id, leadRefId: q.leadRefId, clientId: q.clientId,
        label: `${q.quotationNumber} · ${q.insuranceCompanyName || "-"} · ${q.insured?.name || q.lead?.companyName || [q.lead?.firstName, q.lead?.lastName].filter(Boolean).join(" ")}` })));
  };
  const slip = slips.find((x) => x.id === create?.slipId) || null;
  const createProblem = !create ? null : create.source === "broker_slip"
    ? (slip?.disabled ? t("distribution.cr.needsOffers", "{{number}} has {{count}} insurer offer(s); a comparison needs at least two", { number: slip.slipNumber, count: slip.offers }) : null)
    : (create.quotes.length && create.quotes.length < MIN_OPTIONS ? t("distribution.cr.needsQuotes", "Choose at least two quotations") : null);
  const canPrepare = create && !createProblem && (create.source === "broker_slip" ? Boolean(slip) : create.quotes.length >= MIN_OPTIONS);
  const slipItem = (o) => (
    <div className="cr-slip-option">
      <span>{o.slipNumber} · {o.insuredName}</span>
      <small className={o.disabled ? "p-error" : "pe-muted"}>
        {t("distribution.cr.offerCount", "{{count}} offer(s)", { count: o.offers })}{o.disabled ? ` · ${t("distribution.cr.needsTwo", "needs two offers")}` : ""}
      </small>
    </div>
  );
  const doCreate = async () => {
    try {
      const body = create.source === "broker_slip" ? { brokerSlipId: create.slipId } : { quoteIds: create.quotes.map((q) => q.id) };
      const r = await service.createComparisonReport(body);
      showSuccess(toast, r.message);
      setCreate(null);
      setEdit(toEdit(r.data));
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const toEdit = (r) => ({ ...r, reasonsText: (r.reasons || []).join("\n"), highlights: Object.fromEntries(r.options.map((o) => [o.key, o.highlights || ""])) });
  const saveEdit = async () => {
    try {
      const r = await service.updateComparisonReport(edit.id, { preparedFor: edit.preparedFor, title: edit.title, introduction: edit.introduction, recommendedKey: edit.recommendedKey,
        reasons: edit.reasonsText.split("\n").map((x) => x.trim()).filter(Boolean), highlights: edit.highlights, disclaimer: edit.disclaimer });
      showSuccess(toast, r.message);
      setEdit(toEdit(r.data));
      load();
      return true;
    } catch (e) {
      showError(toast, e);
      return false;
    }
  };
  const reportFacts = (row) => [
    { label: t("distribution.cr.number", "Report"), value: row.reportNumber },
    { label: t("distribution.cr.preparedFor", "Prepared for"), value: row.preparedFor },
  ];
  // the action runs in the confirmation (a failure stays there); the list is reloaded after it
  const confirmAct = async (options, fn) => {
    let result = null;
    const done = await openConfirm({ ...options, onConfirm: async (value) => { result = await fn(value); } });
    // with a field the dialog gives its value (an empty address included), null when cancelled
    if (done === false || done === null) return null;
    if (result?.message) showSuccess(toast, result.message);
    load();
    return result;
  };
  const email = (row) => confirmAct({
    title: t("distribution.cr.emailTitle", "E-mail comparison report"),
    message: t("distribution.cr.emailMessage", "The client report (PDF) is sent from the outbox."),
    facts: [...reportFacts(row), { label: t("distribution.cr.recommended", "Recommended"), value: row.recommended?.insurer, hidden: !row.recommended }],
    input: { type: "text", label: t("distribution.cr.emailAddress", "E-mail address"), placeholder: t("distribution.cr.emailOnFile", "The client's e-mail on file"),
      validate: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? t("distribution.cr.emailInvalid", "Enter a valid e-mail address.") : null) },
    confirmLabel: t("distribution.cr.emailAction", "Send e-mail"),
  }, (to) => service.emailComparisonReport(row.id, to || undefined));
  const accept = async (row, option) => {
    const r = await confirmAct({
      title: t("distribution.cr.chosenTitle", "Record the client's choice"),
      message: t("distribution.cr.chosenMessage", "The report is closed with this option and can no longer be changed."),
      facts: [
        ...reportFacts(row),
        { label: t("distribution.cr.insurer", "Insurer"), value: option.insurer },
        { label: t("distribution.fl.sumInsured", "Sum insured"), value: option.sumInsured, type: "amount" },
        { label: t("distribution.cr.total", "Total premium"), value: option.grossPremium, type: "amount", emphasis: true },
      ],
      confirmLabel: t("distribution.cr.chosenAction", "Record choice"),
    }, () => service.acceptComparisonReport(row.id, option.key));
    if (r) setEdit(null);
  };
  const printReport = (row) => printFile(toast, `/comparison-reports/${encodeURIComponent(row.id)}/pdf`, `${row.reportNumber}.pdf`);
  const addReason = (reason) => setEdit((e) => ({ ...e, reasonsText: [e.reasonsText, reason].filter(Boolean).join("\n") }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.cr.title", "Comparison Reports")}
        subtitle={t("distribution.cr.subtitle", "The client's comparison of the insurers' offers with the broker's recommendation and reasons, printed on the letterhead.")}>
        {write ? <Button label={t("distribution.cr.new", "New report")} icon="pi pi-plus" onClick={() => setCreate({ source: "broker_slip", slipId: null, quotes: [] })} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={status} options={["draft", "issued", "accepted"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
        </div>
        <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="reportNumber" header={t("distribution.cr.number", "Report")} />
          <Column field="preparedFor" header={t("distribution.cr.preparedFor", "Prepared for")} />
          <Column header={t("distribution.cr.source", "Compared")} body={(r) => (r.brokerSlipNumber ? `${t("distribution.cr.rfq", "Request for quotation")} ${r.brokerSlipNumber}` : t("distribution.cr.quotes", "{{count}} quotations", { count: r.quoteIds.length }))} />
          <Column header={t("distribution.cr.options", "Options")} body={(r) => r.options.length} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.cr.recommended", "Recommended")} body={(r) => (r.recommended ? `${r.recommended.insurer} (${money(r.recommended.grossPremium)})` : "")} />
          <Column header={t("distribution.cr.sent", "Sent")} body={(r) => (r.sentAt ? `${dateTime(r.sentAt)} ${r.sentTo || ""}` : "")} />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
          <Column body={(r) => (
            <div className="dist-actions">
              <Button icon="pi pi-print" text size="small" tooltip={t("distribution.cr.pdf", "Client report (PDF)")} aria-label={t("distribution.cr.pdf", "Client report (PDF)")} onClick={() => printReport(r)} />
              {write ? <Button icon="pi pi-envelope" text size="small" tooltip={t("distribution.cr.email", "E-mail to the client")} aria-label={t("distribution.cr.email", "E-mail to the client")} onClick={() => email(r)} /> : null}
              {write && r.status !== "accepted" ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setEdit(toEdit(r))} /> : null}
            </div>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={t("distribution.cr.new", "New report")} visible={!!create} style={{ width: "min(620px, 96vw)" }} onHide={() => setCreate(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setCreate(null)} /><Button label={t("distribution.cr.prepare", "Prepare")} icon="pi pi-check" onClick={doCreate}
          disabled={!canPrepare} /></div>}>
        {create && (
          <div className="dist-grid">
            <Field label={t("distribution.cr.source", "Compared")} full>
              <SelectButton value={create.source} options={[{ value: "broker_slip", label: t("distribution.cr.rfq", "Request for quotation") }, { value: "quotations", label: t("distribution.cr.quotations", "Quotations") }]}
                onChange={(e) => e.value && setCreate({ ...create, source: e.value })} />
            </Field>
            {create.source === "broker_slip" ? (
              <Field label={t("distribution.cr.rfq", "Request for quotation")} full htmlFor="cr-slip"
                help={t("distribution.cr.rfqHelp", "Its insurer offers become the options of the report; a request with fewer than two offers cannot be compared yet")}>
                <Dropdown inputId="cr-slip" value={create.slipId} options={slips} optionValue="id" optionLabel="slipNumber" optionDisabled="disabled" itemTemplate={slipItem}
                  valueTemplate={(o, p) => (o ? `${o.slipNumber} · ${o.insuredName}` : p.placeholder)} filter filterBy="slipNumber,insuredName"
                  placeholder={t("distribution.cr.chooseRfq", "Choose the request for quotation")} emptyMessage={t("distribution.cr.noRfq", "No request for quotation has insurer offers yet")}
                  onChange={(e) => setCreate({ ...create, slipId: e.value })} />
              </Field>
            ) : (
              <Field label={t("distribution.cr.quotations", "Quotations")} full htmlFor="cr-quotes" help={t("distribution.cr.quoteHelp", "Two or more quotations of the same prospect or client")}>
                <AutoComplete inputId="cr-quotes" multiple value={create.quotes} suggestions={quotes} completeMethod={searchQuotes} field="label" forceSelection dropdown
                  placeholder={create.quotes.length ? "" : t("distribution.cr.searchQuotes", "Quotation number or customer")} onChange={(e) => setCreate({ ...create, quotes: e.value || [] })} />
              </Field>
            )}
            {createProblem ? <Message severity="warn" className="dist-field--full" text={createProblem} /> : null}
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={edit ? `${edit.reportNumber} · ${edit.preparedFor}` : ""} visible={!!edit} style={{ width: "min(1000px, 96vw)" }} onHide={() => setEdit(null)}
        footer={edit ? (
          <div>
            <Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setEdit(null)} />
            <Button label={t("distribution.cr.pdf", "Client report (PDF)")} icon="pi pi-print" outlined onClick={async () => { if (await saveEdit()) printReport(edit); }} />
            <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveEdit} />
          </div>
        ) : null}>
        {edit && (
          <div>
            <KeyValueGrid columns={4} className="mb-3" items={[
              { label: t("distribution.common.status", "Status"), value: <StatusTag status={edit.status} /> },
              { label: t("distribution.cr.source", "Compared"), value: edit.brokerSlipNumber ? `${t("distribution.cr.rfq", "Request for quotation")} ${edit.brokerSlipNumber}` : t("distribution.cr.quotes", "{{count}} quotations", { count: edit.quoteIds.length }) },
              { label: t("distribution.cr.createdBy", "Prepared by"), value: edit.createdBy },
              { label: t("distribution.cr.createdAt", "Prepared on"), value: edit.createdAt, type: "datetime" },
              { label: t("distribution.cr.sent", "Sent"), value: edit.sentAt ? `${dateTime(edit.sentAt)}${edit.sentTo ? ` · ${edit.sentTo}` : ""}` : null, hidden: !edit.sentAt },
            ]} />
            <div className="dist-grid">
              <Field label={t("distribution.cr.preparedFor", "Prepared for")}><InputText value={edit.preparedFor} onChange={(e) => setEdit({ ...edit, preparedFor: e.target.value })} /></Field>
              <Field label={t("distribution.cr.titleLabel", "Title")}><InputText value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label={t("distribution.cr.intro", "Introduction")} full><InputTextarea rows={2} value={edit.introduction || ""} onChange={(e) => setEdit({ ...edit, introduction: e.target.value })} /></Field>
            </div>
            <DataTable value={edit.options} dataKey="key" size="small" stripedRows className="mt-3">
              <Column header={t("distribution.cr.recommend", "Recommend")} body={(o) => <RadioButton inputId={`rec-${o.key}`} checked={edit.recommendedKey === o.key} onChange={() => setEdit({ ...edit, recommendedKey: o.key })} />} style={{ width: "6rem" }} />
              <Column field="rank" header="#" style={{ width: "3rem" }} />
              <Column field="insurer" header={t("distribution.cr.insurer", "Insurer")} />
              <Column header={t("distribution.fl.sumInsured", "Sum insured")} body={(o) => money(o.sumInsured)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.cr.total", "Total premium")} body={(o) => money(o.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column field="deductible" header={t("distribution.cr.deductible", "Deductible")} />
              <Column header={t("distribution.cr.validUntil", "Valid until")} body={(o) => date(o.validUntil)} />
              <Column header={t("distribution.cr.highlights", "What stands out")} body={(o) => (
                <InputText value={edit.highlights[o.key] || ""} onChange={(e) => setEdit({ ...edit, highlights: { ...edit.highlights, [o.key]: e.target.value } })} className="w-full" />
              )} />
              <Column body={(o) => <Button label={t("distribution.cr.chosen", "Client chose")} size="small" text onClick={() => accept(edit, o)} />} />
            </DataTable>
            <div className="dist-grid mt-3">
              <Field label={t("distribution.cr.reasons", "Why we recommend it (one reason per line)")} full>
                <InputTextarea rows={4} value={edit.reasonsText} onChange={(e) => setEdit({ ...edit, reasonsText: e.target.value })} />
                <div className="dist-toolbar mt-2">{(defaults.reasons || []).map((r) => <Button key={r} label={r} size="small" text icon="pi pi-plus" onClick={() => addReason(r)} />)}</div>
              </Field>
              <Field label={t("distribution.cr.disclaimer", "Disclaimer")} full><InputTextarea rows={2} value={edit.disclaimer || ""} onChange={(e) => setEdit({ ...edit, disclaimer: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ComparisonReports;
