import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";
import { InputSwitch } from "primereact/inputswitch";
import { Menu } from "primereact/menu";
import { Message } from "primereact/message";
import { OverlayPanel } from "primereact/overlaypanel";
import { Skeleton } from "primereact/skeleton";
import { TabPanel, TabView } from "primereact/tabview";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import { mayViewTechnical } from "../../components/TechnicalDetails";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { notifyError } from "../../utility/dialogs";
import { TABS } from "./authorityFormat";
import AuthorityLimitsTab from "./AuthorityLimitsTab";
import AuthorityLimitPanel from "./AuthorityLimitPanel";
import AuthorityPendingTab from "./AuthorityPendingTab";
import AuthorityPersonalTab from "./AuthorityPersonalTab";
import AuthorityHistoryTab from "./AuthorityHistoryTab";
import AuthorityUploadDialog from "./AuthorityUploadDialog";
import AuthorityUploadReview from "./AuthorityUploadReview";
import { BASE_ROLES_KEY, TECHNICAL_NAMES_KEY, readPreference, useLabels, writePreference } from "./common";
import "../Administration/index.scss";
import "./index.scss";

export const FILTERS_KEY = "bv.access.authorityFilters";
const DEFAULT_FILTERS = { unchecked: false, scope: "approvers", departments: [], gapsOnly: false };

const MatrixSkeleton = () => (
  <div className="rp-card" role="status" aria-busy="true">
    <Skeleton width="100%" height="2.5rem" className="mb-3" />
    {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height="3rem" className="mb-2" />)}
  </div>
);

/**
 * Master > Users and Access > Authority Matrix: how much each role (or person) may approve per transaction type.
 * Tabs Limits (transactions down, roles across by department), Pending approval, Personal limits and History; the
 * tab is in the address (?tab, change). Every change, also an uploaded workbook, waits for another administrator's
 * approval and applies from its effective date. Exports to Excel for audit.
 */
const AuthorityMatrix = () => {
  const k = useLabels();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "limits";
  const mayTechnical = useMemo(() => mayViewTechnical({ permission: "write:access-control" }), []);
  const [technical, setTechnical] = useState(() => mayTechnical && readPreference(TECHNICAL_NAMES_KEY, false) === true);
  const [filters, setFilters] = useState(() => {
    const saved = readPreference(FILTERS_KEY, {});
    return { ...DEFAULT_FILTERS, ...(saved && typeof saved === "object" ? saved : {}), gapsOnly: false, base: readPreference(BASE_ROLES_KEY, false) === true };
  });
  const [panel, setPanel] = useState(null);
  const [importing, setImporting] = useState(false);
  const [review, setReview] = useState(null);
  const more = useRef(null);
  const downloads = useRef(null);

  const loader = useCallback(() => accessControlService.authorityMatrix(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const edit = !!data?.abilities?.edit;
  const uploadTarget = useMemo(() => accessControlService.authorityUploadTarget(k("authority.uploadTarget", "Authority limits"),
    { base: filters.base, unchecked: filters.unchecked, all: filters.scope === "all" }), [k, filters.base, filters.unchecked, filters.scope]);

  const go = (patch) => setParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(patch).forEach(([key, value]) => (value === null || value === undefined || value === "" ? next.delete(key) : next.set(key, value)));
    if (next.get("tab") === "limits") next.delete("tab");
    return next;
  }, { replace: true });

  const changeFilters = (next) => {
    setFilters(next);
    writePreference(BASE_ROLES_KEY, !!next.base);
    writePreference(FILTERS_KEY, { unchecked: next.unchecked, scope: next.scope, departments: next.departments });
  };
  const changeTechnical = (on) => {
    setTechnical(on);
    writePreference(TECHNICAL_NAMES_KEY, on);
  };
  const download = async (fn) => {
    try {
      await fn();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const uploaded = (result) => {
    setImporting(false);
    setReview(result);
  };
  const submitted = async () => {
    setReview(null);
    await reload();
    go({ tab: "pending", change: null });
  };

  const actions = (
    <>
      {edit ? <Button label={k("authority.uploadAction", "Upload")} icon="pi pi-upload" outlined onClick={() => setImporting(true)} disabled={!data} /> : null}
      <Button label={k("authority.download", "Download")} icon="pi pi-download" outlined onClick={(e) => downloads.current?.toggle(e)} disabled={!data}
        aria-haspopup="menu" />
      <Menu ref={downloads} popup model={[
        { label: k("authority.downloadMatrix", "Authority matrix (Excel)"), icon: "pi pi-file-excel", command: () => download(accessControlService.downloadAuthorityMatrix) },
        { label: k("authority.downloadHistory", "Change history (Excel)"), icon: "pi pi-history", command: () => download(accessControlService.downloadLimitHistory) },
      ]} />
      {mayTechnical ? (
        <>
          <Button icon="pi pi-ellipsis-v" text rounded aria-label={k("rolePermissions.moreOptions", "More options")} onClick={(e) => more.current?.toggle(e)} />
          <OverlayPanel ref={more} className="rp-menu">
            <div className="rp-check">
              <InputSwitch inputId="am-technical" checked={technical} onChange={(e) => changeTechnical(!!e.value)} />
              <label htmlFor="am-technical">{k("rolePermissions.technicalNames", "Show technical names")}</label>
            </div>
          </OverlayPanel>
        </>
      ) : null}
    </>
  );
  const tabs = [
    { key: "limits", label: k("authority.tabLimits", "Limits"), icon: "pi pi-table" },
    { key: "pending", label: k("authority.tabPending", "Pending approval"), icon: "pi pi-clock", badge: data ? data.pendingCount : null },
    { key: "personal", label: k("authority.tabPersonal", "Personal limits"), icon: "pi pi-user", badge: data ? data.userLimits.length : null, muted: true },
    { key: "history", label: k("authority.tabHistory", "History"), icon: "pi pi-history" },
  ];

  let body = null;
  if (!data) body = loading ? <MatrixSkeleton /> : null;
  else if (tab === "pending") body = <AuthorityPendingTab data={data} focus={Number(params.get("change")) || null} onChanged={reload} />;
  else if (tab === "personal") {
    body = (
      <AuthorityPersonalTab data={data} technical={technical} onAdd={() => setPanel({ person: null })}
        onOpen={(p) => setPanel({ person: { userId: p.userId, userName: p.userName }, row: data.rows.find((r) => r.code === p.transactionType) || { code: p.transactionType,
          name: p.transactionName, measure: p.measure, cells: {} }, cell: p })} />
    );
  } else if (tab === "history") body = <AuthorityHistoryTab data={data} technical={technical} />;
  else body = <AuthorityLimitsTab data={data} filters={filters} onFilters={changeFilters} technical={technical} onOpen={(row, role) => setPanel({ row, role })} />;

  return (
    <div className="admin__page access__page rp-page am-page">
      <PageHeader title={k("authorityTitle", "Authority Matrix")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("authorityTitle", "Authority Matrix")]} actions={actions}
        help={k("authority.help", "Largest amount or percent each role may approve per transaction. Changes apply after another administrator approves them.")} />
      <TabView className="bv-tabbar rp-tabs" activeIndex={TABS.indexOf(tab)} onTabChange={(e) => go({ tab: TABS[e.index], change: null })}>
        {tabs.map((t) => (
          <TabPanel key={t.key} leftIcon={`${t.icon} mr-2`} header={(
            <span className="rp-tab">
              {t.label}
              {t.badge !== null && t.badge !== undefined ? <Badge value={t.badge} severity={t.badge && !t.muted ? "warning" : "secondary"} className="rp-tab__badge" /> : null}
            </span>
          )} />
        ))}
      </TabView>
      {error ? (
        <div className="rp-error">
          <Message severity="error" text={error} />
          <Button label={k("rolePermissions.retry", "Try again")} text onClick={reload} />
        </div>
      ) : null}
      <div className="bv-loading-host">
        <LoadingBar active={refreshing} />
        {body}
      </div>
      <AuthorityLimitPanel target={panel} data={data} technical={technical} onHide={() => setPanel(null)} onDone={reload} />
      <AuthorityUploadDialog visible={importing} target={uploadTarget} onHide={() => setImporting(false)} onChecked={uploaded} />
      <AuthorityUploadReview result={review} onHide={() => setReview(null)} onSubmitted={submitted} />
    </div>
  );
};

export default AuthorityMatrix;
