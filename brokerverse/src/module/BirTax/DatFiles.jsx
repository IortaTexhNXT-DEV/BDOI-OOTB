import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Skeleton } from "primereact/skeleton";
import { Toast } from "primereact/toast";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import TechnicalDetails from "../../components/TechnicalDetails";
import useStableLoad from "../../hooks/useStableLoad";
import birTaxService from "../../services/birTaxService";
import { hasPermission } from "../../utils/canOpen";
import { PageHeader, TECHNICAL_ROLES, YearPicker, currentQuarter, money, quarterOptions, showError, showSuccess, yearOptions } from "./common";
import { dateTime } from "../PeriodEnd/common";
import "./tax.scss";

export const DAT_TYPES = ["qap", "sawt", "slspSales", "slspPurchases", "1604e"];
export const SAWT_FORMS = ["1701Q", "1702Q", "2550Q", "2551Q"];
const MAIN_TOTAL = ["taxWithheld", "outputTax", "inputTax", "taxableSales", "incomePayment"];

/** The amount that sums a file up in the register: tax withheld, output or input tax. */
export const mainTotal = (totals = {}) => {
  const key = MAIN_TOTAL.find((k) => totals[k] !== undefined && totals[k] !== null);
  return key ? totals[key] : null;
};
export const periodLabel = (f) => (f.quarter ? `Q${f.quarter} ${f.year}` : String(f.year));

/** Name of a check: "Tax withheld", "Income payment, exempt payees", "Tax withheld: detail records against the control record". */
export const checkLabel = (t, code) => {
  if (code.endsWith("Detail")) return t("birTax.datCheck.detailSum", { name: checkLabel(t, code.slice(0, -"Detail".length)) });
  if (code.endsWith("Exempt")) return t("birTax.datCheck.exempt", { name: checkLabel(t, code.slice(0, -"Exempt".length)) });
  return t(`birTax.datCheck.${code}`);
};
const isCount = (code) => code.startsWith("records");
const checkValue = (code, v) => (v === null || v === undefined ? "-" : isCount(code) ? Number(v).toLocaleString("en-PH") : money(v));

const ResultChip = ({ valid }) => {
  const { t } = useTranslation();
  return <StatusChip label={t(valid ? "birTax.datResult.valid" : "birTax.datResult.invalid")} severity={valid ? "success" : "danger"} />;
};

/** Validation of one generated file: facts, checks against the report, field problems, technical details. */
const Validation = ({ file, onDownload }) => {
  const { t } = useTranslation();
  return (
    <>
      <KeyValueGrid columns={4} items={[
        { label: t("birTax.fileType"), value: t(`birTax.datType.${file.type}`) },
        { label: t("birTax.period"), value: file.form ? `${periodLabel(file)} · ${file.form}` : periodLabel(file) },
        { label: t("birTax.fileName"), value: <span className="tax-file-name">{file.fileName}</span>, span: 2 },
        { label: t("birTax.detailRecords"), value: file.rows, type: "number", decimals: 0 },
        { label: t("birTax.generatedBy"), value: file.generatedByName },
        { label: t("birTax.generatedAt"), value: dateTime(file.generatedAt) },
        { label: t("birTax.result"), value: <ResultChip valid={file.valid} /> },
      ]} />
      <h4 className="tax-subtitle">{t("birTax.checksAgainstReport")}</h4>
      <DataTable value={file.checks} size="small" dataKey="code">
        <Column header={t("birTax.check")} body={(c) => checkLabel(t, c.code)} />
        <Column header={t("birTax.report")} body={(c) => checkValue(c.code, c.report)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.file")} body={(c) => checkValue(c.code, c.file)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.difference")} body={(c) => checkValue(c.code, c.difference)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.result")} style={{ width: "8rem" }}
          body={(c) => <StatusChip label={t(c.agrees ? "birTax.datResult.agrees" : "birTax.datResult.differs")} severity={c.agrees ? "success" : "danger"} />} />
      </DataTable>
      <h4 className="tax-subtitle">{t("birTax.errors")}</h4>
      {file.errors.length ? (
        <DataTable value={file.errors} size="small" dataKey="record" paginator={file.errors.length > 10} rows={10}>
          <Column header={t("birTax.recordNo")} field="record" className="bv-num" headerClassName="bv-num" style={{ width: "8rem" }} />
          <Column header={t("birTax.name")} body={(e) => e.name || "-"} />
          <Column header={t("birTax.problem")} body={(e) => t(`birTax.datError.${e.code}`)} />
        </DataTable>
      ) : <div className="tax-empty">{t("birTax.noErrors")}</div>}
      <TechnicalDetails roles={TECHNICAL_ROLES} className="mt-3" blocks={[
        { label: t("birTax.layoutVersion"), text: file.layoutVersion },
        { label: t("birTax.recordLayout"), text: (file.layout?.records || []).join("\n") },
        { label: t("birTax.fileContent"), text: file.content },
      ]} />
      <div className="flex justify-content-end mt-3">
        <Button icon="pi pi-download" outlined label={t("birTax.download")} onClick={onDownload} />
      </div>
    </>
  );
};

/**
 * Accounts > Tax > BIR DAT Files: the validation data files of the QAP (1601-EQ), the SAWT, the SLSP sales and
 * purchases (RELIEF) and the 1604-E alphalist. A file is generated for a form and period, kept in the register with
 * its validation against the report (detail records and totals compared, field problems per record) and downloaded
 * as generated; the record layout and the content are technical details for finance and IT.
 */
const DatFiles = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [type, setType] = useState("qap");
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [form, setForm] = useState("1702Q");
  const [registerYear, setRegisterYear] = useState(new Date().getFullYear());
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const canGenerate = hasPermission("write:period-end");
  const annual = type === "1604e";

  const register = useStableLoad(useCallback(() => birTaxService.datFiles({ year: registerYear }), [registerYear]));
  const selected = useStableLoad(useCallback(() => birTaxService.datFile(selectedId), [selectedId]), { enabled: !!selectedId });
  const files = useMemo(() => register.data || [], [register.data]);
  useEffect(() => {
    if (!selectedId && files.length) setSelectedId(files[0].id);
  }, [files, selectedId]);

  const generate = async () => {
    setBusy(true);
    try {
      const f = await birTaxService.generateDat(type, { year, quarter: annual ? undefined : quarter, form: type === "sawt" ? form : undefined });
      showSuccess(toast, t("birTax.generatedMsg", { fileName: f.fileName }));
      setSelectedId(f.id);
      selected.setData(f);
      if (registerYear === f.year) register.reload();
      else setRegisterYear(f.year);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  const download = (f) => birTaxService.downloadDatFile(f.id, f.fileName).catch((e) => showError(toast, e));
  const file = selected.data && selected.data.id === selectedId ? selected.data : null;

  return (
    <div className="pe-page tax-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.datFiles")} trail={[t("birTax.datFiles")]} subtitle={t("birTax.datFilesHelp")} />

      {canGenerate && (
        <div className="pe-card">
          <div className="tax-toolbar">
            <div className="tax-field">
              <label htmlFor="dat-type">{t("birTax.fileType")}</label>
              <Dropdown inputId="dat-type" value={type} options={DAT_TYPES.map((x) => ({ label: t(`birTax.datType.${x}`), value: x }))} onChange={(e) => setType(e.value)} />
            </div>
            <div className="tax-field">
              <label htmlFor="dat-year">{t("birTax.year")}</label>
              <Dropdown inputId="dat-year" value={year} options={yearOptions()} onChange={(e) => setYear(e.value)} />
            </div>
            {!annual && (
              <div className="tax-field">
                <label htmlFor="dat-quarter">{t("birTax.quarter")}</label>
                <Dropdown inputId="dat-quarter" value={quarter} options={quarterOptions} onChange={(e) => setQuarter(e.value)} />
              </div>
            )}
            {type === "sawt" && (
              <div className="tax-field">
                <label htmlFor="dat-form">{t("birTax.sawtForm")}</label>
                <Dropdown inputId="dat-form" value={form} options={SAWT_FORMS.map((x) => ({ label: x, value: x }))} onChange={(e) => setForm(e.value)} />
              </div>
            )}
            <Button icon="pi pi-cog" label={t("birTax.generateFile")} loading={busy} onClick={generate} />
          </div>
        </div>
      )}

      <div className="pe-card bv-loading-host">
        <LoadingBar active={selected.refreshing || (!!file && selected.loading)} />
        <div className="pe-card-title"><span>{t("birTax.validation")}</span></div>
        {file ? <Validation file={file} onDownload={() => download(file)} />
          : register.loading || (selectedId && !selected.error) ? <Skeleton height="10rem" /> : <div className="tax-empty">{t("birTax.noFileSelected")}</div>}
        {selected.error ? <div className="pe-error" role="alert">{selected.error}</div> : null}
      </div>

      <div className="pe-card bv-loading-host">
        <LoadingBar active={register.refreshing} />
        <div className="pe-card-title">
          <span>{t("birTax.generatedFiles")}</span>
          <YearPicker value={registerYear} onChange={setRegisterYear} />
        </div>
        <DataTable value={files} loading={register.loading} size="small" dataKey="id" stripedRows paginator={files.length > 15} rows={15} emptyMessage={t("birTax.noGeneratedFiles")}
            selectionMode="single" selection={files.find((f) => f.id === selectedId) || null} onSelectionChange={(e) => e.value && setSelectedId(e.value.id)}
            rowClassName={(f) => (f.id === selectedId ? "tax-row-selected" : "")}>
            <Column header={t("birTax.fileType")} body={(f) => t(`birTax.datType.${f.type}`)} />
            <Column header={t("birTax.period")} body={(f) => (f.form ? `${periodLabel(f)} · ${f.form}` : periodLabel(f))} />
            <Column header={t("birTax.fileName")} body={(f) => <span className="tax-file-name">{f.fileName}</span>} />
            <Column header={t("birTax.records")} field="records" className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.total")} body={(f) => money(mainTotal(f.totals))} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.result")} body={(f) => <ResultChip valid={f.valid} />} />
            <Column header={t("birTax.generatedBy")} field="generatedByName" />
            <Column header={t("birTax.generatedAt")} body={(f) => dateTime(f.generatedAt)} />
            <Column style={{ width: "4rem" }} body={(f) => (
              <Button icon="pi pi-download" text size="small" aria-label={t("birTax.download")} tooltip={t("birTax.download")} onClick={(e) => { e.stopPropagation(); download(f); }} />
            )} />
          </DataTable>
        {register.error ? <div className="pe-error" role="alert">{register.error}</div> : null}
      </div>
    </div>
  );
};

export default DatFiles;
