import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import postingRulesService from "../../../services/postingRulesService";
import "../PostingRules/index.scss";

/** "1202001 Premiums Receivable" of a rule line, with where the account comes from. */
const AccountCell = ({ account }) => {
  const { t } = useTranslation();
  return (
    <div>
      <div className="font-semibold">{account.glCode ? `${account.glCode} ${account.glName || ""}` : t("postingRules.flow.decidedAtPosting")}</div>
      <div className="text-500 text-sm">{account.label}{account.role && account.kind !== "role" ? ` (${t("postingRules.flow.else")} ${account.role})` : ""}</div>
    </div>
  );
};

/**
 * Master > Finance > Accounting Flow (read only): what each operational event posts, built from the posting rules in
 * force, so it stays current after every approved rule or account change. For each event: the screen or action that
 * triggers it, the approval before it posts, and its debit and credit lines with today's GL accounts.
 */
const AccountingFlow = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState(null);

  useEffect(() => {
    postingRulesService.flow().then(setData)
      .catch((e) => toast.current?.show({ severity: "error", summary: t("postingRules.error"), detail: e.message, life: 7000 }));
  }, [t]);

  const modules = useMemo(() => [...new Set((data?.events || []).map((e) => e.module))].sort(), [data]);
  const shown = useMemo(() => (data?.events || []).filter((e) => (!module || e.module === module)
    && (!search || `${e.label} ${e.eventCode} ${e.trigger}`.toLowerCase().includes(search.toLowerCase()))), [data, module, search]);

  const lines = (rows) => (
    <DataTable value={rows} dataKey="lineNo" size="small" emptyMessage="-">
      <Column header={t("postingRules.account")} body={(l) => <AccountCell account={l.account} />} />
      <Column header={t("postingRules.amount")} body={(l) => <span><code>{l.amountKey}</code>{l.perParticipant ? ` · ${t("postingRules.flow.perInsurer")}` : ""}</span>} />
    </DataTable>
  );

  return (
    <div className="account-determination">
      <Toast ref={toast} />
      <div className="posting-rules__title">{t("postingRules.flow.title")}</div>
      <BreadCrumb home={{ label: t("postingRules.master") }} className="posting-rules__crumbs" separatorIcon={<SvgDot color={"#000"} />}
        model={[{ label: t("postingRules.finance") }, { label: t("postingRules.flow.title"), url: "/master/finance/accounting-flow" }]} />
      <p className="posting-rules__intro">{t("postingRules.flow.intro", { date: data?.asOf || "" })}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("postingRules.searchEvents")} className="w-20rem" />
        <Dropdown value={module} options={modules.map((m) => ({ label: m, value: m }))} onChange={(e) => setModule(e.value)} showClear placeholder={t("postingRules.flow.allModules")} className="w-15rem" />
      </div>
      {shown.map((e) => (
        <div className="posting-rules__card mb-3" key={e.eventCode}>
          <div className="flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="font-semibold text-lg">{e.label}</div>
              <code className="text-500">{e.eventCode}</code> <span className="text-500 text-sm">· {e.module}</span>
            </div>
            <div className="flex align-items-center gap-2">
              {e.version ? <Tag value={`v${e.version}`} severity="success" /> : <Tag value={t("postingRules.none")} severity="danger" />}
              <Button label={t("postingRules.flow.openRule")} className="p-button-text p-button-sm" onClick={() => navigate("/master/finance/posting-rules")} />
            </div>
          </div>
          <div className="grid mt-2">
            <div className="col-12 md:col-6"><span className="text-500">{t("postingRules.flow.trigger")}:</span> {e.trigger}</div>
            <div className="col-12 md:col-6"><span className="text-500">{t("postingRules.flow.approval")}:</span> {e.approval}</div>
            {e.description && <div className="col-12 text-600">{e.description}</div>}
            <div className="col-12 md:col-6"><div className="font-semibold mb-1">{t("postingRules.flow.debit")}</div>{lines(e.debits)}</div>
            <div className="col-12 md:col-6"><div className="font-semibold mb-1">{t("postingRules.flow.credit")}</div>{lines(e.credits)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AccountingFlow;
