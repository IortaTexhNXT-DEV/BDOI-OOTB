import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import ReturnView from "./ReturnView";
import { Kpis, PageHeader, QuarterPicker, YearPicker, currentQuarter, money, showError } from "./common";

/**
 * One BIR return for a chosen period:
 *   form 1604-E   Accounts > Tax > Annual Alphalist 1604-E: the annual information return with the alphalist of payees
 *                 (schedules 3 and 4) and the remittances per month; Excel, print and the 1604-E DAT file
 *   form 2551Q    Accounts > Tax > Percentage Tax 2551Q: the working paper of a non-VAT broker or agent (gross sales
 *                 per month from the ledger at bir.percentage_tax_rate)
 */
const SingleReturn = ({ form }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const annual = form === "1604-E";
  const [year, setYear] = useState(annual ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [ret, setRet] = useState(null);

  const load = useCallback(async () => {
    try {
      setRet(await birTaxService.returnOf(form, { year, quarter: annual ? undefined : quarter }));
    } catch (e) {
      showError(toast, e);
    }
  }, [form, year, quarter, annual]);
  useEffect(() => { load(); }, [load]);

  const title = annual ? t("birTax.alphalist1604e") : t("birTax.percentageTax");
  const vatRegistered = ret?.header?.find(([k]) => k === "VAT registered")?.[1]?.startsWith("Yes");
  const datDownload = async () => {
    try { await birTaxService.datDownload("1604e", { year }); } catch (e) { showError(toast, e); }
  };
  const s3 = ret?.schedules?.find((s) => s.code === "schedule3");
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={title} trail={[title]} subtitle={annual ? t("birTax.alphalist1604eHelp") : t("birTax.percentageTaxHelp")}>
        <YearPicker value={year} onChange={setYear} />
        {!annual && <QuarterPicker value={quarter} onChange={setQuarter} />}
        {annual && <Button icon="pi pi-download" outlined label={t("birTax.datFile")} onClick={datDownload} />}
      </PageHeader>
      {ret && (
        <Kpis items={annual
          ? [{ label: t("birTax.payees"), value: s3?.rows.length || 0 }, { label: t("birTax.incomePayments"), value: money(s3?.totals.incomePayment || 0) },
            { label: t("birTax.taxWithheld"), value: money(s3?.totals.taxWithheld || 0) }]
          : [{ label: t("birTax.grossSales"), value: money(ret.schedules[0].totals.grossSales) }, { label: t("birTax.rate"), value: `${ret.rate}%` },
            { label: t("birTax.taxDue"), value: money(ret.taxDue) }, { label: t("birTax.vatRegistered"), value: vatRegistered ? t("common.yes") : t("common.no") }]} />
      )}
      <ReturnView ret={ret} toast={toast} onChanged={load} />
    </div>
  );
};

export const Alphalist1604E = () => <SingleReturn form="1604-E" />;
export const PercentageTax = () => <SingleReturn form="2551Q" />;
export default SingleReturn;
