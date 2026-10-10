import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Row } from "primereact/row";
import service from "../../services/distributionService";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import StatusChip from "../../components/StatusChip";
import { formatValue } from "../../components/Dashboard/format";
import { getDisplayCurrencyConfig } from "../../utility/currencyConverter";
import { formatPercent } from "../../utility/numberFormat";
import { Field, showError } from "./common";

/** Invoice prices the preview accepts (the sum insured of a brand-new car). */
export const MIN_PRICE = 1;
export const MAX_PRICE = 999999999;
const DEFAULT_PRICE = 1000000;

const amount = (v) => formatValue("currency", v);
const rate = (v) => (v === null || v === undefined ? "" : formatPercent(v, { decimals: 4, minDecimals: 2 }));

/** Short words for who pays under a programme: "Buyer", "Dealer 50%", "Dealer, first year", "Bank ₱5,000.00". */
export const usePayerTerms = () => {
  const { t } = useTranslation();
  return (p) => {
    const payer = t(`distribution.mp.payer.${p.subsidyPayer === "bank" ? "bank" : "dealer"}`, p.subsidyPayer === "bank" ? "Bank" : "Dealer");
    if (p.freeFirstYear) return t("distribution.mp.terms.firstYear", "{{payer}}, first year", { payer });
    if (p.subsidyPayer === "none") return t("distribution.mp.terms.buyer", "Buyer");
    if (p.subsidyType === "full") return t("distribution.mp.terms.full", "{{payer}}, full premium", { payer });
    const share = p.subsidyType === "percent" ? formatPercent(p.subsidyValue, { decimals: 2 }) : amount(p.subsidyValue);
    return t("distribution.mp.terms.share", "{{payer}} {{share}}, buyer the rest", { payer, share });
  };
};

/**
 * Premium preview of a dealer programme: the premium of a car at an invoice price, priced as the upload's quotation, line by
 * line (covers, net premium, taxes, CTPL) with what the dealer or bank and the buyer pay, and the basis it was priced on.
 */
const DealerPremiumPreview = ({ programme, onHide, toast }) => {
  const { t } = useTranslation();
  const terms = usePayerTerms();
  const [options, setOptions] = useState({ vehicleTypes: [], lgus: [] });
  const [input, setInput] = useState({ invoicePrice: DEFAULT_PRICE, vehicleType: null, lguCode: null, financed: true });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const valid = input.invoicePrice >= MIN_PRICE && input.invoicePrice <= MAX_PRICE;
  const bankPays = programme?.subsidyPayer === "bank";

  const compute = useCallback(async (values) => {
    if (!programme) return;
    const call = latest.current + 1;
    latest.current = call;
    setBusy(true);
    try {
      const params = { invoicePrice: values.invoicePrice, vehicleType: values.vehicleType || undefined, lguCode: values.lguCode || undefined,
        financed: programme.subsidyPayer === "bank" ? String(values.financed) : undefined };
      const data = await service.premiumPreview(programme.id, params);
      if (latest.current === call) setResult(data);
    } catch (e) {
      if (latest.current === call) showError(toast, e);
    } finally {
      if (latest.current === call) setBusy(false);
    }
  }, [programme, toast]);

  useEffect(() => {
    if (!programme) return;
    const first = { invoicePrice: DEFAULT_PRICE, vehicleType: programme.vehicleType || null, lguCode: null, financed: true };
    setInput(first);
    setResult(null);
    compute(first);
  }, [programme, compute]);
  useEffect(() => {
    if (!programme) return;
    service.previewOptions().then(setOptions).catch(() => setOptions({ vehicleTypes: [], lgus: [] }));
  }, [programme]);

  const run = () => { if (valid) compute(input); };
  // Enter computes the price as typed, before the input commits it
  const onEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const typed = Number(String(e.target.value).replace(/[^0-9.]/g, ""));
    const next = { ...input, invoicePrice: typed || input.invoicePrice };
    setInput(next);
    if (next.invoicePrice >= MIN_PRICE && next.invoicePrice <= MAX_PRICE) compute(next);
  };
  const set = (patch) => setInput((v) => ({ ...v, ...patch }));

  const payerLabel = result?.payerType === "bank" ? t("distribution.mp.payer.bank", "Bank") : t("distribution.mp.payer.dealer", "Dealer");
  const lines = result ? result.lines : [];
  const covers = lines.filter((l) => l.kind === "cover");
  const sum = (list, key) => Math.round(list.reduce((s, l) => s + l[key], 0) * 100) / 100;
  const net = { code: "net", kind: "net", name: t("distribution.mp.net", "Net premium"), base: null, rate: null, amount: sum(covers, "amount"), payer: sum(covers, "payer"), buyer: sum(covers, "buyer") };
  const rows = result ? [...covers, net, ...lines.filter((l) => l.kind !== "cover")] : [];
  const lineName = (l) => {
    if (l.kind === "ctpl") return t("distribution.mp.ctplYears", "CTPL ({{count}} year)", { count: l.years || 1 });
    if (l.code === "adjustment") return t("distribution.mp.adjustment", "Rating adjustment");
    return l.name;
  };
  const basis = result?.basis;
  const basisLine = basis ? [
    t("distribution.mp.basis.sumInsured", "Sum insured {{amount}}", { amount: amount(basis.sumInsured) }),
    t("distribution.mp.basis.od", "Own damage / theft {{rate}}", { rate: rate(basis.ownDamageRate) }),
    basis.actsOfNatureRate ? t("distribution.mp.basis.aon", "Acts of nature {{rate}}", { rate: rate(basis.actsOfNatureRate) }) : null,
    basis.vehicleTypeLabel,
    basis.lgtRate !== null ? t("distribution.mp.basis.lgt", "LGT {{rate}} {{place}}", { rate: rate(basis.lgtRate), place: basis.lgu ? basis.lgu.name : t("distribution.mp.basis.standard", "(standard rate)") }) : null,
    t("distribution.mp.basis.programme", "Programme {{code}}", { code: basis.programmeCode }),
    basis.insurerName,
  ].filter(Boolean).join(" · ") : "";

  const footer = (
    <ColumnGroup>
      <Row>
        <Column footer={t("distribution.mp.gross", "Total")} colSpan={3} />
        <Column footer={result ? amount(result.grossPremium) : ""} footerClassName="bv-num" />
        <Column footer={result ? amount(result.payer) : ""} footerClassName="bv-num" />
        <Column footer={result ? amount(result.buyer) : ""} footerClassName="bv-num" />
      </Row>
    </ColumnGroup>
  );

  const header = programme ? `${t("distribution.mp.preview", "Premium preview")} · ${programme.code}` : "";
  return (
    <DetailDialog visible={!!programme} onHide={onHide} size="lg" header={header}
      footer={<Button type="button" label={t("detailView.close", "Close")} outlined onClick={onHide} />}>
      {programme ? (
        <div className="dist-premium-preview">
          <div className="dist-premium-preview__inputs">
            <Field label={t("distribution.mp.invoicePrice", "Invoice price")} htmlFor="mp-preview-price" required
              error={valid ? null : t("distribution.mp.priceRange", "Enter an amount from {{min}} to {{max}}", { min: amount(MIN_PRICE), max: amount(MAX_PRICE) })}>
              <InputNumber inputId="mp-preview-price" value={input.invoicePrice} mode="currency" currency={getDisplayCurrencyConfig().currency} locale={getDisplayCurrencyConfig().locale}
                minFractionDigits={0} maxFractionDigits={2} min={0} max={MAX_PRICE} onValueChange={(e) => set({ invoicePrice: e.value })} onKeyDown={onEnter}
                className={valid ? undefined : "p-invalid"} />
            </Field>
            <Field label={t("distribution.mp.vehicleClass", "Vehicle class")} htmlFor="mp-preview-class">
              <Dropdown inputId="mp-preview-class" value={input.vehicleType} options={options.vehicleTypes} optionLabel="label" optionValue="value" filter
                placeholder={programme.vehicleType || ""} onChange={(e) => set({ vehicleType: e.value })} />
            </Field>
            <Field label={t("distribution.mp.location", "Location (LGT)")} htmlFor="mp-preview-lgu">
              <Dropdown inputId="mp-preview-lgu" value={input.lguCode} showClear filter options={options.lgus.map((l) => ({ value: l.code, label: `${l.name} · ${rate(l.rate)}` }))}
                placeholder={t("distribution.mp.standardLgt", "Standard LGT rate")} onChange={(e) => set({ lguCode: e.value || null })} />
            </Field>
            {bankPays ? (
              <Field label={t("distribution.mp.financing", "Financing")}>
                <span className="flex align-items-center gap-2">
                  <Checkbox inputId="mp-preview-financed" checked={input.financed} onChange={(e) => set({ financed: e.checked })} />
                  <label htmlFor="mp-preview-financed">{t("distribution.mp.financedBy", "Financed by {{bank}}", { bank: programme.bankName || t("distribution.mp.payer.bank", "Bank") })}</label>
                </span>
              </Field>
            ) : null}
            <div className="dist-premium-preview__action">
              <Button type="button" label={t("distribution.mp.computePremium", "Compute premium")} icon="pi pi-calculator" onClick={run} disabled={!valid} loading={busy} />
            </div>
          </div>
          {result ? (
            <div className={`dist-premium-preview__result${busy ? " is-busy" : ""}`} aria-busy={busy}>
              <KeyValueGrid columns={4} items={[
                { key: "gross", label: t("distribution.mp.gross", "Total"), value: result.grossPremium, type: "amount" },
                { key: "payer", label: t("distribution.mp.payerPays", "{{payer}} pays", { payer: payerLabel }), value: result.payer, type: "amount" },
                { key: "buyer", label: t("distribution.mp.buyerPays", "Buyer pays"), value: result.buyer, type: "amount" },
                { key: "terms", label: t("distribution.mp.whoPays", "Who pays"), value: <StatusChip label={terms(programme)} severity={result.payer > 0 ? "info" : "secondary"} /> },
              ]} />
              <DataTable value={rows} dataKey="code" size="small" className="dist-premium-preview__table mt-3" footerColumnGroup={footer}
                rowClassName={(l) => ({ "dist-premium-preview__subtotal": l.kind === "net" })}>
                <Column header={t("distribution.mp.line", "Cover / charge")} body={lineName} />
                <Column header={t("distribution.mp.lineBase", "On")} body={(l) => (l.base ? amount(l.base) : "")} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.mp.lineRate", "Rate")} body={(l) => rate(l.rate)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.mp.lineAmount", "Amount")} body={(l) => amount(l.amount)} className="bv-num" headerClassName="bv-num" />
                <Column header={result.payerType ? payerLabel : t("distribution.mp.payerShare", "Dealer / bank")} body={(l) => amount(l.payer)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.mp.buyerShare", "Buyer")} body={(l) => amount(l.buyer)} className="bv-num" headerClassName="bv-num" />
              </DataTable>
              <p className="dist-premium-preview__basis">{basisLine}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </DetailDialog>
  );
};

DealerPremiumPreview.propTypes = {
  /** the programme to price (as listed); null closes the pop-up */
  programme: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    code: PropTypes.string.isRequired,
    vehicleType: PropTypes.string,
    bankName: PropTypes.string,
    subsidyPayer: PropTypes.string,
    subsidyType: PropTypes.string,
    subsidyValue: PropTypes.number,
    freeFirstYear: PropTypes.bool,
  }),
  onHide: PropTypes.func.isRequired,
  toast: PropTypes.shape({ current: PropTypes.any }).isRequired,
};

DealerPremiumPreview.defaultProps = { programme: null };

export default DealerPremiumPreview;
