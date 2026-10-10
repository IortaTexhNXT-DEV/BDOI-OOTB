import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import PageHeader from "../../components/PageHeader";
import LoadingBar from "../../components/LoadingBar";
import DetailDialog from "../../components/DetailDialog";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import featuresService from "../../services/featuresService";
import { StatusOf, TIERS, TierTag, dateOf, filterFeatures } from "./shared";
import "./featuresReleases.scss";

/**
 * Master > System Configuration > Features & Releases (TIS IT AppSupport / Admin, General Manager): the functions of
 * the platform with their release tier and status in this environment, read only. Enabling is done by the iorta
 * TechNXT platform administrator; the future releases are listed so that TISPH can ask for them.
 */
const FeatureCatalogue = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [tier, setTier] = useState(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);
  const loader = useCallback(() => featuresService.catalogue(), []);
  const { data, loading, refreshing, error } = useStableLoad(loader);
  const rows = useMemo(() => filterFeatures(data, { tier, search }), [data, tier, search]);
  const future = useMemo(() => (data || []).filter((r) => r.tier === "FUTURE"), [data]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      await featuresService.exportCatalogue();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("features.title"), detail: e.message });
    } finally {
      setExporting(false);
    }
  };

  const tierOptions = TIERS.map((code) => ({ label: t(`features.tiers.${code}`), value: code }));
  const name = (r) => (
    <span className="fr-name">
      <Button type="button" link label={r.name} className="fr-link" onClick={() => setOpen(r)} />
      {r.decisionPending ? <StatusChip label={t("features.decisionPending")} severity="warning" /> : null}
    </span>
  );

  return (
    <div className="admin__page fr-page">
      <Toast ref={toast} />
      <PageHeader title={t("features.title")} home={t("sidebar.Master")} section={t("sidebar.System Configuration")} trail={[t("features.title")]}
        help={t("features.help")}
        actions={<Button type="button" icon="pi pi-file-excel" label={t("features.export")} outlined loading={exporting} onClick={exportExcel} />} />
      <TabView className="fr-tabs">
        <TabPanel header={t("features.tabs.catalogue")}>
          <div className="bv-list-toolbar">
            <span className="p-input-icon-left bv-list-search">
              <i className="pi pi-search" />
              <InputText value={search} placeholder={t("features.search")} aria-label={t("features.search")} onChange={(e) => setSearch(e.target.value)} />
            </span>
            <Dropdown value={tier} options={tierOptions} onChange={(e) => setTier(e.value ?? null)} placeholder={t("features.allTiers")} showClear className="bv-list-filter"
              aria-label={t("features.columns.tier")} />
          </div>
          <div className="bv-loading-host">
            <LoadingBar active={refreshing} />
            <DataTable value={rows} dataKey="key" size="small" stripedRows loading={loading} paginator rows={25} rowsPerPageOptions={[25, 50, 100]}
              emptyMessage={error || t("features.empty")} className="fr-table" data-testid="feature-catalogue">
              <Column header={t("features.columns.feature")} body={name} style={{ minWidth: "16rem" }} />
              <Column field="module" header={t("features.columns.module")} />
              <Column header={t("features.columns.tier")} body={(r) => <TierTag t={t} tier={r.tier} />} />
              <Column header={t("features.columns.status")} body={(r) => <StatusOf t={t} status={r.status} />} />
              <Column header={t("features.columns.requirements")} body={(r) => (r.requirements || []).join(", ") || "-"} style={{ maxWidth: "18rem" }} />
              <Column header={t("features.columns.enabledOn")} body={(r) => dateOf(r.enabledAt)} />
              <Column header={t("features.columns.enabledBy")} body={(r) => r.enabledBy || "-"} />
              <Column header={t("features.columns.releaseRef")} body={(r) => r.releaseRef || "-"} />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("features.tabs.future", { count: future.length })}>
          <DataTable value={future} dataKey="key" size="small" stripedRows loading={loading} emptyMessage={t("features.empty")} className="fr-table" data-testid="future-releases">
            <Column header={t("features.columns.feature")} body={name} style={{ minWidth: "16rem" }} />
            <Column field="module" header={t("features.columns.module")} />
            <Column field="description" header={t("features.columns.description")} style={{ minWidth: "24rem" }} />
            <Column header={t("features.columns.status")} body={(r) => <StatusOf t={t} status={r.status} />} />
          </DataTable>
        </TabPanel>
      </TabView>
      <DetailDialog visible={!!open} onHide={() => setOpen(null)} header={open?.name} size="md">
        {open ? (
          <>
            <DetailSection title={t("features.detail.general")}>
              <KeyValueGrid columns={2} items={[
                { label: t("features.columns.module"), value: open.module },
                { label: t("features.columns.tier"), value: <TierTag t={t} tier={open.tier} /> },
                { label: t("features.columns.status"), value: <StatusOf t={t} status={open.status} /> },
                { label: t("features.columns.requirements"), value: (open.requirements || []).join(", ") },
                { label: t("features.columns.enabledOn"), value: open.enabledAt, type: "date" },
                { label: t("features.columns.enabledBy"), value: open.enabledBy },
                { label: t("features.columns.releaseRef"), value: open.releaseRef },
                { label: t("features.columns.description"), value: open.description, span: "full" },
              ]} />
            </DetailSection>
            {open.decision ? (
              <DetailSection title={t("features.detail.decision")}>
                <KeyValueGrid columns={2} items={[
                  { label: t("features.detail.question"), value: open.decision.question, span: "full" },
                  { label: t("features.detail.options"), value: (open.decision.options || []).join("; "), span: "full" },
                ]} />
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </DetailDialog>
    </div>
  );
};

export default FeatureCatalogue;
