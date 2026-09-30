import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import packagesService from "../../services/packagesService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { CustomerPicker, PageHeader } from "../Placement/shared";
import { lguOptions, todayIso, usePackageOptions } from "./common";
import "../Placement/index.scss";
import "./index.scss";

/**
 * Sales & Marketing > Quick Quote > Compare Insurers: a package product priced by every insurer with a rate table, side
 * by side (premium, taxes and charges, total, deductible, key benefits). The commission is shown to staff only when
 * asked and is never printed. The client copy is a PDF on the company letterhead; choosing an insurer creates the
 * quotation for the prospect or client.
 */
const CompareInsurers = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.compare.${key}`, opts);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { formatCurrency } = useFormatCurrency();
  const options = usePackageOptions({ packageOnly: true });
  const [form, setForm] = useState({ productId: state?.productId || null, sumInsured: null, lguCode: null, date: todayIso() });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCommission, setShowCommission] = useState(false);
  const [selected, setSelected] = useState([]);
  const [proceed, setProceed] = useState(null);
  const [customer, setCustomer] = useState({ kind: "lead" });
  const [preparedFor, setPreparedFor] = useState("");

  const request = () => ({ productId: form.productId, sumInsured: form.sumInsured, lguCode: form.lguCode || undefined, date: form.date || undefined });
  const run = async () => {
    if (!form.productId || !(form.sumInsured > 0)) {
      notifyError(k("needProduct"));
      return;
    }
    setLoading(true);
    try {
      const r = await packagesService.compare(request());
      setResult(r);
      setSelected(r.columns.map((c) => c.insuranceCompanyId));
    } catch (e) {
      notifyError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const print = () => packagesService.printComparison({ ...request(), selected, preparedFor: preparedFor || undefined }).catch((e) => notifyError(e.message));
  const createQuote = async () => {
    const id = customer?.selected?.id;
    if (!id) {
      notifyError(k("chooseCustomer"));
      return;
    }
    try {
      const q = await packagesService.quotationFromComparison({ ...request(), insuranceCompanyId: proceed.insuranceCompanyId, insurersCompared: result.columns.length,
        ...(customer.kind === "lead" ? { leadRefId: id } : { clientId: id }) });
      notifySuccess(k("quoteCreated", { number: q.quotationNumber }));
      navigate(`/agent/quotedetailview/${q.quotationId}`);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const cols = result?.columns || [];
  const vatLabel = result?.product?.taxRegime === "premium_tax" ? k("premiumTax") : k("vat");
  const rows = useMemo(() => [
    [k("premium"), (c) => formatCurrency(c.premium), true],
    [vatLabel, (c) => formatCurrency(c.vat + c.premiumTax)],
    [k("dst"), (c) => formatCurrency(c.dst)],
    [k("fst"), (c) => formatCurrency(c.fst)],
    [k("lgt"), (c) => formatCurrency(c.lgt)],
    [k("other"), (c) => formatCurrency(c.otherCharges)],
    [k("total"), (c) => <strong>{formatCurrency(c.total)}</strong>, true],
    [k("deductible"), (c) => c.deductible || "-"],
  ], [vatLabel, formatCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="placement-page pkg-page">
      <PageHeader title={k("title")} subtitle={k("subtitle")} onBack={() => navigate("/sales/quick-quote")} />
      <div className="placement-card">
        <div className="grid">
          <div className="col-12 md:col-4">
            <label htmlFor="cmp-product">{k("product")}</label>
            <Dropdown inputId="cmp-product" value={form.productId} options={options.products.map((p) => ({ label: p.name, value: p.id }))} filter onChange={(e) => setForm({ ...form, productId: e.value })} className="w-full" placeholder={k("chooseProduct")} />
          </div>
          <div className="col-12 md:col-3">
            <label htmlFor="cmp-si">{k("sumInsured")}</label>
            <InputNumber inputId="cmp-si" value={form.sumInsured} onValueChange={(e) => setForm({ ...form, sumInsured: e.value })} min={0} maxFractionDigits={2} className="w-full" inputClassName="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label htmlFor="cmp-lgu">{k("location")}</label>
            <Dropdown inputId="cmp-lgu" value={form.lguCode} options={lguOptions(options.lgus)} filter showClear onChange={(e) => setForm({ ...form, lguCode: e.value })} className="w-full" placeholder={k("anyLocation")} />
          </div>
          <div className="col-12 md:col-2">
            <label htmlFor="cmp-date">{k("date")}</label>
            <InputText id="cmp-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" />
          </div>
        </div>
        <div className="pkg-actions">
          <Button label={k("compare")} icon="pi pi-table" loading={loading} onClick={run} />
        </div>
      </div>

      {result && (
        <div className="placement-card">
          <div className="pkg-toolbar">
            <span className="muted">{k("summary", { count: cols.length, product: result.product.name, sumInsured: formatCurrency(result.sumInsured) })}{result.lgu ? ` / ${result.lgu.name}` : ""}</span>
            <span className="pkg-spacer" />
            <label htmlFor="cmp-comm" className="pkg-inline">{k("showCommission")}</label>
            <InputSwitch inputId="cmp-comm" checked={showCommission} onChange={(e) => setShowCommission(e.value)} />
            <InputText value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)} placeholder={k("preparedFor")} aria-label={k("preparedFor")} />
            <Button label={k("print")} icon="pi pi-print" outlined disabled={!selected.length} onClick={print} />
          </div>
          {!cols.length ? <p className="muted">{k("noRates")}</p> : (
            <div className="table-scroll">
              <table className="pkg-table pkg-matrix">
                <thead>
                  <tr>
                    <th />
                    {cols.map((c) => (
                      <th key={c.insuranceCompanyId} className="num">
                        <div className="pkg-matrix-head">
                          <Checkbox checked={selected.includes(c.insuranceCompanyId)} aria-label={k("includeInPrint", { insurer: c.insurerName })}
                            onChange={(e) => setSelected(e.checked ? [...selected, c.insuranceCompanyId] : selected.filter((x) => x !== c.insuranceCompanyId))} />
                          <span>{c.insurerName}</span>
                          {c.insuranceCompanyId === result.cheapestId && <Tag value={k("cheapest")} severity="success" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, cell, strong]) => (
                    <tr key={label} className={strong ? "strong" : ""}><td>{label}</td>{cols.map((c) => <td key={c.insuranceCompanyId} className="num">{cell(c)}</td>)}</tr>
                  ))}
                  <tr>
                    <td>{k("benefits")}</td>
                    {cols.map((c) => <td key={c.insuranceCompanyId}><ul className="pkg-benefits">{(c.keyBenefits || []).map((b) => <li key={b}>{b}</li>)}</ul></td>)}
                  </tr>
                  {showCommission && (
                    <tr className="pkg-staff">
                      <td>{k("commission")}</td>
                      {cols.map((c) => <td key={c.insuranceCompanyId} className="num">{`${Math.round(c.commissionRate * 10000) / 100}%`} / {formatCurrency(c.commissionAmount)}</td>)}
                    </tr>
                  )}
                  <tr>
                    <td />
                    {cols.map((c) => <td key={c.insuranceCompanyId} className="num"><Button label={k("proceed")} icon="pi pi-arrow-right" size="small" onClick={() => setProceed(c)} /></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog header={k("proceedTitle", { insurer: proceed?.insurerName })} visible={Boolean(proceed)} onHide={() => setProceed(null)} style={{ width: "36rem" }} breakpoints={{ "640px": "95vw" }}
        footer={<><Button label={t("common.cancel")} text onClick={() => setProceed(null)} /><Button label={k("createQuote")} icon="pi pi-check" onClick={createQuote} /></>}>
        <p>{k("proceedHelp", { total: proceed ? formatCurrency(proceed.total) : "" })}</p>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </Dialog>
    </div>
  );
};

export default CompareInsurers;
