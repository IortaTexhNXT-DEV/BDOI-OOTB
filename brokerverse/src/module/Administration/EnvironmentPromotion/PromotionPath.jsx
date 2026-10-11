import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import LoadingBar from "../../../components/LoadingBar";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import environmentPromotionService from "../../../services/environmentPromotionService";
import { hasPermission } from "../../../utils/canOpen";
import { formatInstant } from "../../../utility/dateFormat";
import "../index.scss";
import "./index.scss";

const BATCH_SEVERITY = { loaded: "success", validated: "info", failed: "danger" };

/**
 * Master > Environment Promotion > Promotion Path: where this environment stands on the path, the release it runs,
 * the last export, load and comparison of the Setup Workbook, the load history, and the marker of the environment.
 */
const PromotionPath = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`environmentPromotion.${key}`, opts);
  const toast = useRef(null);
  const [choice, setChoice] = useState(null);
  const canMark = hasPermission("write:data-load");
  const loader = useCallback(async () => {
    const [path, history] = await Promise.all([environmentPromotionService.getPath(), environmentPromotionService.getHistory()]);
    return { path, history };
  }, []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const path = data?.path;
  const choices = useMemo(() => (path?.choices || []).map((c) => ({ label: c.label, value: c.code })), [path]);

  const mark = async () => {
    const target = choices.find((c) => c.value === choice);
    if (!target) return;
    const done = await openConfirm({
      title: k("markTitle"), confirmLabel: k("markConfirm"), severity: "warning",
      message: k("markMessage", { from: path.label, to: target.label }),
      facts: [{ label: k("facts.environment"), value: target.label }, { label: k("facts.release"), value: path.release?.apiVersion || "-" }],
      onConfirm: async () => {
        const r = await environmentPromotionService.markEnvironment(choice);
        toast.current?.show({ severity: "success", summary: k("title"), detail: r.message });
      },
    });
    if (done) {
      setChoice(null);
      reload();
    }
  };

  const stepClass = (s) => `ep-step${s.current ? " ep-step--current" : s.done ? " ep-step--done" : ""}`;
  const when = (x) => (x ? `${formatInstant(x.at)}${x.by ? ` · ${x.by}` : ""}` : k("never"));

  return (
    <div className="admin__page ep-page">
      <Toast ref={toast} />
      <PageHeader title={k("pathTitle")} home={t("sidebar.Master")} section={t("sidebar.Environment Promotion")} trail={[k("pathTitle")]} help={k("pathHelp")}
        actions={<Button type="button" icon="pi pi-refresh" label={t("numberingMasters.refresh")} outlined loading={refreshing} onClick={() => reload()} />} />
      <div className="bv-loading-host">
        <LoadingBar active={loading || refreshing} />
        {error ? <p className="ep-error">{String(error)}</p> : null}
        {path ? (
          <>
            <DetailSection title={k("sections.path")}>
              <ol className="ep-path" data-testid="promotion-path">
                {path.path.map((s) => (
                  <li key={s.code} className={stepClass(s)}>
                    <span className="ep-step__position">{s.position}</span>
                    <span className="ep-step__label">{s.label}</span>
                    {s.current ? <StatusChip label={k("thisEnvironment")} severity="info" /> : null}
                  </li>
                ))}
              </ol>
              {!path.onPath ? <p className="ep-note">{k("offPath", { label: path.label })}</p> : null}
              <KeyValueGrid columns={3} items={[
                { label: k("facts.environment"), value: path.label },
                { label: k("facts.previous"), value: path.previous?.label || "-" },
                { label: k("facts.next"), value: path.next?.label || "-" },
                { label: k("facts.cutoverDate"), value: path.cutoverDate || "-" },
                { label: k("facts.goLive"), value: <StatusChip label={path.locked ? k("locked") : k("open")} severity={path.locked ? "success" : "secondary"} /> },
              ]} />
            </DetailSection>
            <DetailSection title={k("sections.release")}>
              <KeyValueGrid columns={3} items={[
                { label: k("facts.apiVersion"), value: path.release?.apiVersion || "-" },
                { label: k("facts.webVersion"), value: path.release?.webVersion || "-" },
                { label: k("facts.schema"), value: path.release?.schema || "-" },
                { label: k("facts.commit"), value: path.release?.commit || "-" },
                { label: k("facts.ref"), value: path.release?.ref || "-" },
                { label: k("facts.buildTime"), value: path.release?.buildTime ? formatInstant(path.release.buildTime) : "-" },
              ]} />
            </DetailSection>
            <DetailSection title={k("sections.activity")}>
              <KeyValueGrid columns={3} items={[
                { label: k("facts.lastExport"), value: when(path.lastExport) },
                { label: k("facts.lastLoad"), value: path.lastLoad ? `${when(path.lastLoad)} · ${path.lastLoad.fileName || ""}` : k("never") },
                { label: k("facts.lastComparison"), value: path.lastComparison ? `${when(path.lastComparison)} · ${t(`environmentPromotion.verdict.${path.lastComparison.verdict}`, { defaultValue: path.lastComparison.verdict })}` : k("never") },
              ]} />
            </DetailSection>
            {canMark ? (
              <DetailSection title={k("sections.mark")}>
                <div className="ep-mark">
                  <Dropdown value={choice} options={choices} onChange={(e) => setChoice(e.value ?? null)} placeholder={k("choose")} showClear aria-label={k("facts.environment")} className="bv-list-filter" />
                  <Button type="button" icon="pi pi-flag" label={k("mark")} disabled={!choice || choice === path.environment} onClick={mark} />
                </div>
              </DetailSection>
            ) : null}
            <DetailSection title={k("sections.history")}>
              <DataTable value={data.history || []} dataKey="id" size="small" stripedRows emptyMessage={k("noHistory")} className="fr-table" data-testid="promotion-history">
                <Column header={k("columns.file")} field="fileName" />
                <Column header={k("columns.status")} body={(r) => <StatusChip label={t(`environmentPromotion.batchStatus.${r.status}`, { defaultValue: r.status })} severity={BATCH_SEVERITY[r.status] || "secondary"} />} />
                <Column header={k("columns.rows")} field="rowsRead" />
                <Column header={k("columns.errors")} field="rowsError" />
                <Column header={k("columns.by")} field="createdBy" />
                <Column header={k("columns.when")} body={(r) => formatInstant(r.loadedAt || r.createdAt)} />
              </DataTable>
            </DetailSection>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PromotionPath;
