import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import ReturnView from "./ReturnView";
import { BirTag, Kpis, PageHeader, YearPicker, date, money, showError } from "./common";

/**
 * Accounts > Tax > Withholding Returns: the filing calendar of a year (0619-E for the first and second month of each
 * quarter, 1601-EQ per quarter, 2551Q per quarter for a non-VAT broker, 1604-E) with due dates and filing status;
 * opening a return shows it laid out as the BIR form, reconciled with the QAP and the ledger, with its filing record.
 */
const WithholdingReturns = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [ret, setRet] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await birTaxService.calendar(year));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => { load(); setRet(null); setSelected(null); }, [load]);

  const open = useCallback(async (row) => {
    setSelected(row);
    try {
      setRet(await birTaxService.returnOf(row.form, { year: row.year, month: row.month || undefined, quarter: row.form === "0619-E" ? undefined : row.quarter || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, []);
  const refresh = () => { load(); if (selected) open(selected); };

  const filed = rows.filter((r) => r.status === "filed");
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.withholdingReturns")} trail={[t("birTax.withholdingReturns")]} subtitle={t("birTax.withholdingReturnsHelp")}>
        <YearPicker value={year} onChange={setYear} />
      </PageHeader>
      <Kpis items={[
        { label: t("birTax.returnsDue"), value: rows.length },
        { label: t("birTax.returnsFiled"), value: filed.length },
        { label: t("birTax.amountPaid"), value: money(filed.reduce((s, r) => s + Number(r.amountPaid || 0), 0)) },
      ]} />
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="periodKey" size="small" stripedRows emptyMessage={t("birTax.noRows")} selectionMode="single" selection={selected}
          onSelectionChange={(e) => e.value && open(e.value)} rowClassName={(r) => (selected && r.form === selected.form && r.periodKey === selected.periodKey ? "p-highlight" : "")}>
          <Column field="form" header={t("birTax.form")} />
          <Column field="periodLabel" header={t("birTax.period")} />
          <Column header={t("birTax.dueDate")} body={(r) => date(r.dueDate)} />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column header={t("birTax.dateFiled")} body={(r) => (r.dateFiled ? date(r.dateFiled) : "")} />
          <Column field="filingReference" header={t("birTax.filingReference")} />
          <Column header={t("birTax.amountPaid")} body={(r) => (r.amountPaid !== null ? money(r.amountPaid) : "")} className="bv-num" headerClassName="bv-num" />
          <Column body={(r) => <Button icon="pi pi-eye" size="small" outlined label={t("birTax.open")} onClick={() => open(r)} />} />
        </DataTable>
      </div>
      <ReturnView ret={ret} toast={toast} onChanged={refresh} />
    </div>
  );
};

export default WithholdingReturns;
