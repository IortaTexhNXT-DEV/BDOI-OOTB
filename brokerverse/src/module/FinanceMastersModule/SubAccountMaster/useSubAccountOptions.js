import useMasterOptions from "../../GeneralMasters/common/useMasterOptions";

const codeAndName = (options) =>
  options.map((option) => ({ ...option, label: `${option.code} - ${option.label}`, name: option.code }));

/** Main account and currency dropdown options (value = code) for the Sub Account forms. */
const useSubAccountOptions = () => ({
  mainAccounts: codeAndName(useMasterOptions("main-account", { valueKey: "code" })),
  currencies: codeAndName(useMasterOptions("currency", { valueKey: "code" })),
});

export default useSubAccountOptions;
