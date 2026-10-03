import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { TabView, TabPanel } from "primereact/tabview";
import leadService from "../../../services/leadService";
import { getLeadByIdMiddleware, deleteLeadMiddleware } from "../Store/leadMiddleware";
import { isFireLob, isIarLob } from "../../endorsementModule/constants/endorsementCategories";
import { formatDate } from "../../../utility/dateFormat";
import useMasterOptions from "../../../module/GeneralMasters/common/useMasterOptions";
import { useListState, useServerList } from "../../../hooks/useServerList";
import { statusLabel, statusSeverity } from "../../../utils/statusSeverity";
import logger from "../../../utility/logger";

const LOBS = [
  { lob: "MOTOR", labelKey: "dashboard.Motor", fallback: "Motor" },
  { lob: "FIRE", labelKey: "dashboard.Fire and Allied Perils", fallback: "Fire and Allied Perils" },
  { lob: "IAR", labelKey: "dashboard.Industrial All Risks", fallback: "Industrial All Risks" },
];

const LEAD_STATUS_KEYS = {
  New: "new", Contacted: "contacted", Qualified: "qualified", QuoteGenerated: "quoteGenerated", Converted: "converted", Lost: "lost",
  Draft: "draft", PendingCustomer: "pendingCustomer", CustomerAccepted: "customerAccepted", SubmittedToInsurer: "submittedToInsurer",
  Approved: "approved", ConvertedToPolicy: "convertedToPolicy", Rejected: "rejected", Dropped: "dropped",
};

const INITIAL = { tab: 0, search: "", leadCategory: "", country: "", province: "", city: "", showFilters: false };

/**
 * Sales > Prospects list: one table per product line (Motor, Fire, IAR), paged, searched and filtered by the server.
 * The search, filters, tab and page are kept while the user opens a prospect and comes back.
 */
const ProspectTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useRef(null);
  const [state, patch] = useListState("prospects", INITIAL);
  const lob = LOBS[state.tab]?.lob || "MOTOR";

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await leadService.getAllLeads({
      page, pageSize, lob,
      query: state.search.trim() || undefined,
      leadCategory: state.leadCategory || undefined,
      country: state.country || undefined,
      province: state.province || undefined,
      city: state.city || undefined,
    });
    if (!res.success) throw new Error(res.error);
    return { rows: res.data, total: res.total };
  }, [lob, state.search, state.leadCategory, state.country, state.province, state.city]);
  const list = useServerList(fetchPage, { key: "prospects" });

  const countryMaster = useMasterOptions("country");
  const stateMaster = useMasterOptions("state");
  const cityMaster = useMasterOptions("city");
  const categoryOptions = [
    { label: t("leads.allCategories"), value: "" },
    { label: t("leads.individual"), value: "Retail" },
    { label: t("leads.company"), value: "Corporate" },
  ];
  const withAll = (label, rows) => [{ label, value: "" }, ...rows.map((r) => ({ label: r.label, value: r.value }))];
  const activeFilters = ["leadCategory", "country", "province", "city"].filter((k) => state[k]).length;

  const openLead = async (lead, edit) => {
    const leadId = lead.leadId || lead.id;
    try {
      await dispatch(getLeadByIdMiddleware(leadId));
    } catch (error) {
      logger.error("Error fetching prospect:", error);
    }
    if (!edit) return navigate(`/agent/leaddetail/${leadId}`);
    if (isIarLob(lob)) return navigate("/agent/createlead/iar", { state: { leadRefId: leadId, leadId, isEdit: true } });
    if (isFireLob(lob)) return navigate("/agent/createlead/fire-allied-perils", { state: { leadId, isEdit: true } });
    return navigate(`/agent/leadedit/${leadId}`);
  };

  const removeLead = (lead) => {
    const leadId = lead.leadId || lead.id;
    confirmDialog({
      message: t("leads.deleteConfirmMessage", { name: lead.fullName || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || lead.generatedLeadId }),
      header: t("leads.confirmation"),
      icon: "pi pi-exclamation-triangle",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          await dispatch(deleteLeadMiddleware(leadId)).unwrap();
          toast.current?.show({ severity: "success", summary: t("common.success"), detail: t("leads.leadDeletedSuccess"), life: 3000 });
          list.reload();
        } catch {
          toast.current?.show({ severity: "error", summary: t("common.error"), detail: t("leads.failedToDeleteLead"), life: 4000 });
        }
      },
    });
  };

  const nameOf = (r) => r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || r.companyName || "-";
  const statusOf = (r) => (r.status ? <Tag value={LEAD_STATUS_KEYS[r.status] ? t(`leads.${LEAD_STATUS_KEYS[r.status]}`) : statusLabel(r.status)} severity={statusSeverity(r.status)} /> : null);
  const actions = (r) => (
    <div className="flex gap-1 justify-content-end">
      <Button icon="pi pi-eye" text rounded size="small" aria-label={t("leads.view")} tooltip={t("leads.view")} tooltipOptions={{ position: "top" }} onClick={(e) => { e.stopPropagation(); openLead(r, false); }} />
      <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("leads.edit")} tooltip={t("leads.edit")} tooltipOptions={{ position: "top" }} onClick={(e) => { e.stopPropagation(); openLead(r, true); }} />
      <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("leads.delete")} tooltip={t("leads.delete")} tooltipOptions={{ position: "top" }} onClick={(e) => { e.stopPropagation(); removeLead(r); }} />
    </div>
  );
  const lobLabel = (r) => r.productType || t(LOBS.find((l) => l.lob === r.lob)?.labelKey || "", { defaultValue: LOBS.find((l) => l.lob === r.lob)?.fallback || r.lob || "-" });

  const table = (
    <DataTable {...list.tableProps} scrollable dataKey="leadId" size="small" stripedRows className="prospect-table" emptyMessage={list.error ? t("listCommon.loadFailed", { message: list.error }) : t("leads.noLeadsFound")}
      onRowClick={(e) => navigate(`/agent/quotelisting?leadRefId=${e.data.leadId}`)} rowClassName={() => "cursor-pointer"}>
      <Column header={t("leads.col.prospectId")} body={(r) => <span className="nowrap">{r.generatedLeadId || r.leadNumber || "-"}</span>} />
      <Column header={t("leads.col.name")} body={nameOf} style={{ minWidth: "11rem" }} />
      <Column header={t("leads.col.category")} body={(r) => r.leadCategory || "-"} />
      <Column header={t("leads.col.productLine")} body={lobLabel} />
      <Column header={t("leads.col.mobile")} body={(r) => <span className="nowrap">{r.mobileNumber || r.contactNumber || "-"}</span>} />
      <Column header={t("leads.col.email")} body={(r) => <span className="bv-break">{r.email || r.emailId || "-"}</span>} style={{ minWidth: "11rem" }} />
      <Column header={t("leads.col.quotations")} body={(r) => r.quotationsCount || 0} />
      <Column header={t("leads.col.createdOn")} body={(r) => formatDate(r.createdAt, { empty: "-" })} />
      <Column header={t("leads.col.status")} body={statusOf} />
      <Column header={t("leads.col.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
    </DataTable>
  );

  return (
    <div className="lead__listing__card__container mt-3">
      <Toast ref={toast} />
      <ConfirmDialog />
      <div className="prospect-list-card">
        <TabView className="bv-tabbar" activeIndex={state.tab} onTabChange={(e) => patch({ tab: e.index })}>
          {LOBS.map((l) => <TabPanel key={l.lob} header={t(l.labelKey, { defaultValue: l.fallback })} />)}
        </TabView>
        <div className="prospect-toolbar">
          <span className="p-input-icon-left prospect-search">
            <i className="pi pi-search" />
            <InputText value={state.search} onChange={(e) => patch({ search: e.target.value })} placeholder={t("leads.searchByNameLeadId")} aria-label={t("leads.searchByNameLeadId")} />
          </span>
          <Dropdown value={state.leadCategory} options={categoryOptions} onChange={(e) => patch({ leadCategory: e.value })} aria-label={t("leads.filterCategory")} className="prospect-filter" />
          <Button label={state.showFilters ? t("leads.hideFilters") : t("leads.showFilters")} icon="pi pi-filter" outlined badge={activeFilters ? String(activeFilters) : undefined}
            onClick={() => patch({ showFilters: !state.showFilters })} />
          {activeFilters > 0 && <Button label={t("leads.clearFilters")} icon="pi pi-times" text onClick={() => patch({ leadCategory: "", country: "", province: "", city: "" })} />}
        </div>
        {state.showFilters && (
          <div className="prospect-filters">
            <Dropdown value={state.country} options={withAll(t("leads.allCountries"), countryMaster)} onChange={(e) => patch({ country: e.value })} filter aria-label={t("leads.filterCountry")} />
            <Dropdown value={state.province} options={withAll(t("leads.allProvinces"), stateMaster)} onChange={(e) => patch({ province: e.value })} filter aria-label={t("leads.filterProvince")} />
            <Dropdown value={state.city} options={withAll(t("leads.allCities"), cityMaster)} onChange={(e) => patch({ city: e.value })} filter aria-label={t("leads.filterCity")} />
          </div>
        )}
        {table}
      </div>
    </div>
  );
};

export default ProspectTable;
