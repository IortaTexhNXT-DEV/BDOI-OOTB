import { useEffect, useState } from "react";
import quotationService from "../../../services/quotationService";

const NO_RATES = { valueAddedTax: 0, documentaryStampTax: 0, localGovernmentTax: 0 };

/** Tax rates (decimals) from GET /settings?group=tax; used when the product template has no tax set. */
const useTaxRates = () => {
  const [rates, setRates] = useState(NO_RATES);

  useEffect(() => {
    let active = true;
    quotationService
      .getTaxRates()
      .then((loaded) => active && setRates(loaded))
      .catch(() => active && setRates(NO_RATES));
    return () => {
      active = false;
    };
  }, []);

  return rates;
};

export default useTaxRates;
