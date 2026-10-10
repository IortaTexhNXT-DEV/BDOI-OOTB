import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { TabView, TabPanel } from "primereact/tabview";
import StatCards from "../../components/StatCards";
import { useListState } from "../../hooks/useServerList";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { notifyError } from "../../utility/dialogs";
import { formatDate } from "../../utility/dateFormat";
import { numberLocale } from "../../utility/currencyConverter";
import { getUserRoles } from "../../utils/menuPermissions";
import { defaultDashboard } from "../../components/Dashboard/personas";
import { PRESETS, TABS, figureText, isoToday, orderCategories, presetFor, tabFromSearch } from "./logic";
import { fetchFigures } from "./figures";
import MyItems from "./MyItems";
import MyTeam from "./MyTeam";
import MyTasks from "./MyTasks";
import Agenda from "./Agenda";
import TaskDialog from "./TaskDialog";
import "./index.scss";

/**
 * My Work (/my-work): the first screen of every role after sign-in (the former Home and Operations > My Work), one
 * screen. My Items (everything waiting on the user, by category, with due dates and the next action), My Team
 * (managers: the items of the people reporting to them, per person, with reassignment), My Tasks (the work diary)
 * and Calendar (day / week agenda). The role preset (logic.js PRESETS) decides which categories come first, the
 * default scope, what the agenda shows and the primary action; the role figures come from the server.
 */
const MyWork = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const presetCode = useMemo(() => presetFor(getUserRoles()), []);
  const preset = PRESETS[presetCode] || PRESETS.general;
  const [dashboard] = useState(() => defaultDashboard());
  const [mine, setMine] = useState(null);
  const [scoped, setScoped] = useState(null);
  const [home, setHome] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState({ visible: false, task: null });
  const [items, patchItems] = useListState("my-work-items-filters", { scope: preset.scope, category: "", due: "", priority: "", search: "", sort: "due" });
  const [team, patchTeam] = useListState("my-work-team-filters", { member: "", category: "", due: "", priority: "", search: "", sort: "due" });
  const [tasks, patchTasks] = useListState("my-work-tasks-filters", { scope: "mine", status: "open", due: "", priority: "", search: "" });
  const [calendar, patchCalendar] = useListState("my-work-calendar", { view: "week", date: "" });

  const isManager = !!mine?.team?.isManager;
  const tab = tabFromSearch(location.search, { isManager: isManager || !mine });
  const today = mine?.asOf || isoToday();
  const soonDays = mine?.dueSoonDays || 7;

  const loadSummary = useCallback(() => {
    myWorkService.summary("me").then(setMine).catch((e) => notifyError(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded"))));
  }, [t]);
  useEffect(() => { loadSummary(); }, [loadSummary, reloadKey]);
  useEffect(() => {
    if (items.scope === "me") return;
    myWorkService.summary(items.scope).then(setScoped).catch(() => setScoped(null));
  }, [items.scope, reloadKey]);
  // the role figures and the subtitle (role, branch, company); the page works without them
  useEffect(() => {
    fetchFigures().then(setHome).catch(() => setHome(null));
  }, [reloadKey]);

  // a reminder notification links to ?tab=tasks&task=<id>: open that task
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("task");
    if (!id) return;
    myWorkService.task(id).then((task) => setDialog({ visible: true, task })).catch((e) => notifyError(errorMessage(e, t("myWork.task.notFound", "The task was not found"))));
  }, [location.search, t]);

  const goTab = (next, extra = {}) => {
    const params = new URLSearchParams();
    if (next !== "items") params.set("tab", next);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    navigate({ search: params.toString() ? `?${params}` : "" }, { replace: true });
  };
  const refresh = () => setReloadKey((n) => n + 1);
  const closeDialog = () => {
    setDialog({ visible: false, task: null });
    if (new URLSearchParams(location.search).get("task")) goTab(tab);
  };

  const totals = mine?.totals;
  const taskCat = mine?.categories?.find((c) => c.code === "tasks");
  const showDue = (due) => { patchItems({ due, category: "" }); goTab("items"); };
  const cards = [
    { key: "overdue", label: t("myWork.kpi.overdue", "Overdue"), value: totals?.overdue, note: t("myWork.kpi.overdueNote", "Past their due date"), onClick: () => showDue("overdue"), active: tab === "items" && items.due === "overdue" },
    { key: "today", label: t("myWork.kpi.today", "Due today"), value: totals?.dueToday, onClick: () => showDue("today"), active: tab === "items" && items.due === "today" },
    { key: "soon", label: t("myWork.kpi.soon", { count: soonDays, defaultValue: "Next {{count}} days" }), value: totals?.dueSoon, onClick: () => showDue("soon"), active: tab === "items" && items.due === "soon" },
    { key: "open", label: t("myWork.kpi.open", "Open items"), value: totals?.open, note: totals ? t("myWork.kpi.high", { count: totals.high, defaultValue: "{{count}} high priority" }) : null, onClick: () => showDue(""), active: tab === "items" && !items.due },
    { key: "tasks", label: t("myWork.kpi.tasks", "Open tasks"), value: taskCat?.count, note: taskCat ? t("myWork.overdueCount", { count: taskCat.overdue, defaultValue: "{{count}} overdue" }) : null, onClick: () => goTab("tasks"), active: tab === "tasks" },
  ];
  // the role figures: plain numbers next to the My Work figures (no filter behind them)
  const roleCards = (home?.figures || []).map((f) => ({
    key: `role-${f.key}`, label: t(`myWork.home.figure.${f.key}`, { defaultValue: f.label }), value: figureText(f, formatCurrency, numberLocale()),
  }));

  const roleLabel = presetCode === "general" ? home?.roleName : t(`myWork.home.role.${presetCode}`, { defaultValue: home?.roleName || presetCode });
  const subtitle = [roleLabel, formatDate(today), home?.branch || home?.company].filter(Boolean).join(" | ");
  const action = preset.action;
  const runAction = () => {
    if (!action) return;
    if (action.path) navigate(action.path);
    else if (action.category) { patchItems({ category: action.category, due: "" }); goTab("items"); }
  };

  const withOrder = (summary) => (summary ? { ...summary, categories: orderCategories(summary.categories, presetCode) } : summary);
  const visibleTabs = TABS.filter((x) => x !== "team" || isManager);
  const count = (n) => (n === undefined || n === null ? "" : ` (${n})`);
  const tabLabel = {
    items: `${t("myWork.tab.items", "My Items")}${count(totals?.open)}`,
    team: `${t("myWork.tab.team", "My Team")}${count(mine?.team?.size)}`,
    tasks: `${t("myWork.tab.tasks", "My Tasks")}${count(taskCat?.count)}`,
    calendar: t("myWork.tab.calendar", "Calendar"),
  };
  const tabIcon = { items: "pi pi-inbox", team: "pi pi-users", tasks: "pi pi-check-square", calendar: "pi pi-calendar" };

  return (
    <div className="mw-page">
      <div className="mw-head">
        <div>
          <h1 className="page__title">{t("myWork.title", "My Work")}</h1>
          <p className="mw-subtitle">{subtitle}</p>
        </div>
        <div className="mw-head__actions">
          <Button icon="pi pi-refresh" text rounded aria-label={t("myWork.refresh", "Refresh")} tooltip={t("myWork.refresh", "Refresh")} tooltipOptions={{ position: "bottom" }} onClick={refresh} />
          {dashboard && <Button label={t("myWork.myDashboard", "My dashboard")} icon="pi pi-chart-bar" text onClick={() => navigate(dashboard.path)} />}
          <Button label={t("myWork.task.new", "New task")} icon="pi pi-plus" outlined onClick={() => setDialog({ visible: true, task: null })} />
          {action && <Button label={t(`myWork.home.action.${action.key}`, { defaultValue: action.key })} icon={action.category ? "pi pi-check-square" : "pi pi-arrow-right"} iconPos={action.category ? "left" : "right"} onClick={runAction} />}
        </div>
      </div>

      <StatCards items={[...cards, ...roleCards]} className="mw-kpis" />

      <TabView className="bv-tabbar mw-tabs" activeIndex={Math.max(0, visibleTabs.indexOf(tab))} onTabChange={(e) => goTab(visibleTabs[e.index])}>
        {visibleTabs.map((x) => <TabPanel key={x} header={tabLabel[x]} leftIcon={`${tabIcon[x]} mr-2`} />)}
      </TabView>

      <div className="mw-body">
        {tab === "items" && (
          <MyItems state={items} patch={patchItems} summary={withOrder(items.scope === "me" ? mine : scoped)} loading={!(items.scope === "me" ? mine : scoped)}
            today={today} soonDays={soonDays} reloadKey={reloadKey} isManager={isManager} />
        )}
        {tab === "team" && isManager && <MyTeam state={team} patch={patchTeam} today={today} soonDays={soonDays} reloadKey={reloadKey} onChanged={loadSummary} />}
        {tab === "tasks" && (
          <MyTasks state={tasks} patch={patchTasks} today={today} soonDays={soonDays} isManager={isManager} reloadKey={reloadKey}
            onEdit={(task) => setDialog({ visible: true, task })} onChanged={loadSummary} />
        )}
        {tab === "calendar" && (
          <Agenda state={calendar} patch={patchCalendar} today={today} reloadKey={reloadKey} categories={preset.agenda}
            onEditTask={(task) => setDialog({ visible: true, task })} onNewTask={(date) => setDialog({ visible: true, task: null, date })} />
        )}
      </div>

      <TaskDialog visible={dialog.visible} task={dialog.task} today={dialog.date || today} onHide={closeDialog}
        onSaved={() => { closeDialog(); refresh(); }} />
    </div>
  );
};

export default MyWork;
