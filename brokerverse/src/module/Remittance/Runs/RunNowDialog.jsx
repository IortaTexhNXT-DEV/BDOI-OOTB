import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Row } from "primereact/row";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { REMITTANCE_ROUTES, money } from "../shared";
import "../remittance.scss";

const RESULT_SEVERITY = { draft: "info", nothing: "secondary" };

/** Why the run cannot be made now (its text is shown above the verb), or null. */
export const runBlock = (preview, t) => {
  if (!preview) return null;
  if (preview.paused) return t("remittance.runNow.paused", { code: preview.schedule?.code });
  if (preview.windowDone?.done) return preview.windowDone.message;
  if (!preview.totals?.drafts) return t("remittance.runNow.nothing");
  return null;
};

/**
 * Run now (side dialog, 960px; Remittances and Setup > Schedules): the schedule, the window it covers, the off-cycle
 * reason and the server's preview per insurer with totals (a dry run, nothing is written). Nothing is created until
 * the verb "Create n draft remittances" is pressed; it is disabled, with the reason and the next run, once the window
 * has run. The result is MSG-RMT-008 with links to the drafts. With mode "preview" it is the read-only Preview run.
 */
const RunNowDialog = ({ visible, onHide, schedules, scheduleId, mode, onDone }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(scheduleId);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const running = mode === "run";

  useEffect(() => {
    if (!visible) return;
    setSelected(scheduleId);
    setReason(null);
    setTried(false);
    setError(null);
    setResult(null);
  }, [visible, scheduleId]);

  const loader = useCallback(() => remittanceService.previewRun(selected), [selected]);
  const { data: preview, loading, refreshing, error: loadError, reload } = useStableLoad(loader, { enabled: !!(visible && selected) });
  const block = runBlock(preview, t);
  const drafts = preview?.totals?.drafts || 0;

  const run = async () => {
    setTried(true);
    if (reasonProblem(reason) || block) return;
    setBusy(true);
    setError(null);
    try {
      const res = await remittanceService.runSchedule(selected, reasonPayload(reason));
      setResult({ message: res.message, ...res.data });
      if (onDone) onDone(res.data);
    } catch (e) {
      setError(e.message);
      if (e.code === "WINDOW_DONE" || e.code === "PAUSED") reload();
    } finally {
      setBusy(false);
    }
  };

  const goToDrafts = () => {
    onHide();
    navigate(`${REMITTANCE_ROUTES.remittances}?segment=drafts`);
  };

  const footer = (
    <>
      <Button type="button" label={running && !result ? t("remittance.common.cancel") : t("remittance.common.close")} text onClick={onHide} disabled={busy} />
      {running && !result ? (
        <Button type="button" label={t("remittance.runNow.create", { count: drafts })} onClick={run} loading={busy} disabled={!preview || !!block || busy} />
      ) : null}
      {result ? <Button type="button" label={t("remittance.runNow.goToDrafts")} onClick={goToDrafts} /> : null}
    </>
  );

  const totals = preview?.totals;
  const footerGroup = totals ? (
    <ColumnGroup>
      <Row>
        <Column footer={t("remittance.runNow.total")} colSpan={3} />
        <Column footer={<span className="rm-num">{totals.ready}</span>} align="right" />
        <Column footer={<span className="rm-num">{totals.held}</span>} align="right" />
        <Column footer={<span className="rm-num">{totals.exceptions}</span>} align="right" />
        <Column footer={<span className="rm-num">{money(totals.dueToInsurer)}</span>} align="right" />
        <Column footer={t("remittance.runNow.draftCount", { count: totals.drafts })} />
      </Row>
    </ColumnGroup>
  ) : null;

  const options = (schedules || []).map((s) => ({ label: `${s.code} · ${s.name}`, value: s.id }));
  const title = running ? t("remittance.runNow.title") : t("remittance.runNow.previewTitle", { code: preview?.schedule?.code || "" });

  return (
    <Dialog visible={visible} onHide={busy ? () => {} : onHide} header={title} footer={footer} modal draggable={false} resizable={false}
      style={{ width: "960px" }} breakpoints={{ "1000px": "100vw" }} className="rm-panel rm-run-now">
      <div className="rm-run-now__body bv-loading-host">
        <LoadingBar active={refreshing} />
        {result ? (
          <section className="rm-run-now__result" aria-label={t("remittance.runNow.result")} role="status">
            <p className="rm-run-now__message">{result.message}</p>
            {(result.drafts || []).length ? (
              <ul className="rm-run-now__drafts">
                {result.drafts.map((d) => (
                  <li key={d.id}>
                    <Link to={d.link} onClick={onHide}>{d.remittanceNo}</Link>
                    <span>{d.insurer}</span>
                    <span className="rm-num">{money(d.dueToInsurer)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : (
          <>
            <div className="rm-form-grid">
              {running ? (
                <div className="rm-field">
                  <label htmlFor="rm-run-schedule" className="bv-field-label">{t("remittance.runNow.schedule")}</label>
                  <Dropdown inputId="rm-run-schedule" value={selected} options={options} onChange={(e) => setSelected(e.value)} className="w-full" disabled={busy} />
                </div>
              ) : null}
              <KeyValueGrid columns={running ? 2 : 3} items={[
                { label: t("remittance.runNow.window"), value: preview?.window?.text },
                { label: t("remittance.runNow.runDate"), value: preview?.runDate, type: "date" },
                { label: t("remittance.runNow.insurers"), value: preview?.totals?.insurers, type: "number", hidden: running },
              ]} />
            </div>
            {running ? (
              <ReasonPicker context="remittance_off_cycle" value={reason} onChange={setReason} showErrors={tried} disabled={busy} className="rm-run-now__reason" />
            ) : null}
            {loadError && !preview ? (
              <div className="rm-inline-error" role="alert">
                <span>{t("remittance.runNow.loadError")}</span>
                <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
              </div>
            ) : (
              <DataTable value={preview?.rows || []} dataKey="insurer.id" size="small" loading={loading} scrollable className="rm-table"
                footerColumnGroup={footerGroup} emptyMessage={t("remittance.runNow.noInsurers")}>
                <Column header={t("remittance.runNow.insurer")} body={(r) => r.insurer?.name} />
                <Column header={t("remittance.runNow.productLine")} body={(r) => r.productLine || "-"} />
                <Column header={t("remittance.runNow.basis")} field="basis" />
                <Column header={t("remittance.runNow.ready")} body={(r) => <span className="rm-num">{r.ready}</span>} align="right" />
                <Column header={t("remittance.runNow.held")} body={(r) => <span className="rm-num">{r.held}</span>} align="right" />
                <Column header={t("remittance.runNow.exceptions")} body={(r) => <span className="rm-num">{r.exceptions}</span>} align="right" />
                <Column header={t("remittance.runNow.dueToInsurer")} body={(r) => <span className="rm-num">{money(r.dueToInsurer)}</span>} align="right" />
                <Column header={t("remittance.runNow.resultColumn")} style={{ minWidth: "11rem" }}
                  body={(r) => <StatusChip code={r.result?.code} label={r.result?.label} severity={RESULT_SEVERITY[r.result?.code]} />} />
              </DataTable>
            )}
            {totals?.nothingToRemit ? <p className="rm-muted rm-run-now__nothing">{t("remittance.runNow.nothingToRemit", { count: totals.nothingToRemit })}</p> : null}
            {running && block ? <p className="rm-run-now__block" role="status">{block}</p> : null}
            {error ? <p className="rm-run-now__error" role="alert">{error}</p> : null}
          </>
        )}
      </div>
    </Dialog>
  );
};

RunNowDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** the schedules to choose from: [{ id, code, name }] */
  schedules: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), code: PropTypes.string, name: PropTypes.string })),
  /** the schedule shown first (TIS-WEEKLY) */
  scheduleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** run: Run now with the reason and the verb; preview: Preview run, read only */
  mode: PropTypes.oneOf(["run", "preview"]),
  /** called with the run's result after drafts were created */
  onDone: PropTypes.func,
};

RunNowDialog.defaultProps = { visible: false, schedules: [], scheduleId: null, mode: "run", onDone: null };

export default RunNowDialog;
