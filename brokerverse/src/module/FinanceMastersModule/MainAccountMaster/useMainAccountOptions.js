import useMasterOptions, { useFieldOptions } from "../../GeneralMasters/common/useMasterOptions";

const withName = (options) => options.map((option) => ({ ...option, name: option.label }));

/** Dropdown options of the Main Account add / edit forms, loaded from the masters API. */
const useMainAccountOptions = () => {
  const accountTypes = useFieldOptions("main-account", "accountType");
  const categories = useMasterOptions("account-category", { valueKey: "code" });
  const companies = useMasterOptions("company", { valueKey: "code" });
  const currencies = useMasterOptions("currency", { valueKey: "code" });
  return {
    accountTypes,
    categories,
    companies: withName(companies),
    currencies: withName(currencies.map((option) => ({ ...option, label: `${option.code} - ${option.label}` }))),
  };
};

export default useMainAccountOptions;
