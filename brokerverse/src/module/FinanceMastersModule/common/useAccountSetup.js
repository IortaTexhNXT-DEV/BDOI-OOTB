import { useCallback, useEffect, useState } from "react";
import mastersService from "../../../services/mastersService";
import useMasterOptions from "../../GeneralMasters/common/useMasterOptions";

import { formatDate as formatAppDate } from "../../../utility/dateFormat";
const TYPE = "account-setup";
const byCode = { valueKey: "code" };
const toDate = (value) => (value ? new Date(value) : null);

/** Master-backed dropdown options shared by the four Account Setup screens (values are codes). */
export const useAccountSetupOptions = () => ({
  companyOptions: useMasterOptions("company", byCode),
  officeOptions: useMasterOptions("branch", byCode),
  departmentOptions: useMasterOptions("department", byCode),
  productCodeOptions: useMasterOptions("product", byCode),
  coverOptions: useMasterOptions("cover", byCode),
  mainAccountOptions: useMasterOptions("main-account", byCode),
  subAccountOptions: useMasterOptions("sub-account", byCode),
});

/**
 * Loads and saves one account setup record (/masters/account-setup, keyed by setupCode). The screen's form
 * fields are kept in `accounts`; the validity dates map to effectiveFrom / effectiveTo.
 */
const useAccountSetup = (setupCode, setupName, setFormData) => {
  const [recordId, setRecordId] = useState(null);

  const applyRecord = useCallback(
    (record) => {
      if (!record) return;
      setRecordId(record.id);
      setFormData((prev) => ({
        ...prev,
        ...(record.accounts || {}),
        effectiveFromDate: toDate(record.effectiveFrom) || prev.effectiveFromDate,
        effectiveToDate: toDate(record.effectiveTo) || prev.effectiveToDate,
        modifiedBy: record.updatedBy || record.createdBy || prev.modifiedBy,
        modifiedOn: record.updatedAt ? formatAppDate(record.updatedAt, { withTime: true }) : prev.modifiedOn,
      }));
    },
    [setFormData]
  );

  useEffect(() => {
    mastersService
      .list(TYPE, { setupCode })
      .then((rows) => applyRecord(rows.find((row) => row.setupCode === setupCode)))
      .catch(() => undefined);
  }, [setupCode, applyRecord]);

  const save = async (formData) => {
    const { effectiveFromDate, effectiveToDate, modifiedBy, modifiedOn, ...accounts } = formData;
    const record = { setupCode, setupName, effectiveFrom: effectiveFromDate, effectiveTo: effectiveToDate, accounts };
    const saved = recordId ? await mastersService.update(TYPE, recordId, record) : await mastersService.create(TYPE, record);
    applyRecord(saved);
    return saved;
  };

  return { save };
};

export default useAccountSetup;
