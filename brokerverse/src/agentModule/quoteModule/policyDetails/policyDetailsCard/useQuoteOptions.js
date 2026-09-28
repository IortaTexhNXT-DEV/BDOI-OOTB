import { useEffect, useMemo, useState } from "react";
import quotationService from "../../../../services/quotationService";
import {
  modelYearOptions as buildModelYears,
  vehicleColourLabel,
  vehicleColourOptions,
} from "../../../../utility/quoteOptions";

/** The motor product whose policy types the quote wizard offers (product master code). */
const MOTOR_PRODUCT = "MOTOR";

const useRows = (load, deps) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let active = true;
    const request = load();
    if (!request) {
      setRows([]);
      return undefined;
    }
    request
      .then((data) => active && setRows(Array.isArray(data) ? data : []))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
};

/** Keeps a saved value selectable (and visible) when it is no longer in the master, e.g. on an older quote. */
const withCurrent = (options, value, label = value) =>
  value && !options.some((o) => o.value === value) ? [...options, { label, value }] : options;

/**
 * Options for Create Quote page 1 from the masters and configuration: policy types (policy type master of the
 * motor product), account codes (referrers), vehicle brand -> model -> variant cascade, model years
 * (next year down to the configured span) and vehicle colours (configuration).
 */
const useQuoteOptions = ({ brand, model, current = {} }) => {
  const policyTypes = useRows(() => quotationService.getPolicyTypes(MOTOR_PRODUCT), []);
  const accountCodes = useRows(() => quotationService.getAccountCodes(), []);
  const brands = useRows(() => quotationService.getVehicleBrands(), []);
  const models = useRows(() => (brand ? quotationService.getVehicleModels(brand) : null), [brand]);
  const variants = useRows(() => (model ? quotationService.getVehicleVariants(model) : null), [model]);

  return useMemo(
    () => ({
      policyTypeOptions: withCurrent(
        policyTypes.map((p) => ({ label: p.name, value: p.code })),
        current.InsurancePolicyType
      ),
      accountCodeOptions: withCurrent(
        accountCodes.map((a) => ({ label: a.label, value: a.value })),
        current.AccountCode
      ),
      brandOptions: withCurrent(
        brands.map((b) => ({ label: b.name, value: b.name })),
        current.VehicleBrand
      ),
      modelOptions: withCurrent(
        models.map((m) => ({ label: m.name, value: m.name })),
        current.VehicleModel
      ),
      variantOptions: withCurrent(
        variants.map((v) => ({ label: v.name, value: v.name, seatingCapacity: v.seatingCapacity })),
        current.ModelVariant
      ),
      modelYearOptions: withCurrent(buildModelYears(), current.ModelYear ? String(current.ModelYear) : ""),
      colourOptions: withCurrent(
        vehicleColourOptions(),
        current.VehicleColor,
        vehicleColourLabel(current.VehicleColor)
      ),
    }),
    [
      policyTypes,
      accountCodes,
      brands,
      models,
      variants,
      current.InsurancePolicyType,
      current.AccountCode,
      current.VehicleBrand,
      current.VehicleModel,
      current.ModelVariant,
      current.ModelYear,
      current.VehicleColor,
    ]
  );
};

export default useQuoteOptions;
