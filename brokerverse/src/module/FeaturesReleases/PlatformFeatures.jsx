import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import PageHeader from "../../components/PageHeader";
import { ListCell } from "../../components/TableCells";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import KeyValueGrid from "../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import featuresService from "../../services/featuresService";
import { formatDate } from "../../utility/dateFormat";
import ChangeDialog from "./ChangeDialog";
import ChangesTable from "./ChangesTable";
import { StatusOf, TIERS, TierTag, filterFeatures } from "./shared";
import "./featuresReleases.scss";

const TABS = ["features", "changes", "admins"];

/**
 * Master > Platform > Features & Releases (iorta TechNXT platform administrator only): every feature with its tier,
 * state and dependencies; enabling and disabling features or a tier bundle with an impact preview; the change requests
 * with maker-checker between two platform administrators; promotion between environments; the platform administrators.
 */
const PlatformFeatures = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileInput = useRef(null);
  const [params, setParams] = useSearchParams();
  const tab = Math.max(0, TABS.indexOf(params.get("view") || "features"));
  const [tier, setTier] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [request, setRequest] = useState(null);
  const [adding, setAdding] = useState(false);
  const [admin, setAdmin] = useState({ username: "", displayName: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [promotion, setPromotion] = useState(null);

  const featuresLoader = useCallback(() => featuresService.platformFeatures(), []);
  const features = useStableLoad(featuresLoader);
  const changesLoader = useCallback(() => featuresService.changes(), []);
  const changes = useStableLoad(changesLoader);
  const adminsLoader = useCallback(() => featuresService.admins(), []);
  const admins = useStableLoad(adminsLoader);
  const rows = useMemo(() => filterFeatures(features.data, { tier, search }), [features.data, tier, search]);

  const notifyResult = (severity, detail) => toast.current?.show({ severity, summary: t("features.title"), detail, life: 6000 });
  const reloadAll = () => Promise.all([features.reload(), changes.reload(), featuresService.refreshState().catch(() => undefined)]);
  const open = (action, extra) => setRequest({ action, ...extra });

  const choosePromotion = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const content = JSON.parse(await file.text());
      if (!Array.isArray(content.features)) throw new Error("not an export");
      setPromotion({ file: content, reason: null, releaseRef: "", tried: false });
    } catch {
      notifyResult("error", t("features.promote.invalid"));
    }
  };

  const promote = async () => {
    setPromotion((p) => ({ ...p, tried: true }));
    if (reasonProblem(promotion.reason) || !promotion.releaseRef.trim()) return;
    setBusy(true);
    try {
      const r = await featuresService.promote({ file: promotion.file, ...reasonPayload(promotion.reason), releaseRef: promotion.releaseRef.trim() });
      setPromotion(null);
      notifyResult("success", r.message);
      await changes.reload();
      setParams({ view: "changes" }, { replace: true });
    } catch (e) {
      notifyResult("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const addAdmin = async () => {
    setBusy(true);
    try {
      const r = await featuresService.addAdmin(admin);
      setAdding(false);
      await openConfirm({ title: t("features.admins.added"), facts: [{ label: t("features.admins.username"), value: r.data.username },
        { label: t("features.admins.temporaryPassword"), value: r.data.temporaryPassword }], confirmLabel: t("features.common.close") });
      await admins.reload();
    } catch (e) {
      notifyResult("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const switchable = selected.filter((r) => !r.alwaysOn);
  const tierOptions = TIERS.map((code) => ({ label: t(`features.tiers.${code}`), value: code }));
  const headerActions = (
    <>
      <Button type="button" icon="pi pi-download" label={t("features.promote.export")} outlined onClick={() => featuresService.exportState().catch((e) => notifyResult("error", e.message))} />
      <Button type="button" icon="pi pi-upload" label={t("features.promote.button")} outlined onClick={() => fileInput.current?.click()} />
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={choosePromotion} aria-label={t("features.promote.button")} />
      <Button type="button" icon="pi pi-unlock" label={t("features.enablePhase2")} onClick={() => open("enable", { tier: "PHASE_2" })} data-testid="enable-phase-2" />
    </>
  );

  return (
    <div className="admin__page fr-page">
      <Toast ref={toast} />
      <PageHeader title={t("features.title")} home={t("sidebar.Master")} section={t("sidebar.Platform")} trail={[t("features.title")]} help={t("features.platformHelp")}
        actions={headerActions} />
      <TabView className="fr-tabs" activeIndex={tab} onTabChange={(e) => setParams({ view: TABS[e.index] }, { replace: true })}>
        <TabPanel header={t("features.tabs.catalogue")}>
          <div className="bv-list-toolbar">
            <span className="p-input-icon-left bv-list-search">
              <i className="pi pi-search" />
              <InputText value={search} placeholder={t("features.search")} aria-label={t("features.search")} onChange={(e) => setSearch(e.target.value)} />
            </span>
            <Dropdown value={tier} options={tierOptions} onChange={(e) => setTier(e.value ?? null)} placeholder={t("features.allTiers")} showClear className="bv-list-filter"
              aria-label={t("features.columns.tier")} />
            <span className="fr-toolbar-actions">
              <Button type="button" label={t("features.enableSelected", { count: switchable.length })} outlined disabled={!switchable.length} {...(switchable.length ? {} : { tooltip: t("features.selectFirst", "Select features in the list first"), tooltipOptions: { position: "top", showOnDisabled: true } })}
                onClick={() => open("enable", { features: switchable.map((r) => r.key) })} data-testid="enable-selected" />
              <Button type="button" label={t("features.disableSelected", { count: switchable.length })} outlined severity="danger" disabled={!switchable.length} {...(switchable.length ? {} : { tooltip: t("features.selectFirst", "Select features in the list first"), tooltipOptions: { position: "top", showOnDisabled: true } })}
                onClick={() => open("disable", { features: switchable.map((r) => r.key) })} data-testid="disable-selected" />
            </span>
          </div>
          <div className="bv-loading-host">
            <LoadingBar active={features.refreshing} />
            <DataTable value={rows} dataKey="key" size="small" stripedRows loading={features.loading} paginator rows={25} rowsPerPageOptions={[25, 50, 100]}
              selectionMode="checkbox" selection={selected} onSelectionChange={(e) => setSelected(e.value)} isDataSelectable={(e) => !e.data.alwaysOn}
              emptyMessage={features.error || t("features.empty")} className="fr-table" data-testid="platform-features">
              <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
              <Column header={t("features.columns.feature")} body={(r) => (
                <span className="fr-name">
                  {r.name}
                  {r.decisionPending ? <StatusChip label={t("features.decisionPending")} severity="warning" /> : null}
                  {r.tampered ? <StatusChip label={t("features.tampered")} severity="danger" /> : null}
                </span>
              )} style={{ minWidth: "16rem" }} />
              <Column field="module" header={t("features.columns.module")} />
              <Column header={t("features.columns.tier")} body={(r) => <TierTag t={t} tier={r.tier} />} />
              <Column header={t("features.columns.status")} body={(r) => <StatusOf t={t} status={r.status} />} />
              <Column header={t("features.columns.dependsOn")} body={(r) => r.dependsOn.map((k) => (features.data || []).find((f) => f.key === k)?.name || k).join(", ") || "-"} />
              <Column header={t("features.columns.requirements")} body={(r) => <ListCell items={r.requirements || []} max={2} />} style={{ minWidth: "12rem" }} />
              <Column header={t("features.columns.enabledOn")} body={(r) => formatDate(r.enabledAt)} bodyClassName="bv-nowrap" />
              <Column header={t("features.columns.releaseRef")} body={(r) => r.releaseRef || "-"} />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("features.tabs.changes", { count: (changes.data || []).filter((c) => c.status === "pending").length })}>
          <ChangesTable changes={changes} decide={featuresService.decide} withdraw={featuresService.withdraw} notify={notifyResult}
            onChanged={({ applied }) => (applied ? reloadAll() : changes.reload())} ownRequestText={t("features.changes.ownRequest")} />
        </TabPanel>
        <TabPanel header={t("features.tabs.admins")}>
          <div className="bv-list-toolbar">
            <span className="fr-toolbar-actions">
              <Button type="button" icon="pi pi-user-plus" label={t("features.admins.add")} outlined onClick={() => { setAdmin({ username: "", displayName: "", email: "" }); setAdding(true); }} />
            </span>
          </div>
          <DataTable value={admins.data || []} dataKey="id" size="small" stripedRows loading={admins.loading} className="fr-table" emptyMessage={t("features.empty")}>
            <Column field="displayName" header={t("features.admins.name")} />
            <Column field="username" header={t("features.admins.username")} />
            <Column field="email" header={t("features.admins.email")} />
            <Column header={t("features.admins.twoFactor")} body={(r) => <StatusChip label={t(r.twoFactorEnabled ? "features.admins.enrolled" : "features.admins.pending")} severity={r.twoFactorEnabled ? "success" : "warning"} />} />
            <Column header={t("features.admins.lastLogin")} body={(r) => formatDate(r.lastLoginAt, { withTime: true })} />
            <Column header={t("features.columns.status")} body={(r) => <StatusChip code={r.status} label={t(`features.admins.status.${r.status}`, r.status)} />} />
          </DataTable>
        </TabPanel>
      </TabView>
      <ChangeDialog visible={!!request} onHide={() => setRequest(null)} request={request}
        onDone={async (r) => { setRequest(null); setSelected([]); notifyResult("success", r.message); await changes.reload(); setParams({ view: "changes" }, { replace: true }); }} />
      <Dialog visible={!!promotion} onHide={() => setPromotion(null)} header={t("features.promote.title")} modal draggable={false} resizable={false} style={{ width: "40rem" }}
        footer={(
          <>
            <Button type="button" label={t("features.common.cancel")} text onClick={() => setPromotion(null)} disabled={busy} />
            <Button type="button" label={t("features.promote.confirm")} icon="pi pi-send" onClick={promote} loading={busy} />
          </>
        )}>
        {promotion ? (
          <div className="fr-form">
            <KeyValueGrid columns={2} items={[
              { label: t("features.promote.source"), value: promotion.file.environment },
              { label: t("features.promote.exportedAt"), value: promotion.file.exportedAt, type: "datetime" },
              { label: t("features.promote.on"), value: promotion.file.features.filter((f) => f.status !== "off").map((f) => f.name || f.key).join(", "), span: "full" },
            ]} />
            <ReasonPicker context="feature_change" value={promotion.reason} onChange={(reason) => setPromotion((p) => ({ ...p, reason }))} showErrors={promotion.tried} disabled={busy} />
            <div className="fr-field">
              <label htmlFor="fr-promote-ref" className="bv-field-label">{t("features.change.releaseRef")}</label>
              <InputText id="fr-promote-ref" value={promotion.releaseRef} onChange={(e) => setPromotion((p) => ({ ...p, releaseRef: e.target.value }))} disabled={busy}
                invalid={promotion.tried && !promotion.releaseRef.trim()} maxLength={60} />
              {promotion.tried && !promotion.releaseRef.trim() ? <small className="p-error">{t("features.change.releaseRefRequired")}</small> : null}
            </div>
          </div>
        ) : null}
      </Dialog>
      <Dialog visible={adding} onHide={() => setAdding(false)} header={t("features.admins.add")} modal draggable={false} resizable={false} style={{ width: "32rem" }}
        footer={(
          <>
            <Button type="button" label={t("features.common.cancel")} text onClick={() => setAdding(false)} disabled={busy} />
            <Button type="button" label={t("features.admins.addConfirm")} onClick={addAdmin} loading={busy}
              disabled={!admin.username.trim() || !admin.displayName.trim() || !admin.email.trim()} />
          </>
        )}>
        <div className="fr-form">
          {["username", "displayName", "email"].map((field) => (
            <div key={field} className="fr-field">
              <label htmlFor={`fr-admin-${field}`} className="bv-field-label">{t(`features.admins.${field === "displayName" ? "name" : field}`)}</label>
              <InputText id={`fr-admin-${field}`} value={admin[field]} onChange={(e) => setAdmin((a) => ({ ...a, [field]: e.target.value }))} disabled={busy} />
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
};

export default PlatformFeatures;
