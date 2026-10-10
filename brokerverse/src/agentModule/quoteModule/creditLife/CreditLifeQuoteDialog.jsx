import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import DetailDialog from "../../../components/DetailDialog";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import quotationService from "../../../services/quotationService";
import placementService from "../../../services/placementService";
import { CustomerPicker, customerFields } from "../../../module/Placement/shared";

const EMPTY = { loanAccountNo: "", borrowerBirthDate: "", accountCount: 1, pendingBalance: 0, loanTermYears: 1, sumInsured: null };

/**
 * A Credit Life quotation (TIS-BRD-QUOT-06): the borrower, the TFS loan account and the insurer; the server applies the
 * eligibility rules and prices it at the fixed rate. A Credit Life product placed without a quotation (new business,
 * journey quotation step skipped) opens the direct placement instead.
 */
const CreditLifeQuoteDialog = ({ product, lead, onHide }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState({ kind: "lead" });
  const [insurers, setInsurers] = useState([]);
  const [insurerId, setInsurerId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!product) return undefined;
    let alive = true;
    setForm(EMPTY);
    setError(null);
    setReady(false);
    (async () => {
      const journey = await placementService.journey({ productId: product.id }).catch(() => null);
      if (!alive) return;
      if (journey?.quotationSlip === "skip") {
        onHide();
        navigate("/placement/placement-slips/new", { state: { productId: product.id } });
        return;
      }
      const options = await quotationService.getInsuranceCompanyOptions().catch(() => []);
      if (!alive) return;
      setInsurers((options || []).map((o) => ({ label: o.label, value: Number(o.id ?? o.value) })));
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [product, navigate, onHide]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e.value }));
  const submit = async () => {
    const who = lead ? { leadRefId: lead } : customerFields(customer);
    if (!who.leadRefId && !who.clientId) return setError(t("creditLifeQuote.chooseBorrower"));
    if (!insurerId) return setError(t("creditLifeQuote.chooseInsurer"));
    setBusy(true);
    setError(null);
    try {
      const q = await quotationService.createQuotationStrict({
        ...who, productId: product.id, productType: product.code, insuranceCompanyId: insurerId,
        creditLife: { ...form, sumInsured: form.sumInsured || undefined, borrowerBirthDate: form.borrowerBirthDate || undefined },
      });
      onHide();
      navigate(`/agent/quotedetailview/${q.quotationId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailDialog visible={Boolean(product) && ready} onHide={onHide} size="md" header={t("creditLifeQuote.title", { product: product?.name || "" })}
      footer={(
        <>
          <Button type="button" label={t("creditLifeQuote.cancel")} text disabled={busy} onClick={onHide} />
          <Button type="button" label={t("creditLifeQuote.create")} icon="pi pi-check" loading={busy} onClick={submit} />
        </>
      )}>
      <div className="p-fluid formgrid grid">
        {lead ? null : (
          <div className="field col-12">
            <label htmlFor="cl-borrower">{t("creditLifeQuote.borrower")}</label>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
        )}
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-insurer">{t("creditLifeQuote.insurer")}</label>
          <Dropdown inputId="cl-insurer" value={insurerId} options={insurers} onChange={(e) => setInsurerId(e.value)} filter />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-account">{t("creditLifeQuote.loanAccountNo")}</label>
          <InputText id="cl-account" value={form.loanAccountNo} onChange={set("loanAccountNo")} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-birth">{t("creditLifeQuote.borrowerBirthDate")}</label>
          <DateField id="cl-birth" value={form.borrowerBirthDate} onChange={set("borrowerBirthDate")} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-accounts">{t("creditLifeQuote.accountCount")}</label>
          <InputNumber inputId="cl-accounts" value={form.accountCount} onValueChange={set("accountCount")} min={1} useGrouping={false} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-balance">{t("creditLifeQuote.pendingBalance")}</label>
          <InputNumber inputId="cl-balance" value={form.pendingBalance} onValueChange={set("pendingBalance")} min={0} minFractionDigits={2} maxFractionDigits={2} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-term">{t("creditLifeQuote.loanTermYears")}</label>
          <InputNumber inputId="cl-term" value={form.loanTermYears} onValueChange={set("loanTermYears")} min={1} useGrouping={false} />
        </div>
        <div className="field col-12 md:col-6">
          <label htmlFor="cl-si">{t("creditLifeQuote.sumInsured")}</label>
          <InputNumber inputId="cl-si" value={form.sumInsured} onValueChange={set("sumInsured")} min={0} minFractionDigits={2} maxFractionDigits={2}
            placeholder={t("creditLifeQuote.defaultSumInsured")} />
        </div>
      </div>
      <FieldError error={error} />
    </DetailDialog>
  );
};

CreditLifeQuoteDialog.propTypes = { product: PropTypes.object, lead: PropTypes.string, onHide: PropTypes.func.isRequired };
CreditLifeQuoteDialog.defaultProps = { product: null, lead: null };

export default CreditLifeQuoteDialog;
