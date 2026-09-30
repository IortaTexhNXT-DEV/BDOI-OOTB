import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { Message } from "primereact/message";
import postingRulesService from "../../../services/postingRulesService";

/**
 * Output VAT and EWT on broker-billed commission (Account Determination tab). The rate, ATC and GL account come from the
 * tax codes master (Master > Finance > Taxation); this panel only chooses the codes and switches each tax on or off.
 */
const CommissionTaxes = ({ onSaved, onError }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  // the parent's handlers change on every render; keep the latest ones without reloading
  const handlers = useRef({ onSaved, onError });
  handlers.current = { onSaved, onError };

  const load = useCallback(async () => {
    try {
      const d = await postingRulesService.commissionTaxes();
      setData(d);
      setForm({ vatEnabled: d.vat.enabled, ewtEnabled: d.ewt.enabled, vatCode: d.vat.code, ewtCode: d.ewt.code });
    } catch (e) {
      handlers.current.onError(e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const options = useMemo(() => {
    const of = (type) => (data?.taxCodes || []).filter((c) => c.taxType === type && c.active)
      .map((c) => ({ value: c.code, label: `${c.code} (${c.rate}%) ${c.description}` }));
    return { VAT: of("VAT"), EWT: of("EWT") };
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await postingRulesService.setCommissionTaxes(form);
      handlers.current.onSaved(r.change ? t("postingRules.changePending") : t("postingRules.commissionTaxes.saved"), r);
      load();
    } catch (e) {
      handlers.current.onError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!data || !form) return null;
  const row = (kind, type) => {
    const d = data[kind];
    return (
      <div className="grid align-items-center mb-3">
        <div className="col-12 md:col-3 font-semibold">{t(`postingRules.commissionTaxes.${kind}`)}</div>
        <div className="col-12 md:col-2 flex align-items-center gap-2">
          <InputSwitch checked={form[`${kind}Enabled`]} onChange={(e) => setForm({ ...form, [`${kind}Enabled`]: e.value })} />
          <span>{form[`${kind}Enabled`] ? t("postingRules.commissionTaxes.on") : t("postingRules.commissionTaxes.off")}</span>
        </div>
        <div className="col-12 md:col-4">
          <Dropdown value={form[`${kind}Code`]} options={options[type]} filter className="w-full" onChange={(e) => setForm({ ...form, [`${kind}Code`]: e.value })} />
        </div>
        <div className="col-12 md:col-3 text-600">
          {t("postingRules.commissionTaxes.rateGl", { rate: d.ratePercent, gl: d.glAccount || `${d.fallbackGl} (${d.fallbackRole})` })}
          {d.atc ? ` · ATC ${d.atc}` : ""}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p className="posting-rules__intro">{t("postingRules.commissionTaxes.intro")}</p>
      {row("vat", "VAT")}
      {row("ewt", "EWT")}
      {(!data.vat.codeActive || !data.ewt.codeActive) && <Message severity="warn" text={t("postingRules.commissionTaxes.inactiveCode")} className="mb-3" />}
      <div className="flex justify-content-end">
        <Button label={t("postingRules.save")} icon="pi pi-save" loading={saving} onClick={save} />
      </div>
    </div>
  );
};

export default CommissionTaxes;
