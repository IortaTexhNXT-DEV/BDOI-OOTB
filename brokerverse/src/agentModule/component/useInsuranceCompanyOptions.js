import { useEffect, useState } from "react";
import quotationService from "../../services/quotationService";

/** Insurance companies from the master as { label, value } dropdown options. */
const useInsuranceCompanyOptions = () => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let active = true;
    quotationService
      .getInsuranceCompanyOptions()
      .then((rows) => active && setOptions(rows.map(({ label, value }) => ({ label, value }))))
      .catch(() => active && setOptions([]));
    return () => {
      active = false;
    };
  }, []);

  return options;
};

export default useInsuranceCompanyOptions;
