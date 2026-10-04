import { useEffect, useState } from "react";
import accountingService from "../../../services/accountingService";

const toOption = (account) => ({
  label: `${account.name} (${account.code})`,
  value: account.code,
});

/** Open-item GL accounts (receivables / payables) as dropdown options. */
const useOpenItemAccounts = () => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let active = true;
    accountingService.getAccounts({ status: "active" }).then((response) => {
      if (!active) return;
      setOptions(
        (response.data || []).filter((a) => a.isOpenItem).map(toOption)
      );
    });
    return () => {
      active = false;
    };
  }, []);

  return options;
};

export default useOpenItemAccounts;
