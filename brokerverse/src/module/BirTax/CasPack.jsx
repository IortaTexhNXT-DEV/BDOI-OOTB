import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { BirTag, PageHeader, ScheduleTable, YearPicker, showError, showSuccess } from "./common";
import { dateTime } from "../PeriodEnd/common";

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

/**
 * Accounts > Tax > CAS Books and Documents: the CAS registration pack. Loose-leaf books (general journal, general
 * ledger, cash receipts, cash disbursements, sales and purchase books) previewed, exported and printed per month with
 * page numbers that run on through the year (print register with reprint and void); the system description and
 * controls, the backup and restore procedure, the audit trail extract and the readiness checklist.
 */
const CasPack = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [pack, setPack] = useState(null);
  const [book, setBook] = useState("general_journal");
  const [period, setPeriod] = useState(lastMonth());
  const [preview, setPreview] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [prints, setPrints] = useState([]);
  const [voiding, setVoiding] = useState(null);
  const [range, setRange] = useState({ from: null, to: new Date() });

  const loadPack = useCallback(async () => {
    try {
      setPack(await birTaxService.casChecklist());
      setPrints(await birTaxService.bookPrints({ year }));
    } catch (e) {
      showError(toast, e);
    }
  }, [year]);
  useEffect(() => { loadPack(); }, [loadPack]);
  const loadPreview = useCallback(async () => {
    setPreview(null);
    try { setPreview(await birTaxService.bookPreview(book, period)); } catch (e) { showError(toast, e); }
  }, [book, period]);
  useEffect(() => { loadPreview(); }, [loadPreview]);
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) showSuccess(toast, typeof msg === "function" ? msg(r) : msg); loadPack(); } catch (e) { showError(toast, e); } };

  const books = (pack?.books || []).map((b) => ({ label: b.title, value: b.code }));
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.cas")} trail={[t("birTax.cas")]} subtitle={t("birTax.casHelp")}>
        <Button icon="pi pi-file-pdf" outlined label={t("birTax.systemDescription")} onClick={() => run(() => birTaxService.systemDescription())} />
        <Button icon="pi pi-file-pdf" outlined label={t("birTax.backupProcedure")} onClick={() => run(() => birTaxService.backupProcedure())} />
      </PageHeader>

      <div className="pe-card">
        <h4>{t("birTax.readiness")}</h4>
        <DataTable value={pack?.checklist || []} size="small" dataKey="item">
          <Column field="item" header={t("birTax.item")} />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.done ? "accepted" : "not_filed"} />} style={{ width: "10rem" }} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h4 className="m-0">{t("birTax.books")}</h4>
          <div className="flex flex-wrap gap-2">
            <Dropdown value={book} options={books} onChange={(e) => setBook(e.value)} aria-label={t("birTax.book")} />
            <Dropdown value={period} options={monthOptions()} onChange={(e) => setPeriod(e.value)} aria-label={t("birTax.period")} />
            <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} onClick={() => run(() => birTaxService.bookXlsx(book, period))} />
            <Button icon="pi pi-print" label={t("birTax.printBook")} onClick={() => run(() => birTaxService.printBook(book, period), t("birTax.printed"))} />
          </div>
        </div>
        {preview && <ScheduleTable schedule={preview} />}
      </div>

      <div className="pe-card">
        <div className="flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h4 className="m-0">{t("birTax.printRegister")}</h4>
          <YearPicker value={year} onChange={setYear} />
        </div>
        <DataTable value={prints} size="small" dataKey="id" stripedRows emptyMessage={t("birTax.noRows")}>
          <Column field="bookTitle" header={t("birTax.book")} />
          <Column field="period" header={t("birTax.period")} />
          <Column header={t("birTax.pages")} body={(r) => `${r.firstPage} to ${r.lastPage}`} />
          <Column field="entries" header={t("birTax.entries")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.printedAt")} body={(r) => dateTime(r.printedAt)} />
          <Column field="reprints" header={t("birTax.reprints")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column body={(r) => r.status === "printed" && (
            <span className="flex gap-1">
              <Button icon="pi pi-print" text size="small" aria-label={t("birTax.reprint")} tooltip={t("birTax.reprint")} onClick={() => run(() => birTaxService.reprintBook(r.id))} />
              <Button icon="pi pi-ban" text size="small" severity="danger" aria-label={t("birTax.void")} tooltip={t("birTax.void")} onClick={() => setVoiding({ id: r.id, reason: "" })} />
            </span>
          )} />
        </DataTable>
      </div>

      <div className="pe-card">
        <h4>{t("birTax.auditExtract")}</h4>
        <div className="flex flex-wrap gap-2 align-items-end">
          <div><label>{t("birTax.from")}</label><br /><Calendar value={range.from} onChange={(e) => setRange({ ...range, from: e.value })} dateFormat={calendarDateFormat()} showIcon /></div>
          <div><label>{t("birTax.to")}</label><br /><Calendar value={range.to} onChange={(e) => setRange({ ...range, to: e.value })} dateFormat={calendarDateFormat()} showIcon /></div>
          <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} disabled={!range.from || !range.to} onClick={() => run(() => birTaxService.auditExtract(toIsoDate(range.from), toIsoDate(range.to), "xlsx"))} />
          <Button icon="pi pi-file-pdf" outlined label="PDF" disabled={!range.from || !range.to} onClick={() => run(() => birTaxService.auditExtract(toIsoDate(range.from), toIsoDate(range.to), "pdf"))} />
        </div>
      </div>

      <Dialog className="pe-dialog" visible={!!voiding} header={t("birTax.void")} style={{ width: "min(520px, 95vw)" }} onHide={() => setVoiding(null)}
        footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setVoiding(null)} /><Button label={t("birTax.void")} severity="danger" disabled={!voiding || voiding.reason.trim().length < 3}
          onClick={() => run(async () => { await birTaxService.voidPrint(voiding.id, voiding.reason); setVoiding(null); }, t("birTax.voided"))} /></div>}>
        {voiding && (<><label>{t("birTax.reason")} *</label><InputTextarea value={voiding.reason} rows={3} onChange={(e) => setVoiding({ ...voiding, reason: e.target.value })} className="w-full" /><p className="pe-muted">{t("birTax.voidNote")}</p></>)}
      </Dialog>
    </div>
  );
};

export default CasPack;
