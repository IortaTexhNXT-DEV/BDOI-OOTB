import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TabMenu } from "primereact/tabmenu";
import { Toast } from "primereact/toast";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { ROOT, WorkspaceContext, dateOf } from "./shared";
import Overview from "./Overview";
import Templates from "./Templates";
import Loads from "./Loads";
import LoadPage from "./LoadPage";
import Reconciliations from "./Reconciliations";
import ReconciliationPage from "./ReconciliationPage";
import Runs from "./Runs";
import RunPage from "./RunPage";
import Cutover from "./Cutover";
import GoLive from "./GoLive";
import Hypercare from "./Hypercare";
import "./index.scss";

/** The tabs in programme order: each is a route, so a link opens it directly. */
export const TABS = [
  { key: "overview", path: "" },
  { key: "templates", path: "templates" },
  { key: "loads", path: "loads" },
  { key: "reconciliation", path: "reconciliation" },
  { key: "runs", path: "runs" },
  { key: "cutover", path: "cutover" },
  { key: "decision", path: "decision" },
  { key: "hypercare", path: "hypercare" },
];

/** The tab of an address: the first part after the workspace root ("loads/12" is on Loads). */
export const tabOf = (pathname) => {
  const rest = String(pathname || "").slice(ROOT.length).replace(/^\/+/, "").split("/")[0];
  const i = TABS.findIndex((tab) => tab.path === rest);
  return i < 0 ? 0 : i;
};

/**
 * Master > System Configuration > Data Migration & Go-Live: the migration programme from the templates to hypercare.
 * The header shows the environment, the cutover date, the go-live lock and the current run; each tab is a route.
 */
const GoLiveWorkspace = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const loader = useCallback(() => goLiveService.overview(), []);
  const { data: overview, reload: reloadOverview } = useStableLoad(loader);

  const notify = useCallback((severity, detail) => {
    toast.current?.show({ severity, summary: t(`goLive.toast.${severity}`), detail, life: severity === "error" ? 6000 : 3000 });
  }, [t]);
  const context = useMemo(() => ({ notify, overview, reloadOverview }), [notify, overview, reloadOverview]);
  const active = tabOf(location.pathname);
  const model = TABS.map((tab) => ({ label: t(`goLive.tabs.${tab.key}`), command: () => navigate(tab.path ? `${ROOT}/${tab.path}` : ROOT) }));

  const meta = overview ? (
    <span className="go-live__meta">
      <span className="go-live__fact">{t(`goLive.environment.${overview.environment}`, { defaultValue: String(overview.environment || "").toUpperCase() })}</span>
      <span className="go-live__fact">{t("goLive.header.cutover")}: {overview.cutoverDate ? dateOf(overview.cutoverDate) : t("goLive.header.notSet")}</span>
      <StatusChip code={overview.locked ? "locked" : "open"} label={overview.locked ? (overview.unlock ? t("goLive.header.unlocked") : t("goLive.header.locked")) : t("goLive.header.open")}
        severity={overview.locked ? (overview.unlock ? "warning" : "success") : "info"} />
      {overview.run ? <span className="go-live__fact">{t("goLive.header.run")}: {overview.run.runNumber} · {overview.run.title}</span> : null}
    </span>
  ) : null;

  return (
    <WorkspaceContext.Provider value={context}>
      <div className="go-live">
        <Toast ref={toast} />
        <PageHeader title={t("goLive.title")} home={t("goLive.home")} section={t("goLive.section")} trail={[t("goLive.title")]} help={t("goLive.help")} meta={meta} />
        <TabMenu model={model} activeIndex={active} className="go-live__tabs" aria-label={t("goLive.tabsLabel")} />
        <div className="go-live__body">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="templates" element={<Templates />} />
            <Route path="loads" element={<Loads />} />
            <Route path="loads/:id" element={<LoadPage />} />
            <Route path="reconciliation" element={<Reconciliations />} />
            <Route path="reconciliation/:id" element={<ReconciliationPage />} />
            <Route path="runs" element={<Runs />} />
            <Route path="runs/:id" element={<RunPage />} />
            <Route path="cutover" element={<Cutover />} />
            <Route path="decision" element={<GoLive />} />
            <Route path="hypercare" element={<Hypercare />} />
            <Route path="*" element={<Navigate to={ROOT} replace />} />
          </Routes>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
};

export default GoLiveWorkspace;
