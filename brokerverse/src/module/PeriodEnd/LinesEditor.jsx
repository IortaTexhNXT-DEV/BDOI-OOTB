import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import periodEndService from "../../services/periodEndService";
import { money } from "./common";

let accountsCache = null;
/** Active GL accounts as drop-down options (loaded once). */
export const useAccountOptions = () => {
  const [options, setOptions] = useState(accountsCache || []);
  useEffect(() => {
    if (accountsCache) return;
    periodEndService.accounts().then((rows) => {
      accountsCache = (rows || []).map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code }));
      setOptions(accountsCache);
    }).catch(() => setOptions([]));
  }, []);
  return options;
};

/** Debit / credit journal lines with running totals (recurring templates, adjustment journals). */
const LinesEditor = ({ lines, onChange }) => {
  const { t } = useTranslation();
  const accounts = useAccountOptions();
  const set = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.round(debit * 100) === Math.round(credit * 100) && debit > 0;
  return (
    <div className="pe-lines">
      <table className="pe-statement">
        <thead>
          <tr><th>{t("periodEnd.account")}</th><th>{t("periodEnd.memo")}</th><th className="num">{t("periodEnd.debit")}</th><th className="num">{t("periodEnd.credit")}</th><th /></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ minWidth: 260 }}>
                <Dropdown value={l.accountCode} options={accounts} filter onChange={(e) => set(i, { accountCode: e.value })} placeholder={t("periodEnd.selectAccount")} className="w-full" />
              </td>
              <td><InputText value={l.memo || ""} onChange={(e) => set(i, { memo: e.target.value })} className="w-full" /></td>
              <td className="num"><InputNumber value={l.debit || null} onValueChange={(e) => set(i, { debit: e.value || 0, credit: e.value ? 0 : l.credit })} minFractionDigits={2} maxFractionDigits={2} inputStyle={{ width: 130, textAlign: "right" }} /></td>
              <td className="num"><InputNumber value={l.credit || null} onValueChange={(e) => set(i, { credit: e.value || 0, debit: e.value ? 0 : l.debit })} minFractionDigits={2} maxFractionDigits={2} inputStyle={{ width: 130, textAlign: "right" }} /></td>
              <td><Button icon="pi pi-trash" text severity="danger" disabled={lines.length <= 2} onClick={() => onChange(lines.filter((_, j) => j !== i))} /></td>
            </tr>
          ))}
          <tr className="pe-subtotal">
            <td><Button icon="pi pi-plus" text label={t("periodEnd.addLine")} onClick={() => onChange([...lines, { accountCode: null, debit: 0, credit: 0, memo: "" }])} /></td>
            <td className={balanced ? "" : "pe-error"}>{balanced ? t("periodEnd.balanced") : t("periodEnd.notBalanced")}</td>
            <td className="num">{money(debit)}</td>
            <td className="num">{money(credit)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const emptyLines = () => [{ accountCode: null, debit: 0, credit: 0, memo: "" }, { accountCode: null, debit: 0, credit: 0, memo: "" }];
export default LinesEditor;
