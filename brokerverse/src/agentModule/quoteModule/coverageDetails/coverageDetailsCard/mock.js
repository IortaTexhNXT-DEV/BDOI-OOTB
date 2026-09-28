import { formatNumber } from "../../../../utility/currencyConverter";

// Amount options in the configured grouping (PHP: 100,000).
const amountOptions = (amounts) => amounts.map((a) => ({ label: formatNumber(a), value: formatNumber(a) }));

export const BodilyInjuryOptions = amountOptions([100000, 200000, 300000, 400000, 500000]);

export const PropertyDamageOptions = amountOptions([100000, 200000, 300000, 400000, 500000]);

export const AutopassengerpersonalAccidentOptions = amountOptions([10000, 20000, 30000, 40000, 50000]);
