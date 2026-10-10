import React, { useCallback, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Skeleton } from "primereact/skeleton";
import { Toast } from "primereact/toast";
import DateField from "../../components/DateField";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import StatusChip from "../../components/StatusChip";
import { mayConfigure } from "../../components/ConfigStatus";
import useStableLoad from "../../hooks/useStableLoad";
import birTaxService from "../../services/birTaxService";
import { hasPermission } from "../../utils/canOpen";
import { toIsoDate } from "../../utility/dateFormat";
import { BirTag, PageHeader, ScheduleTable, YearPicker, showError, showSuccess } from "./common";
import { dateTime } from "../PeriodEnd/common";
import CasDocumentDialog, { DocStatus } from "./CasDocumentDialog";
import CasRegistrationDialog from "./CasRegistrationDialog";
import "./cas.scss";

export const COMPANY_MASTER_PATH = "/master/generals/organization/companymaster";
const DASH = "-";

const lastMonth = () => {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
};
const monthOptions = () => {
  const out = [];
  const d = new Date();
  for (let i = 0; i < 24; i += 1) {
    const p = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const v = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
    out.push({ label: v, value: v });
  }
  return out;
};
const DOCUMENT_OF = { systemDescription: "system-description", backupProcedure: "backup-procedure" };

/**
 * Accounts > Tax > CAS Books and Documents: the CAS registration pack. Readiness of the pack with an action on every
 * missing item; the system description and the backup procedure as controlled documents (edited, approved by another
 * user, versioned); loose-leaf books previewed, exported and printed per month with page numbers that run on through
 * the year (print register with reprint and void); the audit trail extract.
 */
const CasPack = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const booksRef = useRef(null);
  const [params, setParams] = useSearchParams();
  const [book, setBook] = useState("general_journal");
  const [period, setPeriod] = useState(lastMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [voiding, setVoiding] = useState(null);
  const [voidTried, setVoidTried] = useState(false);
  const [voidBusy, setVoidBusy] = useState(false);
  const [registering, setRegistering] = useState(null);
  const [range, setRange] = useState({ from: "", to: toIsoDate(new Date()) });

  const navigate = useNavigate();
  const canWrite = hasPermission("write:period-end");
  const companyLink = mayConfigure(COMPANY_MASTER_PATH);
  const documentSlug = params.get("document");
  const openDocument = (slug) => setParams((p) => { const next = new URLSearchParams(p); next.set("document", slug); return next; });
  const closeDocument = () => setParams((p) => { const next = new URLSearchParams(p); next.delete("document"); return next; });

  const pack = useStableLoad(useCallback(() => birTaxService.casChecklist(), []));
  const docs = useStableLoad(useCallback(() => birTaxService.casDocuments(), []));
  const prints = useStableLoad(useCallback(() => birTaxService.bookPrints({ year }), [year]));
  const preview = useStableLoad(useCallback(() => birTaxService.bookPreview(book, period), [book, period]));
  const reloadAll = () => { pack.reload(); docs.reload(); prints.reload(); };
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) showSuccess(toast, msg); reloadAll(); return r; } catch (e) { showError(toast, e); return null; } };

  const goToBooks = () => {
    booksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    booksRef.current?.focus({ preventScroll: true });
  };
  // one style for every action of the readiness list: a link of the table's text size
  const actionLink = (label, onClick) => <Button type="button" link size="small" className="cas-action-link" label={label} onClick={onClick} />;
  const actionOf = (r) => {
    if (r.status === "complete") return null;
    if (r.action === "company") {
      return companyLink ? actionLink(t("birTax.casReadiness.openCompany"), () => navigate(COMPANY_MASTER_PATH))
        : <span className="pe-muted">{t("birTax.casReadiness.setByAdministrator")}</span>;
    }
    if (r.action === "document") return actionLink(t("birTax.casReadiness.openDocument"), () => openDocument(DOCUMENT_OF[r.code]));
    if (r.action === "books") return actionLink(t("birTax.casReadiness.goToBooks"), goToBooks);
    return canWrite ? actionLink(t(`birTax.casReadiness.enter.${r.action}`), () => setRegistering(r.action)) : null;
  };

  const confirmVoid = async () => {
    setVoidTried(true);
    if (reasonProblem(voiding.reason)) return;
    setVoidBusy(true);
    try {
      await birTaxService.voidPrint(voiding.print.id, reasonPayload(voiding.reason));
      showSuccess(toast, t("birTax.voided"));
      setVoiding(null);
      reloadAll();
    } catch (e) {
      showError(toast, e);
    } finally {
      setVoidBusy(false);
    }
  };

  const checklist = pack.data?.checklist || [];
  const complete = checklist.filter((r) => r.status === "complete").length;
  const books = (pack.data?.books || []).map((b) => ({ label: b.title, value: b.code }));
  return (
    <div className="pe-page cas-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.cas")} trail={[t("birTax.cas")]} subtitle={t("birTax.casHelp")} />

      <div className="pe-card bv-loading-host">
        <LoadingBar active={pack.refreshing} />
        <div className="pe-card-title">
          <span>{t("birTax.readiness")}</span>
          {checklist.length ? <span className="pe-muted">{t("birTax.casReadiness.count", { complete, total: checklist.length })}</span> : null}
        </div>
        {pack.loading ? <Skeleton height="12rem" /> : (
          <DataTable value={checklist} size="small" dataKey="code">
            <Column header={t("birTax.item")} body={(r) => (
              <div>
                <div>{t(`birTax.casReadiness.item.${r.code}`, { defaultValue: r.item })}</div>
                {r.value ? <div className="pe-muted">{r.value}</div> : null}
              </div>
            )} />
            <Column header={t("birTax.statusLabel")} style={{ width: "9rem" }}
              body={(r) => <StatusChip code={r.status} label={t(`birTax.casReadiness.${r.status}`)} severity={r.status === "complete" ? "success" : "warning"} />} />
            <Column header={t("birTax.casReadiness.action")} style={{ width: "13rem" }} body={actionOf} />
          </DataTable>
        )}
        {pack.error ? <div className="pe-error" role="alert">{pack.error}</div> : null}
      </div>

      <div className="pe-card bv-loading-host">
        <LoadingBar active={docs.refreshing} />
        <div className="pe-card-title"><span>{t("birTax.casDoc.documents")}</span></div>
        {docs.loading ? <Skeleton height="6rem" /> : (
          <DataTable value={docs.data || []} size="small" dataKey="slug">
            <Column header={t("birTax.casDoc.document")} body={(d) => t(`birTax.casDoc.title.${d.type}`, { defaultValue: d.title })} />
            <Column header={t("birTax.casDoc.approvedVersion")} className="bv-num" headerClassName="bv-num" body={(d) => (d.approved ? d.approved.version : DASH)} />
            <Column header={t("birTax.casDoc.approvedAt")} body={(d) => dateTime(d.approved?.approvedAt)} />
            <Column header={t("birTax.casDoc.inProgress")} body={(d) => (d.open ? <span className="flex gap-2 align-items-center">{d.open.version}<DocStatus status={d.open.status} t={t} /></span> : DASH)} />
            <Column header={t("birTax.casReadiness.action")} style={{ width: "13rem" }} body={(d) => (
              <span className="flex gap-1 justify-content-end">
                <Button type="button" outlined size="small" label={t("birTax.open")} onClick={() => openDocument(d.slug)} />
                <Button type="button" icon="pi pi-file-pdf" outlined size="small" label={t("birTax.print")} onClick={() => run(() => birTaxService.casDocumentPdf(d.slug))} />
              </span>
            )} />
          </DataTable>
        )}
      </div>

      <div className="pe-card bv-loading-host" ref={booksRef} tabIndex={-1} id="cas-books">
        <LoadingBar active={preview.refreshing} />
        <div className="pe-card-title">
          <span>{t("birTax.books")}</span>
          <div className="flex flex-wrap gap-2">
            <Dropdown value={book} options={books} onChange={(e) => setBook(e.value)} aria-label={t("birTax.book")} />
            <Dropdown value={period} options={monthOptions()} onChange={(e) => setPeriod(e.value)} aria-label={t("birTax.period")} />
            <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} onClick={() => run(() => birTaxService.bookXlsx(book, period))} />
            {canWrite ? <Button icon="pi pi-print" label={t("birTax.printBook")} onClick={() => run(() => birTaxService.printBook(book, period), t("birTax.printed"))} /> : null}
          </div>
        </div>
        {preview.loading ? <Skeleton height="12rem" /> : preview.data ? <ScheduleTable schedule={preview.data} /> : null}
        {preview.error ? <div className="pe-error" role="alert">{preview.error}</div> : null}
      </div>

      <div className="pe-card bv-loading-host">
        <LoadingBar active={prints.refreshing} />
        <div className="pe-card-title">
          <span>{t("birTax.printRegister")}</span>
          <YearPicker value={year} onChange={setYear} />
        </div>
        <DataTable value={prints.data || []} size="small" dataKey="id" stripedRows emptyMessage={t("birTax.noRows")}>
          <Column field="bookTitle" header={t("birTax.book")} />
          <Column field="period" header={t("birTax.period")} />
          <Column header={t("birTax.pages")} body={(r) => t("birTax.pageRange", { first: r.firstPage, last: r.lastPage })} />
          <Column field="entries" header={t("birTax.entries")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.printedAt")} body={(r) => dateTime(r.printedAt)} />
          <Column field="reprints" header={t("birTax.reprints")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column header={t("birTax.reason")} body={(r) => r.voidReason || ""} />
          <Column body={(r) => r.status === "printed" && canWrite && (
            <span className="flex gap-1">
              <Button icon="pi pi-print" text size="small" aria-label={t("birTax.reprint")} tooltip={t("birTax.reprint")} onClick={() => run(() => birTaxService.reprintBook(r.id))} />
              <Button icon="pi pi-ban" text size="small" severity="danger" aria-label={t("birTax.void")} tooltip={t("birTax.void")}
                onClick={() => { setVoidTried(false); setVoiding({ print: r, reason: null }); }} />
            </span>
          )} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="pe-card-title"><span>{t("birTax.auditExtract")}</span></div>
        <div className="grid formgrid align-items-end">
          <div className="field col-12 sm:col-6 md:col-3">
            <label htmlFor="cas-audit-from">{t("birTax.from")}</label>
            <DateField id="cas-audit-from" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div className="field col-12 sm:col-6 md:col-3">
            <label htmlFor="cas-audit-to">{t("birTax.to")}</label>
            <DateField id="cas-audit-to" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <div className="field col-12 md:col-6 flex gap-2">
            <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} disabled={!range.from || !range.to} onClick={() => run(() => birTaxService.auditExtract(range.from, range.to, "xlsx"))} />
            <Button icon="pi pi-file-pdf" outlined label={t("birTax.pdf")} disabled={!range.from || !range.to} onClick={() => run(() => birTaxService.auditExtract(range.from, range.to, "pdf"))} />
          </div>
        </div>
      </div>

      <Dialog className="pe-dialog bv-centered" visible={!!voiding} header={t("birTax.void")} style={{ width: "min(560px, 95vw)" }} onHide={() => !voidBusy && setVoiding(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text disabled={voidBusy} onClick={() => setVoiding(null)} />
            <Button label={t("birTax.void")} severity="danger" loading={voidBusy} onClick={confirmVoid} />
          </div>
        )}>
        {voiding ? (
          <>
            <KeyValueGrid columns={3} items={[
              { label: t("birTax.book"), value: voiding.print.bookTitle },
              { label: t("birTax.period"), value: voiding.print.period },
              { label: t("birTax.pages"), value: t("birTax.pageRange", { first: voiding.print.firstPage, last: voiding.print.lastPage }) },
            ]} />
            <p className="pe-muted">{t("birTax.voidNote")}</p>
            <ReasonPicker context="cas_print_void" value={voiding.reason} onChange={(reason) => setVoiding({ ...voiding, reason })} showErrors={voidTried} autoFocus />
          </>
        ) : null}
      </Dialog>

      <CasRegistrationDialog kind={registering} onHide={() => setRegistering(null)}
        onSaved={() => { setRegistering(null); showSuccess(toast, t("birTax.saved")); pack.reload(); docs.reload(); }} />
      <CasDocumentDialog slug={documentSlug} onHide={closeDocument} onChanged={() => { pack.reload(); docs.reload(); }} />
    </div>
  );
};

export default CasPack;
