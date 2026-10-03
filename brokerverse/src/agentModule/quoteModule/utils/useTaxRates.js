import { useEffect, useState } from "react";
import quotationService from "../../../services/quotationService";

const NO_RATES = { valueAddedTax: 0, documentaryStampTax: 0, localGovernmentTax: 0, fireServiceTax: 0 };

/**
 * Tax rates (decimals) of a line from the premium tax and charge engine (Master > Premium Taxes & LGU Rates), the
 * engine the server prices the quotation with.
 */
const useTaxRates = (line = "motor") => {
  const [rates, setRates] = useState(NO_RATES);

  useEffect(() => {
    let active = true;
    quotationService
      .getTaxRates(line)
      .then((loaded) => active && setRates(loaded))
      .catch(() => active && setRates(NO_RATES));
    return () => {
      active = false;
    };
  }, [line]);

  return rates;
};

export default useTaxRates;
