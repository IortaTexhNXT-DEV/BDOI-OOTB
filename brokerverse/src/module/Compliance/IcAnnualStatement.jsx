import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputNumber } from "primereact/inputnumber";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { FormDialog, PageHeader, money } from "./icCommon";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./ic.scss";

const canWrite = () => {
  try {
    const perms = JSON.parse(localStorage.getItem("USER_PERMISSIONS") || "[]");
    const roles = JSON.parse(localStorage.getItem("USER_ROLES") || "[]");
    return perms.includes("write:compliance") || roles.includes("system-admin");
  } catch {
    return false;
  }
};

/**
 * Compliance > Insurance Commission > IC Annual Statement: the schedules of the broker's annual statement built from
 * the ledger and the production records (balance sheet, income statement, premiums and commissions by insurer and line,
 * premiums held in trust), the checks and the lines the accountant confirms, the account mapping, and the Excel workbook.
 */
const IcAnnualStatement = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [s, setS] = useState(null);
  const [mapping, setMapping] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, m] = await Promise.all([complianceService.annualStatement({ year }), complianceService.statementMapping()]);
      setS(st);
      setMapping(m);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [year, t]);
  useEffect(() => { load(); }, [load]);

  const saveLine = async () => {
    setSaving(true);
    try {
      const r = await complianceService.updateStatementLine(edit.id, { label: edit.label, accountPrefixes: String(edit.prefixes || "").split(/[\s,]+/).filter(Boolean), confirm: edit.confirm || null });
      toast.current?.show({ severity: "success", summary: r.message });
      setEdit(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const schedule = (rows) => (
    <DataTable value={rows || []} dataKey="code" size="small" className="access__table" loading={loading} rowGroupMode="subheader" groupRowsBy="section"
      rowGroupHeaderTemplate={(r) => <strong>{r.section}</strong>}>
      <Column field="code" header={t("compliance.ics.line")} style={{ width: "6rem" }} />
      <Column field="label" header={t("compliance.ics.title")} />
      <Column header={s?.period?.to || ""} body={(r) => money(r.current)} style={{ textAlign: "right" }} />
      <Column header={s?.period?.priorTo || ""} body={(r) => money(r.prior)} style={{ textAlign: "right" }} />
      <Column header={t("compliance.ics.accounts")} body={(r) => (r.accounts || []).join(", ")} />
    </DataTable>
  );
  const tot = s?.totals?.current || {};

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.ics.title2")} intro={t("compliance.ics.intro")}
        actions={(
          <>
            <InputNumber value={year} onValueChange={(e) => e.value && setYear(e.value)} useGrouping={false} min={2000} max={2100} showButtons aria-label={t("compliance.ics.year")} />
            <Button icon="pi pi-file-excel" label={t("compliance.ics.download")} onClick={() => complianceService.exportAnnualStatement({ year }).catch(fail)} />
          </>
        )} />
      {s ? (
        <div className="access__stats">
          <div className="access__stat"><span className="access__stat-value">{money(tot.assets)}</span><span className="access__stat-label">{t("compliance.ics.assets")}</span></div>
          <div className="access__stat"><span className="access__stat-value">{money(tot.liabilities)}</span><span className="access__stat-label">{t("compliance.ics.liabilities")}</span></div>
          <div className="access__stat"><span className="access__stat-value">{money(tot.equity)}</span><span className="access__stat-label">{t("compliance.ics.equity")}</span></div>
          <div className="access__stat"><span className="access__stat-value">{money(tot.netIncome)}</span><span className="access__stat-label">{t("compliance.ics.netIncome")}</span></div>
        </div>
      ) : null}
      <TabView>
        <TabPanel header={t("compliance.ics.checks")}>
          <p className="access__muted">{s?.form}</p>
          <ul className="compliance__checks">
            {(s?.checks || []).map((c) => (
              <li key={c.check} className={c.ok ? "is-ok" : "is-bad"}><i className={`pi ${c.ok ? "pi-check-circle" : "pi-exclamation-triangle"}`} /> {c.check}: {c.detail}</li>
            ))}
          </ul>
          <h4>{t("compliance.ics.toConfirm")}</h4>
          <DataTable value={s?.confirmations || []} dataKey="code" size="small" className="access__table">
            <Column field="code" header={t("compliance.ics.line")} />
            <Column field="label" header={t("compliance.ics.title")} />
            <Column header={t("compliance.ics.amount")} body={(r) => money(r.amount)} />
            <Column field="confirm" header={t("compliance.ics.confirm")} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("compliance.ics.balanceSheet")}>{schedule(s?.balanceSheet)}</TabPanel>
        <TabPanel header={t("compliance.ics.incomeStatement")}>{schedule(s?.incomeStatement)}</TabPanel>
        <TabPanel header={t("compliance.ics.premiumsHeld")}>
          <DataTable value={s?.premiumsHeld?.items || []} dataKey="insurer" size="small" className="access__table"
            footer={`${t("compliance.ics.totalHeld")}: ${money(s?.premiumsHeld?.total)} · ${t("compliance.ics.trustAccount")}: ${money(s?.trustAccount)}`}>
            <Column field="insurer" header={t("compliance.ia.insurer")} />
            <Column header={t("compliance.ics.amount")} body={(r) => money(r.amount)} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("compliance.ics.mapping")}>
          <DataTable value={mapping} dataKey="id" size="small" className="access__table" rowGroupMode="subheader" groupRowsBy="schedule"
            rowGroupHeaderTemplate={(r) => <strong>{t(`compliance.ics.schedule.${r.schedule}`)}</strong>}>
            <Column field="code" header={t("compliance.ics.line")} />
            <Column field="label" header={t("compliance.ics.title")} />
            <Column header={t("compliance.ics.prefixes")} body={(r) => r.accountPrefixes.join(", ")} />
            <Column field="confirm" header={t("compliance.ics.confirm")} />
            {canWrite() ? <Column header="" body={(r) => <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("compliance.edit")}
              onClick={() => setEdit({ id: r.id, label: r.label, prefixes: r.accountPrefixes.join(", "), confirm: r.confirm || "" })} />} /> : null}
          </DataTable>
          {s?.unmapped?.length ? <p className="p-error">{t("compliance.ics.unmapped", { n: s.unmapped.length })}</p> : null}
        </TabPanel>
      </TabView>
      <FormDialog header={t("compliance.ics.editLine")} visible={!!edit} form={edit} setForm={setEdit} onHide={() => setEdit(null)} onSubmit={saveLine} saving={saving} valid={!!edit?.label}
        fields={[
          { name: "label", label: t("compliance.ics.title"), required: true, wide: true },
          { name: "prefixes", label: t("compliance.ics.prefixes"), wide: true, help: t("compliance.ics.prefixesHelp") },
          { name: "confirm", label: t("compliance.ics.confirm"), type: "textarea", wide: true },
        ]} />
    </div>
  );
};

export default IcAnnualStatement;
