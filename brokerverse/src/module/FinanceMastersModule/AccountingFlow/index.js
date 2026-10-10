import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";
import { Skeleton } from "primereact/skeleton";
import { Tooltip } from "primereact/tooltip";
import ConfigStatus from "../../../components/ConfigStatus";
import LoadingBar from "../../../components/LoadingBar";
import PageHeader from "../../../components/PageHeader";
import { menuList } from "../../../components/SideBar/list";
import { findActiveTrail } from "../../../components/SideBar/menuTree";
import { useStableLoad } from "../../../hooks/useStableLoad";
import postingRulesService from "../../../services/postingRulesService";
import { canOpen, hasPermission } from "../../../utils/canOpen";
import { formatDate } from "../../../utility/dateFormat";
import { notifyError } from "../../../utility/dialogs";
import { TipChip } from "./AccountCell";
import EventCard, { APPROVALS, POSTING_RULES } from "./EventCard";
import { accountOptions, allEvents, filterEvents, filterParams, groupByArea, isFiltered, readFilters } from "./flowView";
import "./index.scss";

const DETERMINATION = "/master/finance/account-determination";

const FlowSkeleton = () => (
  <div className="af-layout" role="status" aria-busy="true">
    <div className="af-contents"><Skeleton height="20rem" /></div>
    <div className="af-main">
      <Skeleton height="3.5rem" className="mb-3" />
      {[0, 1, 2].map((i) => <Skeleton key={i} height="14rem" className="mb-3" />)}
    </div>
  </div>
);

/**
 * Master > Finance > Accounting Flow: the Finance accounting reference, read from the posting rules and accounts in
 * force. Events grouped by module (contents on the left), each with when it posts, where, the approval before posting
 * and its debit / credit entries with today's accounts; accounts still to be mapped are flagged with a link to the
 * screen where they are set. Filters live in the address (?q, module, account, pending, event) so a view can be
 * shared. Exports the reference to Excel and the Accounting Entries Handbook to PDF; prints the filtered page.
 */
const AccountingFlow = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const focus = params.get("event");
  const [active, setActive] = useState(focus);
  const exportMenu = useRef(null);
  const scrolled = useRef(false);

  const loader = useCallback(() => postingRulesService.flow(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);

  const mayEditRules = useMemo(() => canOpen(POSTING_RULES) && ["write:posting-rules", "write:masters", "write:settings"].some((p) => hasPermission(p)), []);
  const mayApprove = useMemo(() => hasPermission("approve:posting-rules") && canOpen(APPROVALS), []);
  const areaName = useCallback((area) => t(`accountingFlow.area.${area.code}`, { defaultValue: area.name }), [t]);
  const whereOf = useCallback((e) => {
    const trail = e.screen ? findActiveTrail(menuList, e.screen) : [];
    return trail.length ? trail.map((n) => t(`sidebar.${n}`, { defaultValue: n })).join(" › ") : e.where;
  }, [t]);

  const shown = useMemo(() => filterEvents(data, filters), [data, filters]);
  const groups = useMemo(() => groupByArea(data, shown), [data, shown]);
  const total = allEvents(data).length;
  const accounts = useMemo(() => accountOptions(data), [data]);
  const moduleOptions = useMemo(() => (data?.areas || []).map((a) => ({ value: a.code, label: areaName(a) })), [data, areaName]);

  const setFilters = (patch) => setParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(filterParams({ ...readFilters(current), ...patch })).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    return next;
  }, { replace: true });
  const clearFilters = () => setParams((current) => {
    const next = new URLSearchParams(current);
    ["q", "module", "account", "pending"].forEach((key) => next.delete(key));
    return next;
  }, { replace: true });

  const jump = (code) => {
    setActive(code);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("event", code);
      return next;
    }, { replace: true });
    document.getElementById(`event-${code}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  // ?event=<code> (a shared link, Posting Rules): scrolled to once the reference is on screen
  useEffect(() => {
    if (!data || scrolled.current || !focus) return;
    scrolled.current = true;
    document.getElementById(`event-${focus}`)?.scrollIntoView?.({ block: "start" });
  }, [data, focus]);

  // the event in view is highlighted in the contents
  useEffect(() => {
    if (!data || typeof window.IntersectionObserver !== "function") return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id.replace(/^event-/, ""));
    }, { rootMargin: "-80px 0px -60% 0px" });
    shown.forEach((e) => {
      const el = document.getElementById(`event-${e.eventCode}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [data, shown]);

  const download = async (format) => {
    try {
      await postingRulesService.downloadFlow(format);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const actions = (
    <>
      <Button type="button" label={t("accountingFlow.export.action")} icon="pi pi-download" outlined disabled={!data} aria-haspopup="menu"
        onClick={(e) => exportMenu.current?.toggle(e)} />
      <Menu ref={exportMenu} popup model={[
        { label: t("accountingFlow.export.excel"), icon: "pi pi-file-excel", command: () => download("xlsx") },
        { label: t("accountingFlow.export.pdf"), icon: "pi pi-file-pdf", command: () => download("pdf") },
      ]} />
      <Button type="button" label={t("accountingFlow.print")} icon="pi pi-print" outlined disabled={!data} onClick={() => window.print()} />
    </>
  );

  const pendingChanges = data?.pendingChanges || [];
  const pendingTip = pendingChanges.map((c) => `${c.kindLabel}: ${c.target}${c.requestedBy ? ` (${c.requestedBy})` : ""}`).join("\n");
  const pendingChip = <TipChip label={t("accountingFlow.status.pendingChanges", { count: pendingChanges.length })} severity="warning" tip={pendingTip} />;
  const status = data ? (
    <div className="af-status" role="group" aria-label={t("accountingFlow.status.label")}>
      <span className="af-status__edition">{t("accountingFlow.status.inForce", { date: formatDate(data.asOf) })}</span>
      <ConfigStatus feature={t("accountingFlow.status.mapping")} state={data.mapping.state === "ready" ? "ready" : "incomplete"} to={DETERMINATION} permission="write:posting-rules"
        missing={data.mapping.pending.map((p) => t(`accountingFlow.status.item.${p.reason}`, { item: p.item, account: p.glCode || "-" }))} />
      {pendingChanges.length ? (mayApprove ? <Link to={APPROVALS} className="af-chip-link">{pendingChip}</Link> : pendingChip) : null}
    </div>
  ) : null;

  const toolbar = data ? (
    <div className="af-toolbar" role="search">
      <span className="p-input-icon-left af-search">
        <i className="pi pi-search" aria-hidden="true" />
        <InputText value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} placeholder={t("accountingFlow.toolbar.search")} aria-label={t("accountingFlow.toolbar.search")} />
      </span>
      <MultiSelect value={filters.modules} options={moduleOptions} onChange={(e) => setFilters({ modules: e.value || [] })} display="chip" maxSelectedLabels={2}
        placeholder={t("accountingFlow.toolbar.allModules")} aria-label={t("accountingFlow.toolbar.modules")} className="af-filter" />
      <Dropdown value={filters.account} options={accounts} onChange={(e) => setFilters({ account: e.value || null })} filter showClear
        placeholder={t("accountingFlow.toolbar.allAccounts")} aria-label={t("accountingFlow.toolbar.account")} className="af-filter" />
      <span className="af-check">
        <InputSwitch inputId="af-pending" checked={filters.pending} onChange={(e) => setFilters({ pending: !!e.value })} />
        <label htmlFor="af-pending">{t("accountingFlow.toolbar.pendingOnly")}</label>
      </span>
      <Dropdown value={null} options={shown.map((e) => ({ value: e.eventCode, label: e.label }))} onChange={(e) => e.value && jump(e.value)} filter
        placeholder={t("accountingFlow.toolbar.jump")} aria-label={t("accountingFlow.toolbar.jump")} className="af-filter af-jump" />
      <span className="af-count" role="status">{t("accountingFlow.toolbar.count", { shown: shown.length, total })}</span>
    </div>
  ) : null;

  let body = null;
  if (!data) body = loading ? <FlowSkeleton /> : null;
  else {
    body = (
      <div className="af-layout">
        <nav className="af-contents" aria-label={t("accountingFlow.contentsTitle")}>
          <div className="af-contents__title">{t("accountingFlow.contentsTitle")}</div>
          {groups.map(({ area, events }) => (
            <div key={area.code} className="af-contents__group">
              <div className="af-contents__area">
                <span>{areaName(area)}</span>
                <span className="af-contents__count">{events.length}</span>
              </div>
              <ul>
                {events.map((e) => (
                  <li key={e.eventCode}>
                    <button type="button" className={`af-contents__event${active === e.eventCode ? " is-active" : ""}`} aria-current={active === e.eventCode ? "location" : undefined}
                      onClick={() => jump(e.eventCode)}>
                      <span>{e.label}</span>
                      {e.mappingPending || e.pending ? <span className="af-contents__dot" aria-label={t("accountingFlow.attention")} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="af-main">
          {toolbar}
          {groups.length ? groups.map(({ area, events }) => (
            <section key={area.code} className="af-area" aria-labelledby={`area-${area.code}`}>
              <h2 id={`area-${area.code}`} className="af-area__title">
                {areaName(area)}
                <span className="af-area__count">{events.length}</span>
              </h2>
              {events.map((e) => (
                <EventCard key={e.eventCode} event={e} where={whereOf(e)} mayEditRules={mayEditRules} mayApprove={mayApprove} highlighted={focus === e.eventCode} />
              ))}
            </section>
          )) : (
            <div className="af-empty">
              <span>{t("accountingFlow.empty")}</span>
              {isFiltered(filters) ? <Button type="button" label={t("accountingFlow.clearFilters")} text onClick={clearFilters} /> : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="af-page">
      <PageHeader title={t("accountingFlow.title")} home={t("accountingFlow.master")} section={t("accountingFlow.finance")} trail={[t("accountingFlow.title")]}
        help={t("accountingFlow.help")} actions={actions} />
      {status}
      {error ? (
        <div className="af-error">
          <Message severity="error" text={t("accountingFlow.loadError", { message: error })} />
          <Button type="button" label={t("accountingFlow.retry")} text onClick={reload} />
        </div>
      ) : null}
      <div className="bv-loading-host">
        <LoadingBar active={refreshing} />
        {body}
      </div>
      <Tooltip target=".af-tip" position="top" showDelay={150} />
    </div>
  );
};

export default AccountingFlow;
