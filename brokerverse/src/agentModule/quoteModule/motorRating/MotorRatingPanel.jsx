import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import quotationService from "../../../services/quotationService";
import { hasPermission } from "../../../utils/canOpen";
import { HelpTip } from "../../../components/PageHeader";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import ReasonPicker, { reasonPayload } from "../../../components/ReasonPicker";

const n = (v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/,/g, "")));
const same = (a, b) => a !== null && b !== null && Math.abs(a - b) < 0.00005;

/**
 * Market value and rates of a Motor quotation (TIS-BRD-PROD-12): the reference value, the depreciation, the FMV the
 * system works out and the default Own Damage / Acts of Nature issuing rates (POST /quotations/motor-rating). The FMV
 * and the rates are read only unless the user holds override:motor-fmv / override:quotation-rates; a change asks for
 * its reason. onChange receives { fmv, odRate, aonRate, fmvRating, rateOverride } whenever the terms change.
 */
const MotorRatingPanel = ({ draft, values, onChange }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(null);
  const [depreciation, setDepreciation] = useState(null);
  const [fmvReason, setFmvReason] = useState(null);
  const [rateReason, setRateReason] = useState(null);
  const [error, setError] = useState(null);
  const canFmv = hasPermission("override:motor-fmv");
  const canRates = hasPermission("override:quotation-rates");
  const key = JSON.stringify({ ...draft, depreciation });

  useEffect(() => {
    let live = true;
    const body = { ...draft, ...(depreciation !== null ? { fmvRating: { ...(draft.fmvRating || {}), depreciationPct: depreciation } } : {}) };
    quotationService.motorRating(body).then((r) => {
      if (!live) return;
      setRating(r);
      setError(null);
      const next = { ...values };
      if (r.fmv && n(values.fmv) === null) next.fmv = r.fmv.computedFmv;
      if (n(values.odRate) === null) next.odRate = r.rates.OD;
      if (n(values.aonRate) === null) next.aonRate = r.rates.AON;
      if (next.fmv !== values.fmv || next.odRate !== values.odRate || next.aonRate !== values.aonRate) onChange(terms(next, r));
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!rating && !error) return null;
  const fmvChanged = !!rating?.fmv && n(values.fmv) !== null && !same(n(values.fmv), rating.fmv.computedFmv) && !same(n(values.fmv), rating.fmv.referenceValue);
  const ratesChanged = !!rating && ["OD", "AON"].some((p) => {
    const v = n(p === "OD" ? values.odRate : values.aonRate);
    return v !== null && !same(v, rating.rates[p]);
  });
  const below = rating?.minimumRates?.OD && n(values.odRate) !== null && n(values.odRate) < rating.minimumRates.OD;

  function terms(v, r = rating, fr = fmvReason, rr = rateReason) {
    const fr2 = fr ? reasonPayload(fr) : {};
    const rr2 = rr ? reasonPayload(rr) : {};
    return {
      ...v,
      fmvRating: r?.fmv ? { referenceValue: r.fmv.referenceValue, referenceBasis: r.fmv.referenceBasis, depreciationPct: r.fmv.depreciationPct,
        ...(fr2.reasonCode ? { reasonCode: fr2.reasonCode, reason: fr2.note } : {}) } : undefined,
      rateOverride: rr2.reasonCode ? { reasonCode: rr2.reasonCode, reason: rr2.note } : undefined,
    };
  }
  const set = (patch) => onChange(terms({ ...values, ...patch }));

  return (
    <div className="bv-motor-rating mt-3 mb-3" data-testid="motor-rating">
      <div className="flex align-items-center gap-2 mb-2">
        <span className="coverage__details__card__container__sub__title">{t("motorRating.title")}</span>
        <HelpTip text={t("motorRating.help")} label={t("motorRating.title")} />
        {rating && <StatusChip label={t(`motorRating.source.${rating.rates.source}`)} severity="info" />}
      </div>
      {error && <Message severity="error" text={error} />}
      {rating && (
        <>
          <KeyValueGrid items={[
            ...(rating.fmv ? [
              { label: t("motorRating.referenceValue"), value: rating.fmv.referenceValue, type: "amount" },
              { label: t("motorRating.basis"), value: t(`motorRating.basisLabel.${rating.fmv.referenceBasis}`) },
              { label: t("motorRating.computedFmv"), value: rating.fmv.computedFmv, type: "amount" },
            ] : []),
            { label: t("motorRating.defaultOd"), value: rating.rates.OD, type: "percent" },
            { label: t("motorRating.defaultAon"), value: rating.rates.AON, type: "percent" },
            ...(rating.excess?.amount ? [{ label: t("motorRating.excess"), value: rating.excess.amount, type: "amount" }] : []),
          ]} />
          <div className="grid m-0 mt-2">
            {rating.fmv && (
              <div className="col-12 md:col-4">
                <label htmlFor="mr-depreciation" className="block mb-1">{t("motorRating.depreciation")}</label>
                <Dropdown inputId="mr-depreciation" value={rating.fmv.depreciationPct} className="w-full"
                  options={[...new Set([...(rating.fmv.depreciationPct === 0 ? [0] : []), ...rating.depreciationOptions])].map((o) => ({ label: `${o}%`, value: o }))}
                  onChange={(e) => { setDepreciation(e.value); onChange(terms({ ...values, fmv: null })); }} />
              </div>
            )}
            <div className="col-12 md:col-4">
              <label htmlFor="mr-fmv" className="block mb-1">{t("motorRating.fmv")}</label>
              <InputNumber inputId="mr-fmv" value={n(values.fmv)} disabled={!canFmv} minFractionDigits={2} maxFractionDigits={2} className="w-full"
                onValueChange={(e) => set({ fmv: e.value })} />
            </div>
            <div className="col-12 md:col-2">
              <label htmlFor="mr-od" className="block mb-1">{t("motorRating.odRate")}</label>
              <InputNumber inputId="mr-od" value={n(values.odRate)} disabled={!canRates} minFractionDigits={0} maxFractionDigits={4} suffix="%" className="w-full"
                onValueChange={(e) => set({ odRate: e.value })} />
            </div>
            <div className="col-12 md:col-2">
              <label htmlFor="mr-aon" className="block mb-1">{t("motorRating.aonRate")}</label>
              <InputNumber inputId="mr-aon" value={n(values.aonRate)} disabled={!canRates} minFractionDigits={0} maxFractionDigits={4} suffix="%" className="w-full"
                onValueChange={(e) => set({ aonRate: e.value })} />
            </div>
          </div>
          {fmvChanged && (
            <ReasonPicker context="fmv_edit" value={fmvReason} label={t("motorRating.fmvReason")} showErrors
              onChange={(v) => { setFmvReason(v); onChange(terms(values, rating, v, rateReason)); }} />
          )}
          {ratesChanged && (
            <ReasonPicker context="rate_override" value={rateReason} label={t("motorRating.rateReason")} showErrors
              onChange={(v) => { setRateReason(v); onChange(terms(values, rating, fmvReason, v)); }} />
          )}
          {below && <Message severity="warn" className="mt-2" text={t("motorRating.belowMinimum", { rate: rating.minimumRates.OD })} />}
        </>
      )}
    </div>
  );
};

MotorRatingPanel.propTypes = {
  draft: PropTypes.object.isRequired,
  values: PropTypes.shape({ fmv: PropTypes.any, odRate: PropTypes.any, aonRate: PropTypes.any }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MotorRatingPanel;
