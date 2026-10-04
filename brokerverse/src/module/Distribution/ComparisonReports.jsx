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
import { RadioButton } from "primereact/radiobutton";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import placementService from "../../services/placementService";
import { hasPermission } from "../../utils/canOpen";
import { promptText } from "../../utility/dialogs";
import { Field, PageHeader, StatusTag, date, dateTime, money, showError, showSuccess } from "./common";

/**
 * Operations > Sales & Marketing > Comparison Reports: the printable, branded report given to a client comparing the
 * insurers' offers (of a request for quotation, or of quotations prepared for the client), with the option the broker
 * recommends and why. Never shows commission. E-mailed to the client from here; the client's choice is recorded.
 */
const ComparisonReports = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params] = useSearchParams();
  const write = hasPermission("write:quotations");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [create, setCreate] = useState(null); // { source, slip, quoteNumbers }
  const [slips, setSlips] = useState([]);
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
    if (slipId && write) setCreate({ source: "broker_slip", slip: { id: slipId, label: params.get("slipNumber") || slipId }, quoteNumbers: "" });
  }, [params, write]);

  const searchSlips = async (e) => {
    try {
      const r = await placementService.listSlips({ search: e.query, pageSize: 15 });
      setSlips((r?.data || []).map((s) => ({ id: s.id, label: `${s.slipNumber} · ${s.insuredName || ""}` })));
    } catch {
      setSlips([]);
    }
  };
  const doCreate = async () => {
    try {
      const body = create.source === "broker_slip" ? { brokerSlipId: create.slip.id } : { quoteIds: create.quoteNumbers.split(/[\s,;]+/).filter(Boolean) };
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
  const act = async (fn) => {
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    }
  };
  const email = async (row) => {
    const to = await promptText(t("distribution.cr.emailTo", "Send to (empty: the client's e-mail on file)"), "", { multiline: false });
    if (to === null) return;
    act(() => service.emailComparisonReport(row.id, to || undefined));
  };
  const accept = async (row, key) => {
    const r = await act(() => service.acceptComparisonReport(row.id, key));
    if (r) setEdit(null);
  };
  const addReason = (reason) => setEdit((e) => ({ ...e, reasonsText: [e.reasonsText, reason].filter(Boolean).join("\n") }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.cr.title", "Comparison Reports")}
        subtitle={t("distribution.cr.subtitle", "The client's comparison of the insurers' offers with the broker's recommendation and reasons, printed on the letterhead.")}>
        {write ? <Button label={t("distribution.cr.new", "New report")} icon="pi pi-plus" onClick={() => setCreate({ source: "broker_slip", slip: null, quoteNumbers: "" })} /> : null}
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
              <Button icon="pi pi-file-pdf" text size="small" tooltip={t("distribution.cr.pdf", "Client report (PDF)")} aria-label={t("distribution.cr.pdf", "Client report (PDF)")} onClick={() => act(() => service.comparisonPdf(r.id))} />
              {write ? <Button icon="pi pi-envelope" text size="small" tooltip={t("distribution.cr.email", "E-mail to the client")} aria-label={t("distribution.cr.email", "E-mail to the client")} onClick={() => email(r)} /> : null}
              {write && r.status !== "accepted" ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setEdit(toEdit(r))} /> : null}
            </div>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={t("distribution.cr.new", "New report")} visible={!!create} style={{ width: "min(620px, 96vw)" }} onHide={() => setCreate(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setCreate(null)} /><Button label={t("distribution.cr.prepare", "Prepare")} icon="pi pi-check" onClick={doCreate}
          disabled={create?.source === "broker_slip" ? !create?.slip?.id : !create?.quoteNumbers} /></div>}>
        {create && (
          <div className="dist-grid">
            <Field label={t("distribution.cr.source", "Compared")} full>
              <SelectButton value={create.source} options={[{ value: "broker_slip", label: t("distribution.cr.rfq", "Request for quotation") }, { value: "quotations", label: t("distribution.cr.quotations", "Quotations") }]}
                onChange={(e) => e.value && setCreate({ ...create, source: e.value })} />
            </Field>
            {create.source === "broker_slip" ? (
              <Field label={t("distribution.cr.rfq", "Request for quotation")} full help={t("distribution.cr.rfqHelp", "Its insurer offers become the options of the report")}>
                <AutoComplete value={create.slip} suggestions={slips} completeMethod={searchSlips} field="label" forceSelection onChange={(e) => setCreate({ ...create, slip: e.value })} />
              </Field>
            ) : (
              <Field label={t("distribution.cr.quoteNumbers", "Quotation numbers")} full help={t("distribution.cr.quoteHelp", "Two or more quotations of the same prospect or client, separated by commas")}>
                <InputText value={create.quoteNumbers} onChange={(e) => setCreate({ ...create, quoteNumbers: e.target.value })} />
              </Field>
            )}
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={edit ? `${edit.reportNumber} · ${edit.preparedFor}` : ""} visible={!!edit} style={{ width: "min(1000px, 96vw)" }} onHide={() => setEdit(null)}
        footer={edit ? (
          <div>
            <Button label={t("distribution.cr.pdf", "Client report (PDF)")} icon="pi pi-file-pdf" outlined onClick={async () => { if (await saveEdit()) act(() => service.comparisonPdf(edit.id)); }} />
            <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveEdit} />
          </div>
        ) : null}>
        {edit && (
          <div>
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
              <Column body={(o) => <Button label={t("distribution.cr.chosen", "Client chose")} size="small" text onClick={() => accept(edit, o.key)} />} />
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
