import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import { printView } from "../../components/Print";
import { PageHeader, date, money, showError, showSuccess } from "./common";

const MONTH = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString("en-US", { month: "short", year: "numeric" });

/** Printable BIR Form 2307 (Certificate of Creditable Tax Withheld at Source) layout. */
const Form2307 = ({ c, t }) => (
  <div className="pe-2307">
    <div className="f-head">
      <div>{t("periodEnd.bir.republic")}<br />{t("periodEnd.bir.dof")}<br /><strong>{t("periodEnd.bir.bir")}</strong></div>
      <div className="f-title">BIR Form No. 2307<br />{t("periodEnd.bir.certificate")}</div>
      <div>{c.certificateNumber ? `${t("periodEnd.bir.certNo")} ${c.certificateNumber}` : t("periodEnd.bir.draft")}</div>
    </div>
    <div className="f-row"><span>1 {t("periodEnd.bir.forPeriod")}</span><span>{date(c.periodFrom)} – {date(c.periodTo)}</span></div>
    <div className="f-part">{t("periodEnd.bir.part1")}</div>
    <div className="f-row"><span>2 {t("periodEnd.bir.tin")}</span><span>{c.payee.tin || "-"}</span></div>
    <div className="f-row"><span>3 {t("periodEnd.bir.payeeName")}</span><span>{c.payee.name}</span></div>
    <div className="f-row"><span>4 {t("periodEnd.bir.address")}</span><span>{c.payee.address || "-"}</span></div>
    <div className="f-part">{t("periodEnd.bir.part2")}</div>
    <div className="f-row"><span>6 {t("periodEnd.bir.tin")}</span><span>{c.payor.tin || "-"}</span></div>
    <div className="f-row"><span>7 {t("periodEnd.bir.payorName")}</span><span>{c.payor.name}</span></div>
    <div className="f-row"><span>8 {t("periodEnd.bir.address")}</span><span>{c.payor.address || "-"} {c.payor.zip || ""}</span></div>
    <div className="f-part">{t("periodEnd.bir.part3")}</div>
    <table>
      <thead>
        <tr>
          <th>{t("periodEnd.bir.incomePayments")}</th><th>ATC</th>
          {c.months.map((m, i) => <th key={m} className="num">{t(`periodEnd.bir.month${i + 1}`)}<br />({MONTH(m)})</th>)}
          <th className="num">{t("periodEnd.total")}</th><th className="num">{t("periodEnd.bir.taxWithheld")}</th>
        </tr>
      </thead>
      <tbody>
        {c.lines.map((l) => (
          <tr key={l.atc}><td>{l.nature}</td><td>{l.atc}</td><td className="num">{money(l.month1)}</td><td className="num">{money(l.month2)}</td><td className="num">{money(l.month3)}</td>
            <td className="num">{money(l.total)}</td><td className="num">{money(l.tax)}</td></tr>
        ))}
        <tr><td colSpan={5}><strong>{t("periodEnd.total")}</strong></td><td className="num"><strong>{money(c.totalIncome)}</strong></td><td className="num"><strong>{money(c.totalTax)}</strong></td></tr>
      </tbody>
    </table>
    <div className="f-sign"><div>{t("periodEnd.bir.payorSignature")}</div><div>{t("periodEnd.bir.payeeSignature")}</div></div>
  </div>
);

/**
 * Accounts > Tax > BIR Form 2307: payees with expanded withholding in a quarter (issued by the broker on payment
 * vouchers) or payors that withheld from the broker (insurers on direct-bill commission, clients); the certificate per
 * payee and quarter can be printed and issued (numbered CWT-...).
 */
const Bir2307 = ({ payeeType = null }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [direction, setDirection] = useState("issued");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cert, setCert] = useState(null);
  const payees = data?.payees || [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await periodEndService.payees2307({ year, quarter, direction, payeeType: payeeType || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [year, quarter, direction, payeeType]);
  useEffect(() => { load(); }, [load]);

  const open = async (row) => {
    try {
      setCert(await periodEndService.certificate2307({ year, quarter, direction, payeeKey: row.payeeKey }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const certFacts = (c) => [
    { label: t("periodEnd.bir.payeeName"), value: c.payee.name },
    { label: t("periodEnd.bir.tin"), value: c.payee.tin },
    { label: t("periodEnd.bir.forPeriod"), value: `${date(c.periodFrom)} – ${date(c.periodTo)}` },
    { label: t("periodEnd.bir.incomePayments"), value: c.totalIncome, type: "amount" },
    { label: t("periodEnd.bir.taxWithheld"), value: c.totalTax, type: "amount", emphasis: true },
  ];

  const issue = async () => {
    const ok = await openConfirm({
      title: t("periodEnd.confirmations.issue2307Title"),
      message: t("periodEnd.confirmations.issue2307Message"),
      facts: certFacts(cert),
      confirmLabel: t("periodEnd.confirmations.issue2307"),
    });
    if (!ok) return;
    try {
      const c = await periodEndService.issue2307({ year, quarter, direction, payeeKey: cert.payeeKey });
      setCert(c);
      showSuccess(toast, `${c.certificateNumber}`);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  const issueAll = async () => {
    const pending = payees.filter((p) => !p.certificateNumber);
    const ok = await openConfirm({
      title: t("periodEnd.confirmations.issueAllTitle", { quarter: `Q${quarter} ${year}` }),
      message: t("periodEnd.confirmations.issueAllMessage"),
      facts: [
        { label: t("periodEnd.confirmations.quarter"), value: `Q${quarter} ${year}` },
        { label: t("periodEnd.confirmations.certificates"), value: pending.length, type: "number" },
        { label: t("periodEnd.bir.incomePayments"), value: pending.reduce((sum, p) => sum + p.totalIncome, 0), type: "amount" },
        { label: t("periodEnd.bir.taxWithheld"), value: pending.reduce((sum, p) => sum + p.totalTax, 0), type: "amount", emphasis: true },
      ],
      confirmLabel: t("periodEnd.confirmations.issueAll", { count: pending.length }),
    });
    if (!ok) return;
    try {
      const r = await periodEndService.issueAll2307({ year, quarter, payeeType: payeeType || undefined });
      showSuccess(toast, t("supplier2307.issuedAll", { count: r.issued.length }));
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  const print = () => printView(<Form2307 c={cert} t={t} />, { title: `BIR Form 2307 ${cert.certificateNumber || cert.payee.name}` }).catch((e) => showError(toast, e));

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => ({ label: String(y), value: y }));
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={payeeType === "Supplier" ? t("supplier2307.title") : t("periodEnd.bir2307")} section={payeeType === "Supplier" ? t("supplier2307.section") : t("periodEnd.tax")}
        trail={[payeeType === "Supplier" ? t("supplier2307.title") : t("periodEnd.bir2307")]}>
        {!payeeType && <SelectButton value={direction} onChange={(e) => e.value && setDirection(e.value)} options={[{ label: t("periodEnd.bir.issued"), value: "issued" }, { label: t("periodEnd.bir.received"), value: "received" }]} />}
        <Dropdown value={year} options={years} onChange={(e) => setYear(e.value)} />
        <Dropdown value={quarter} options={[1, 2, 3, 4].map((q) => ({ label: `Q${q}`, value: q }))} onChange={(e) => setQuarter(e.value)} />
        {direction === "issued" && payees.some((p) => !p.certificateNumber) && <Button icon="pi pi-verified" label={t("supplier2307.issueAll")} onClick={issueAll} />}
      </PageHeader>
      {payeeType === "Supplier" && <p className="mt-0">{t("supplier2307.intro")}</p>}
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{direction === "issued" ? t("periodEnd.bir.payees") : t("periodEnd.bir.payors")}</div><div className="pe-kpi-value">{payees.length}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.bir.incomePayments")}</div><div className="pe-kpi-value">{money(payees.reduce((s, p) => s + p.totalIncome, 0))}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.bir.taxWithheld")}</div><div className="pe-kpi-value">{money(payees.reduce((s, p) => s + p.totalTax, 0))}</div></div>
      </div>
      <div className="pe-card">
        <DataTable value={payees} loading={loading} dataKey="payeeKey" size="small" stripedRows emptyMessage={t("periodEnd.noWithholding")}>
          <Column field="payeeName" header={direction === "issued" ? t("periodEnd.bir.payeeName") : t("periodEnd.bir.payorName")} />
          <Column field="tin" header={t("periodEnd.bir.tin")} />
          <Column header="ATC" body={(r) => r.atcs.join(", ")} />
          <Column field="transactions" header={t("periodEnd.bir.transactions")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("periodEnd.bir.incomePayments")} body={(r) => money(r.totalIncome)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("periodEnd.bir.taxWithheld")} body={(r) => money(r.totalTax)} className="bv-num" headerClassName="bv-num" />
          <Column field="certificateNumber" header={t("periodEnd.bir.certNo")} />
          <Column body={(r) => <Button icon="pi pi-print" size="small" outlined label={t("periodEnd.bir.view")} onClick={() => open(r)} />} />
        </DataTable>
      </div>
      <DetailDialog header={cert ? `BIR Form 2307 – ${cert.payee.name}` : ""} visible={!!cert} onHide={() => setCert(null)} size="lg"
        footer={cert && (
          <>
            <Button label={t("detailView.close")} outlined onClick={() => setCert(null)} />
            <Button icon="pi pi-print" outlined label={t("periodEnd.bir.print")} onClick={print} />
            {direction === "issued" && !cert.certificateNumber && <Button icon="pi pi-verified" label={t("periodEnd.confirmations.issue2307")} onClick={issue} />}
          </>
        )}>
        {cert && <Form2307 c={cert} t={t} />}
      </DetailDialog>
    </div>
  );
};

export default Bir2307;
