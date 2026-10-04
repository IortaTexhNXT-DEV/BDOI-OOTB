import React from "react";
import { useTranslation } from "react-i18next";
import MasterRecordsPage from "./MasterRecordsPage";

/** The operational masters: each screen is the generic master page with its type, title and the columns listed. */
const page = (type, key, group, columns) => {
  const Screen = () => {
    const { t } = useTranslation();
    return <MasterRecordsPage type={type} title={t(`opsAcc.masters.${key}.title`)} intro={t(`opsAcc.masters.${key}.intro`)} group={t(group)} section={t(`opsAcc.masters.${key}.section`)} columns={columns} />;
  };
  Screen.displayName = `Master_${key}`;
  return Screen;
};

export const ShortPeriodRates = page("short-period-rate", "shortPeriod", "opsAcc.master", ["code", "maxDays", "retainedPercent", "description"]);
export const CancellationReasons = page("cancellation-reason", "cancellationReasons", "opsAcc.master", ["code", "name", "initiatedBy", "method"]);
export const ClaimDocumentChecklist = page("claim-document-requirement", "claimChecklist", "opsAcc.master", ["code", "lineOfBusiness", "claimType", "documentName", "required", "sortOrder"]);
export const RepairShops = page("repair-shop", "repairShops", "opsAcc.master", ["code", "name", "city", "contactPerson", "phone", "accredited"]);
export const Suppliers = page("supplier", "suppliers", "opsAcc.accounts", ["code", "name", "tin", "vatRegistered", "ewtCode", "paymentTermsDays", "expenseAccount"]);
// sales activities (Master > Organization): the activity types and outcomes account executives choose when they log
export const SalesActivityTypes = page("sales-activity-type", "salesActivityTypes", "opsAcc.master", ["code", "name", "channel", "followUpDays", "sortOrder"]);
export const SalesActivityOutcomes = page("sales-activity-outcome", "salesActivityOutcomes", "opsAcc.master", ["code", "name", "result", "sortOrder"]);
export const AssetClasses = page("asset-class", "assetClasses", "opsAcc.master", ["code", "name", "usefulLifeMonths", "assetAccount", "accumulatedAccount", "expenseAccount"]);
