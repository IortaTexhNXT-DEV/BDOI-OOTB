import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import StatCards from "../../components/StatCards";
import StatusChip from "../../components/StatusChip";
import LoadingBar from "../../components/LoadingBar";
import LoadState from "../../components/LoadState";
import { ChartCard, ThemedChart } from "../../components/Dashboard";
import { EmptyState, SectionCard } from "../../components/RecordPage";
import { useStableLoad } from "../../hooks/useStableLoad";
import { useChartTheme } from "../../theme/chartTheme";
import goLiveService from "../../services/goLiveService";
import { amount, count, dateOf, dateTimeOf, num } from "./shared";

/** Edits of migrated records per day, one series per record type, for the chart and its table. */
export const editsByDay = (rows = []) => {
  const days = [...new Set(rows.map((r) => String(r.day).slice(0, 10)))].sort();
  const entities = [...new Set(rows.map((r) => r.entity))];
  return { days, entities, value: (entity, day) => rows.filter((r) => r.entity === entity && String(r.day).slice(0, 10) === day).reduce((s, r) => s + r.count, 0) };
};

/** Hypercare: the weeks after the go-live lock, from the business issued in BrokerVerse to the daily checks and open defects. */
const Hypercare = () => {
  const { t } = useTranslation();
  const chart = useChartTheme();
  const loader = useCallback(() => goLiveService.hypercare(), []);
  const { data: h, loading, refreshing, error, reload } = useStableLoad(loader);

  if (!h) return <LoadState loading={loading} error={error} onRetry={reload} />;
  if (!h.started) {
    return (
      <SectionCard title={t("goLive.tabs.hypercare")}>
        <EmptyState icon="pi-heart" title={t("goLive.hypercare.notStarted")} text={h.cutoverDate ? t("goLive.hypercare.cutoverOn", { date: dateOf(h.cutoverDate) }) : null} />
      </SectionCard>
    );
  }

  const kpis = [
    { key: "days", label: t("goLive.hypercare.days"), value: `${h.daysSinceGoLive} / ${h.hypercareDays}`, note: t("goLive.hypercare.since", { date: dateOf(h.cutoverDate) }),
      status: h.ended ? { severity: "good", label: t("goLive.hypercare.ended") } : undefined },
    { key: "policies", label: t("goLive.hypercare.issuedPolicies"), value: h.issued.policies, note: amount(h.issued.grossPremium) },
    { key: "receipts", label: t("goLive.hypercare.receipts"), value: h.issued.receipts, note: amount(h.issued.receiptAmount) },
    { key: "endorsements", label: t("goLive.hypercare.endorsementsClaims"), value: h.issued.endorsements + h.issued.claims,
      note: t("goLive.hypercare.endorsementsClaimsNote", { endorsements: h.issued.endorsements, claims: h.issued.claims }) },
    { key: "collected", label: t("goLive.hypercare.collected"), value: amount(h.migratedItems.collected),
      note: t("goLive.hypercare.collectedNote", { percent: h.migratedItems.collectedPercent, opening: amount(h.migratedItems.openingBalance) }) },
    { key: "renewals", label: t("goLive.hypercare.renewals"), value: `${h.renewals.renewed} / ${h.renewals.due}`, note: t("goLive.hypercare.renewalsNote") },
    { key: "migrated", label: t("goLive.hypercare.onMigrated"), value: h.migratedPolicies.endorsements + h.migratedPolicies.claims,
      note: t("goLive.hypercare.onMigratedNote", { endorsements: h.migratedPolicies.endorsements, claims: h.migratedPolicies.claims, cancellations: h.migratedPolicies.cancellations }) },
    { key: "edits", label: t("goLive.hypercare.edits"), value: h.edits.total, note: t("goLive.hypercare.editsNote") },
  ];
  const edits = editsByDay(h.edits.byDay);
  const colors = chart.series(edits.entities.length || 1);
  const editsData = { labels: edits.days.map((d) => dateOf(d)), datasets: edits.entities.map((e, i) => ({
    label: t(`goLive.hypercare.entities.${e}`), data: edits.days.map((d) => edits.value(e, d)), backgroundColor: colors[i] })) };
  const ageing = h.migratedItems.ageing.map((a) => ({ label: a.bucket, balance: a.balance, count: a.count }));
  const ageingData = { labels: ageing.map((a) => a.label), datasets: [{ label: t("goLive.hypercare.openBalance"), data: ageing.map((a) => a.balance), backgroundColor: chart.primary }] };

  return (
    <div className="go-live__stack bv-loading-host">
      <LoadingBar active={refreshing} />
      <StatCards items={kpis} />
      <div className="bv-dash-grid">
        <ChartCard title={t("goLive.hypercare.editsChart")} exportName="edits-to-migrated-records"
          table={{ columns: [{ field: "label", header: t("goLive.hypercare.day") }, ...edits.entities.map((e, i) => ({ field: `v${i}`, header: t(`goLive.hypercare.entities.${e}`), format: "count" }))],
            rows: edits.days.map((d) => ({ label: dateOf(d), ...Object.fromEntries(edits.entities.map((e, i) => [`v${i}`, edits.value(e, d)])) })) }}>
          <ThemedChart type="bar" data={editsData} format="count" options={{ scales: { x: { stacked: true }, y: { stacked: true } } }} emptyText={t("goLive.hypercare.noEdits")} />
        </ChartCard>
        <ChartCard title={t("goLive.hypercare.ageingChart")} exportName="migrated-open-items-ageing"
          table={{ columns: [{ field: "label", header: t("goLive.hypercare.bucket") }, { field: "count", header: t("goLive.hypercare.items"), format: "count" },
            { field: "balance", header: t("goLive.hypercare.openBalance"), format: "currency" }], rows: ageing }}>
          <ThemedChart type="bar" data={ageingData} format="currency" emptyText={t("goLive.hypercare.noOpenItems")} />
        </ChartCard>
      </div>
      <div className="go-live__columns">
        <SectionCard title={t("goLive.hypercare.checks")}>
          <DataTable value={h.checks} dataKey="code" size="small">
            <Column header={t("goLive.hypercare.check")} body={(c) => t(`goLive.hypercare.checkNames.${c.code}`, { defaultValue: c.label })} />
            <Column header={t("goLive.loads.status")} body={(c) => <StatusChip label={c.ok ? t("goLive.hypercare.ok") : t("goLive.hypercare.attention")} severity={c.ok ? "success" : "danger"} />} />
            <Column header={t("goLive.lock.detail")} body={(c) => c.detail || "—"} />
          </DataTable>
        </SectionCard>
        <SectionCard title={t("goLive.hypercare.defects")}>
          <DataTable value={h.defects} dataKey="severity" size="small">
            <Column header={t("goLive.defects.severity")} body={(d) => t(`goLive.severity.${d.severity}`)} />
            <Column header={t("goLive.hypercare.open")} body={(d) => count(d.open)} {...num} />
          </DataTable>
        </SectionCard>
      </div>
      <SectionCard title={t("goLive.hypercare.lockActivity", { count: h.lock.refused })}>
        <div className="go-live__columns">
          <DataTable value={h.lock.latestRefused} dataKey={(r) => `${r.at}-${r.import}`} size="small" emptyMessage={t("goLive.hypercare.noRefused")}>
            <Column header={t("goLive.hypercare.refusedAt")} body={(r) => dateTimeOf(r.at)} />
            <Column header={t("goLive.lock.imports")} body={(r) => t(`goLive.lock.scopes.${r.import}`, { defaultValue: r.import })} />
            <Column field="username" header={t("goLive.hypercare.user")} />
          </DataTable>
          <DataTable value={h.lock.unlocks} dataKey="id" size="small" emptyMessage={t("goLive.hypercare.noUnlocks")}>
            <Column header={t("goLive.lock.imports")} body={(u) => (u.scope || []).map((s) => t(`goLive.lock.scopes.${s}`)).join(", ")} />
            <Column header={t("goLive.hypercare.approvedAt")} body={(u) => dateTimeOf(u.approvedAt)} />
            <Column header={t("goLive.lock.relockedAt")} body={(u) => dateTimeOf(u.relockedAt || u.expiresAt)} />
          </DataTable>
        </div>
      </SectionCard>
    </div>
  );
};

export default Hypercare;
