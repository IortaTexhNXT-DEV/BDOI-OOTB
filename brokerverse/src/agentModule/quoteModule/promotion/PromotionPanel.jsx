import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import promotionService from "../../../services/promotionService";
import quotationService from "../../../services/quotationService";
import { hasPermission } from "../../../utils/canOpen";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailSection from "../../../components/DetailSection";
import DetailDialog from "../../../components/DetailDialog";
import KeyValueGrid from "../../../components/KeyValueGrid";
import FieldError from "../../../components/FieldError";

const CLOSED = ["ConvertedToPolicy", "Expired", "Rejected", "Dropped"];
const rate = (v) => (v === null || v === undefined ? null : `${Number(v)}%`);
const pct = (v) => (v === null || v === undefined ? null : `${Number(v).toFixed(2)}%`);

/**
 * The promotion of a motor quotation (TIS-BRD-PROD-15, FR-PRM-021 to 024): the promotions open to the brand-new vehicle,
 * applied or removed (the server prices the quotation again), the promotion rates, the discount measured against the
 * standard rates and the cap; a holder of write:promotion-rates lowers the Own Damage rate to the line minimum. On the
 * policy (readOnly) it shows the promotion the policy was issued with (FR-PRM-030).
 */
const PromotionPanel = ({ quotation, onChanged, readOnly }) => {
  const { t } = useTranslation();
  const [offers, setOffers] = useState(null);
  const [rateForm, setRateForm] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const promo = quotation?.promotion;
  const motor = String(quotation?.lob || quotation?.productType || "").toUpperCase() === "MOTOR";
  if (!quotation || (!promo && (readOnly || !motor))) return null;
  const editable = !readOnly && hasPermission("write:quotations") && !CLOSED.includes(quotation.quotationStatus);
  const id = quotation.quotationId;

  const save = async (promotion) => {
    setBusy(true);
    setError(null);
    try {
      await quotationService.updateQuotation(id, { promotion, version: quotation.version });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const find = async () => {
    setError(null);
    try {
      setOffers(await promotionService.open({ doc: quotation, insuranceCompanyId: quotation.insuranceCompanyId, leadId: quotation.leadId }));
    } catch (e) {
      notifyError(e.message);
    }
  };
  const apply = async (code) => {
    if (await save({ code })) {
      notifySuccess(t("quotePromotion.applied", { code }));
      setOffers(null);
      onChanged?.();
    }
  };
  const remove = async () => {
    const done = await openConfirm({
      title: t("quotePromotion.removeTitle"), severity: "danger", confirmLabel: t("quotePromotion.remove"),
      facts: [{ label: t("quotePromotion.promotion"), value: `${promo.code} v${promo.version}` }],
      onConfirm: () => quotationService.updateQuotation(id, { promotion: null, version: quotation.version }),
    });
    if (!done) return;
    notifySuccess(t("quotePromotion.removed"));
    onChanged?.();
  };
  const changeRate = async () => {
    setError(null);
    if (!reasons.length) {
      try {
        setReasons((await promotionService.choices()).rateChangeReasons || []);
      } catch (e) {
        notifyError(e.message);
      }
    }
    setRateForm({ odRate: promo.odRate, rateReason: null });
  };
  const saveRate = async () => {
    if (await save({ code: promo.code, odRate: rateForm.odRate, rateReason: rateForm.rateReason })) {
      notifySuccess(t("quotePromotion.rateChanged"));
      setRateForm(null);
      onChanged?.();
    }
  };

  const actions = editable ? (
    <div className="flex gap-2">
      {promo && promo.benefit === "rate" && hasPermission("write:promotion-rates")
        ? <Button label={t("quotePromotion.changeRate")} icon="pi pi-percentage" size="small" outlined onClick={changeRate} /> : null}
      {promo ? <Button label={t("quotePromotion.remove")} icon="pi pi-times" size="small" severity="danger" outlined onClick={remove} />
        : <Button label={t("quotePromotion.find")} icon="pi pi-tag" size="small" outlined onClick={find} />}
    </div>
  ) : null;

  return (
    <DetailSection className="mt-3" title={t("quotePromotion.title")} actions={actions}>
      {quotation.promotionNotice ? <Message severity="warn" text={quotation.promotionNotice} className="mb-2 w-full justify-content-start" /> : null}
      {promo ? (
        <KeyValueGrid columns={4} items={[
          { label: t("quotePromotion.promotion"), value: `${promo.code} v${promo.version}` },
          { label: t("quotePromotion.name"), value: promo.name },
          { label: t("quotePromotion.validUntil"), value: promo.validUntil, type: "date" },
          { label: t("quotePromotion.excess"), value: promo.excess, type: "amount", currency: quotation.currency },
          { label: t("quotePromotion.odRate"), value: rate(promo.odRate), hidden: promo.benefit !== "rate" },
          { label: t("quotePromotion.aonRate"), value: rate(promo.promoAon), hidden: promo.benefit !== "rate" },
          { label: t("quotePromotion.discountPct"), value: rate(promo.discountPct), hidden: promo.benefit !== "discount" },
          { label: t("quotePromotion.standardGross"), value: promo.standardGrossPremium, type: "amount", currency: quotation.currency },
          { label: t("quotePromotion.promoDiscount"), value: `${quotation.currency || "PHP"} ${Number(promo.promoDiscount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} (${pct(promo.promoDiscountPct)})` },
          { label: t("quotePromotion.totalDiscount"), value: pct(promo.totalDiscountPct) },
          { label: t("quotePromotion.cap"), value: `${pct(promo.cap?.minPct)} - ${pct(promo.cap?.maxPct)}` },
          { label: t("quotePromotion.rateChange"), value: promo.rateChange ? `${rate(promo.rateChange.from)} → ${rate(promo.rateChange.to)}, ${promo.rateChange.reason}` : null,
            hidden: !promo.rateChange, span: 2 },
        ]} />
      ) : null}
      {!promo && error ? <FieldError error={error} /> : null}
      <DetailDialog visible={Boolean(offers)} onHide={() => setOffers(null)} size="lg" header={t("quotePromotion.openTitle")}>
        {offers?.promotions?.length ? (
          <DataTable value={offers.promotions} dataKey="code" size="small">
            <Column header={t("quotePromotion.promotion")} body={(p) => `${p.code} v${p.version}`} />
            <Column field="name" header={t("quotePromotion.name")} />
            <Column header={t("quotePromotion.odRate")} body={(p) => rate(p.promoOd) || rate(p.discountPct)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("quotePromotion.aonRate")} body={(p) => rate(p.promoAon)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("quotePromotion.validUntil")} body={(p) => p.periodTo.split("-").reverse().join("/")} />
            <Column body={(p) => <Button label={t("quotePromotion.apply")} size="small" loading={busy} onClick={() => apply(p.code)} />} />
          </DataTable>
        ) : <Message severity="info" text={offers?.reason || t("quotePromotion.noneOpen")} className="w-full justify-content-start" />}
        {error ? <FieldError error={error} /> : null}
      </DetailDialog>
      <DetailDialog visible={Boolean(rateForm)} onHide={() => setRateForm(null)} size="md" header={t("quotePromotion.changeRate")}
        footer={(
          <div className="flex gap-2 justify-content-end">
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setRateForm(null)} />
            <Button label={t("quotePromotion.saveRate")} loading={busy} onClick={saveRate} />
          </div>
        )}>
        {rateForm ? (
          <div className="grid formgrid p-fluid">
            <div className="field col-12 md:col-6">
              <label htmlFor="qp-od">{t("quotePromotion.odRate")}</label>
              <InputNumber inputId="qp-od" value={rateForm.odRate} min={promo.minOd ?? 0} max={promo.promoOd} minFractionDigits={0} maxFractionDigits={4} suffix="%"
                onValueChange={(e) => setRateForm((f) => ({ ...f, odRate: e.value }))} />
              <small>{t("quotePromotion.rateRange", { min: rate(promo.minOd), max: rate(promo.promoOd) })}</small>
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="qp-reason">{t("quotePromotion.reason")}</label>
              <Dropdown inputId="qp-reason" value={rateForm.rateReason} options={reasons} onChange={(e) => setRateForm((f) => ({ ...f, rateReason: e.value }))} />
            </div>
            {error ? <div className="col-12"><FieldError error={error} /></div> : null}
          </div>
        ) : null}
      </DetailDialog>
    </DetailSection>
  );
};

PromotionPanel.propTypes = {
  /** the quotation, or the policy issued from it (readOnly) */
  quotation: PropTypes.object,
  onChanged: PropTypes.func,
  readOnly: PropTypes.bool,
};
PromotionPanel.defaultProps = { quotation: null, onChanged: null, readOnly: false };

export default PromotionPanel;
