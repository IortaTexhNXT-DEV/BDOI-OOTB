import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import MasterRecordsPage from "./MasterRecordsPage";
import { reasonContextLabel } from "../../components/ReasonPicker/contexts";

/**
 * The operational masters: each screen is the generic master page with its type, title and the columns listed;
 * `extra(t)` adds page props (labels of select values, a filter).
 */
const page = (type, key, group, columns, extra) => {
  const Screen = () => {
    const { t } = useTranslation();
    const more = useMemo(() => (extra ? extra(t) : {}), [t]);
    return <MasterRecordsPage type={type} title={t(`opsAcc.masters.${key}.title`)} help={t(`opsAcc.masters.${key}.help`)} group={t(group)} section={t(`opsAcc.masters.${key}.section`)} columns={columns} {...more} />;
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
// lead sources and reason codes (Master > Insurance Management): the Source of a prospect; coded reasons of a declined
// or dropped quotation, a claim repudiation, a renewal lapse, a reassignment and the accounting decisions (period close
// and reopening, year-end reversal, CAS books, incentive batches), listed and filtered by what they are used for
export const LeadSources = page("lead-source", "leadSources", "opsAcc.master", ["code", "name", "channelType", "branchCode", "sortOrder"]);
export const ReasonCodes = page("reason-code", "reasonCodes", "opsAcc.master", ["code", "name", "context", "requiresNote", "sortOrder"],
  (t) => ({ optionLabels: { context: (value) => reasonContextLabel(t, value) }, filterBy: "context" }));
export const AssetClasses = page("asset-class", "assetClasses", "opsAcc.master", ["code", "name", "usefulLifeMonths", "assetAccount", "accumulatedAccount", "expenseAccount"]);
// cost centres stamped on journal lines (FGA.04); the one marked Default goes on lines that name none
export const CostCentres = page("cost-centre", "costCentres", "opsAcc.master", ["code", "name", "companyCode", "department", "responsiblePerson", "isDefault"]);
