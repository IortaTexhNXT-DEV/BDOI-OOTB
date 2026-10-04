import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import birTaxService from "../../services/birTaxService";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { BirTag, ScheduleTable, date, money, showError, showSuccess } from "./common";

const periodParams = (r) => ({ year: r.period.year, quarter: r.period.quarter || undefined, month: r.period.month || undefined });

/** Record (or correct) the filing of a return: date filed, references, amount paid, penalties. */
const FilingDialog = ({ ret, filing, amended, onHide, onSaved, toast }) => {
  const { t } = useTranslation();
  const [v, setV] = useState(() => ({
    dateFiled: toDate(filing?.dateFiled) || new Date(), filingReference: filing?.filingReference || "", amountPaid: filing ? filing.amountPaid : Math.max(ret.taxDue, 0),
    penalties: filing?.penalties || 0, paymentDate: toDate(filing?.paymentDate), paymentReference: filing?.paymentReference || "", paymentChannel: filing?.paymentChannel || "",
    remarks: filing?.remarks || "",
  }));
  const set = (p) => setV((x) => ({ ...x, ...p }));
  const save = async () => {
    const body = { dateFiled: toIsoDate(v.dateFiled), filingReference: v.filingReference || undefined, amountPaid: Number(v.amountPaid || 0), penalties: Number(v.penalties || 0),
      paymentDate: v.paymentDate ? toIsoDate(v.paymentDate) : undefined, paymentReference: v.paymentReference || undefined, paymentChannel: v.paymentChannel || undefined, remarks: v.remarks || undefined };
    try {
      if (filing && !amended) await birTaxService.updateFiling(filing.id, body);
      else await birTaxService.recordFiling(ret.form, { ...periodParams(ret), ...body, amended: !!amended });
      showSuccess(toast, t("birTax.filingSaved"));
      onSaved();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <Dialog className="pe-dialog" visible header={`${amended ? t("birTax.amendedFiling") : t("birTax.recordFiling")}: ${ret.form} ${ret.period.label}`} style={{ width: "min(720px, 95vw)" }} onHide={onHide}
      footer={<div><Button label={t("periodEnd.cancel")} text onClick={onHide} /><Button label={t("periodEnd.save")} icon="pi pi-save" onClick={save} disabled={!v.dateFiled} /></div>}>
      <div className="grid">
        <div className="col-12 md:col-4"><label>{t("birTax.dateFiled")} *</label><Calendar value={v.dateFiled} onChange={(e) => set({ dateFiled: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
        <div className="col-12 md:col-8"><label>{t("birTax.filingReference")}</label><InputText value={v.filingReference} onChange={(e) => set({ filingReference: e.target.value })} className="w-full" /></div>
        <div className="col-12 md:col-4"><label>{t("birTax.amountPaid")} *</label><InputNumber value={v.amountPaid} onValueChange={(e) => set({ amountPaid: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" /></div>
        <div className="col-12 md:col-4"><label>{t("birTax.penalties")}</label><InputNumber value={v.penalties} onValueChange={(e) => set({ penalties: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" /></div>
        <div className="col-12 md:col-4"><label>{t("birTax.paymentDate")}</label><Calendar value={v.paymentDate} onChange={(e) => set({ paymentDate: e.value })} dateFormat={calendarDateFormat()} showIcon showButtonBar className="w-full" /></div>
        <div className="col-12 md:col-6"><label>{t("birTax.paymentReference")}</label><InputText value={v.paymentReference} onChange={(e) => set({ paymentReference: e.target.value })} className="w-full" /></div>
        <div className="col-12 md:col-6"><label>{t("birTax.paymentChannel")}</label><InputText value={v.paymentChannel} placeholder="eFPS, eBIRForms, LANDBANK Link.BizPortal" onChange={(e) => set({ paymentChannel: e.target.value })} className="w-full" /></div>
        <div className="col-12"><label>{t("periodEnd.remarks")}</label><InputTextarea value={v.remarks} rows={2} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></div>
      </div>
    </Dialog>
  );
};

/**
 * A BIR return computed from the books: background information, the items in BIR order, the schedules, the
 * reconciliation with the QAP and the ledger, and the filing record with its history. Print (PDF) and Excel.
 */
const ReturnView = ({ ret, onChanged, toast }) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  if (!ret) return null;
  const params = periodParams(ret);
  const run = async (fn) => { try { await fn(); } catch (e) { showError(toast, e); } };
  const cancelFiling = async () => {
    try {
      await birTaxService.cancelFiling(cancelling.id, reason);
      setCancelling(null);
      setReason("");
      onChanged();
    } catch (e) {
      showError(toast, e);
    }
  };
  const rec = ret.reconciliation;
  return (
    <div className="pe-card">
      <div className="flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div>
          <h3 className="m-0">BIR Form No. {ret.form}: {ret.title}</h3>
          <div className="pe-muted">{ret.period.label} ({date(ret.period.from)} to {date(ret.period.to)}) · {t("birTax.formVersion")} {ret.formVersion}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon="pi pi-print" outlined label={t("birTax.print")} onClick={() => run(() => birTaxService.returnPdf(ret.form, params))} />
          <Button icon="pi pi-file-excel" outlined label={t("birTax.excel")} onClick={() => run(() => birTaxService.returnXlsx(ret.form, params))} />
          {!ret.filing && <Button icon="pi pi-check-square" label={t("birTax.recordFiling")} onClick={() => setDialog({ amended: false })} />}
          {ret.filing && <Button icon="pi pi-pencil" outlined label={t("birTax.editFiling")} onClick={() => setDialog({ amended: false, filing: ret.filing })} />}
          {ret.filing && <Button icon="pi pi-copy" outlined label={t("birTax.amendedFiling")} onClick={() => setDialog({ amended: true })} />}
        </div>
      </div>

      <h4>{t("birTax.part1")}</h4>
      <div className="grid">
        {ret.header.map(([k, v]) => <div key={k} className="col-12 md:col-6"><span className="pe-muted">{k}: </span><strong>{v || "-"}</strong></div>)}
      </div>

      <h4>{t("birTax.part2")}</h4>
      <DataTable value={ret.items} size="small" stripedRows dataKey="label">
        <Column field="no" header={t("birTax.item")} style={{ width: "6rem" }} />
        <Column field="label" header={t("birTax.particulars")} />
        <Column header={t("birTax.taxBase")} body={(r) => (r.taxBase !== undefined ? money(r.taxBase) : "")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.rate")} body={(r) => (r.rate !== undefined && r.rate !== null ? `${r.rate}%` : "")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.amount")} body={(r) => money(r.amount)} className="bv-num" headerClassName="bv-num" />
      </DataTable>

      {ret.schedules.map((s) => (
        <div key={s.code}>
          <h4>{s.title}</h4>
          <ScheduleTable schedule={s} />
        </div>
      ))}

      {rec?.checks?.length > 0 && (
        <>
          <h4>{t("birTax.reconciliation")} <BirTag status={rec.reconciled ? "accepted" : "failed"} /></h4>
          <DataTable value={rec.checks} size="small" dataKey="code">
            <Column field="label" header={t("birTax.check")} />
            <Column header={t("birTax.returnAmount")} body={(r) => money(r.returnAmount)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.comparedWith")} body={(r) => money(r.otherAmount)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.difference")} body={(r) => money(r.difference)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.result")} body={(r) => (r.reconciled ? t("birTax.reconciled") : t("birTax.toExplain"))} />
          </DataTable>
          {rec.ledger && <p className="pe-muted">{t("birTax.ledgerNote", { remitted: money(rec.ledger.remitted), closing: money(rec.ledger.closingBalance) })}</p>}
        </>
      )}

      <h4>{t("birTax.filingRecord")}</h4>
      <DataTable value={ret.filingHistory} size="small" dataKey="id" emptyMessage={t("birTax.notFiled")}>
        <Column header={t("birTax.dateFiled")} body={(r) => date(r.dateFiled)} />
        <Column field="filingReference" header={t("birTax.filingReference")} />
        <Column header={t("birTax.amountPaid")} body={(r) => money(r.amountPaid)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.penalties")} body={(r) => money(r.penalties)} className="bv-num" headerClassName="bv-num" />
        <Column field="paymentReference" header={t("birTax.paymentReference")} />
        <Column field="paymentChannel" header={t("birTax.paymentChannel")} />
        <Column header={t("birTax.amended")} body={(r) => (r.amended ? t("birTax.yes") : "")} />
        <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
        <Column body={(r) => r.status === "filed" && <Button icon="pi pi-times" text size="small" severity="danger" aria-label={t("birTax.cancelFiling")} tooltip={t("birTax.cancelFiling")} onClick={() => setCancelling(r)} />} />
      </DataTable>

      {dialog && <FilingDialog ret={ret} filing={dialog.filing} amended={dialog.amended} toast={toast} onHide={() => setDialog(null)} onSaved={() => { setDialog(null); onChanged(); }} />}
      <Dialog className="pe-dialog" visible={!!cancelling} header={t("birTax.cancelFiling")} style={{ width: "min(520px, 95vw)" }} onHide={() => setCancelling(null)}
        footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setCancelling(null)} /><Button label={t("birTax.cancelFiling")} severity="danger" onClick={cancelFiling} disabled={reason.trim().length < 3} /></div>}>
        <label>{t("birTax.reason")} *</label>
        <InputTextarea value={reason} rows={3} onChange={(e) => setReason(e.target.value)} className="w-full" />
        <p className="pe-muted">{t("birTax.cancelFilingNote")}</p>
      </Dialog>
    </div>
  );
};

export default ReturnView;
