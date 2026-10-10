import React, { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Steps } from "primereact/steps";
import { Toast } from "primereact/toast";
import DetailSection from "../../../components/DetailSection";
import FieldError from "../../../components/FieldError";
import InputField from "../../../components/InputField";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import StatusChip from "../../../components/StatusChip";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { readableError } from "../../../utility/apiError";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { hasPermission } from "../../../utils/canOpen";
import { showSuccess } from "../../Remittance/shared";
import BatchDetailDialog from "../BatchDetailDialog";
import { BATCH_STATUSES, IncentiveHeader, WRITE, monthOptions } from "../common";

const STEPS = ["period", "programs", "review"];
const emptyRun = { period: null, description: "", programs: [] };

/** Programs that run in a month (their dates overlap it). */
const runsIn = (program, month) => month && program.startDate <= month.to && program.endDate >= month.from;

/**
 * New calculation: the month and an optional description, the active programs running in that month (a table with
 * checkboxes), then a review of what will be calculated with Run calculation.
 */
const NewCalculationDialog = ({ visible, onHide, onDone, programs, agentCount, loadError }) => {
  const { t } = useTranslation();
  const months = useMemo(() => monthOptions(12), []);
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(emptyRun);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const month = months.find((m) => m.value === run.period) || null;
  const available = programs.filter((p) => runsIn(p, month));
  const chosen = run.programs.filter((p) => available.some((a) => a.programCode === p.programCode));

  const close = () => {
    setStep(0);
    setRun(emptyRun);
    setError(null);
    onHide();
  };
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const batch = await incentiveService.createCalculation({ period: run.period, selectedPrograms: chosen.map((p) => p.programCode), description: run.description.trim() || undefined });
      setStep(0);
      setRun(emptyRun);
      onDone(batch);
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const canNext = (step === 0 && !!run.period) || (step === 1 && chosen.length > 0);
  const programColumns = [
    <Column key="program" header={t("incentive.wizard.program")} body={(p) => <span>{p.programName}<span className="inc-muted"> {p.programCode}</span></span>} />,
    <Column key="period" header={t("incentive.wizard.programPeriod")} body={(p) => `${formatDate(p.startDate)} - ${formatDate(p.endDate)}`} />,
    <Column key="measure" header={t("incentive.wizard.measure")} field="targetMetric" />,
    <Column key="frequency" header={t("incentive.wizard.frequency")} field="calculationFrequency" />,
    <Column key="agents" header={t("incentive.wizard.eligibleAgents")} body={() => agentCount} className="inc-num" headerClassName="inc-num" />,
  ];

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} outlined onClick={close} disabled={busy} />
      {step > 0 ? <Button type="button" label={t("incentive.previous")} outlined onClick={() => setStep(step - 1)} disabled={busy} /> : null}
      {step < STEPS.length - 1
        ? <Button type="button" label={t("incentive.next")} onClick={() => setStep(step + 1)} disabled={!canNext} />
        : <Button type="button" label={t("incentive.wizard.run")} onClick={start} loading={busy} disabled={!chosen.length} />}
    </>
  );

  return (
    <Dialog visible={visible} onHide={close} header={t("incentive.wizard.title")} footer={footer} modal draggable={false} resizable={false}
      className="bv-centered" style={{ width: "60rem" }} breakpoints={{ "1100px": "94vw", "640px": "100vw" }}>
      <Steps model={STEPS.map((s) => ({ label: t(`incentive.wizard.steps.${s}`) }))} activeIndex={step} className="inc-steps" />
      {step === 0 ? (
        <div className="inc-form inc-form--two">
          <div>
            <label htmlFor="inc-run-period" className="inc-form__label">{t("incentive.wizard.period")} *</label>
            <Dropdown inputId="inc-run-period" value={run.period} options={months} onChange={(e) => setRun({ ...run, period: e.value })}
              placeholder={t("incentive.wizard.choosePeriod")} className="w-full" />
          </div>
          <div>
            <label htmlFor="inc-run-description" className="inc-form__label">{t("incentive.wizard.description")}</label>
            <InputText id="inc-run-description" value={run.description} maxLength={200} onChange={(e) => setRun({ ...run, description: e.target.value })} className="w-full" />
          </div>
        </div>
      ) : null}
      {step === 1 && loadError ? <FieldError error={loadError} /> : null}
      {step === 1 ? (
        <DataTable value={available} dataKey="programCode" selectionMode="checkbox" selection={chosen} onSelectionChange={(e) => setRun({ ...run, programs: e.value })}
          size="small" emptyMessage={t("incentive.wizard.noPrograms", { period: month?.label })} className="inc-table">
          <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
          {programColumns}
        </DataTable>
      ) : null}
      {step === 2 ? (
        <>
          <KeyValueGrid columns={3} items={[
            { label: t("incentive.wizard.period"), value: month?.label },
            { label: t("incentive.wizard.from"), value: month?.from, type: "date" },
            { label: t("incentive.wizard.to"), value: month?.to, type: "date" },
            { label: t("incentive.wizard.programs"), value: chosen.length, type: "number" },
            { label: t("incentive.wizard.eligibleAgents"), value: agentCount, type: "number" },
            { label: t("incentive.wizard.description"), value: run.description.trim() },
          ]} />
          <DataTable value={chosen} dataKey="programCode" size="small" className="inc-table inc-table--spaced">
            {programColumns}
          </DataTable>
          {error ? <FieldError error={error} /> : null}
        </>
      ) : null}
    </Dialog>
  );
};

NewCalculationDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  programs: PropTypes.arrayOf(PropTypes.object).isRequired,
  agentCount: PropTypes.number.isRequired,
  loadError: PropTypes.string,
};
NewCalculationDialog.defaultProps = { loadError: null };

const Calculations = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const canWrite = hasPermission(WRITE);
  const months = useMemo(() => monthOptions(24), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const [period, setPeriod] = useState(null);
  const [creating, setCreating] = useState(false);
  const [openBatch, setOpenBatch] = useState(null);

  const listLoader = useCallback(() => incentiveService.listCalculations({ details: false }), []);
  const { data, loading, refreshing, reload } = useStableLoad(listLoader, { initialData: [] });
  const setupLoader = useCallback(async () => {
    const [programs, agents] = await Promise.all([incentiveService.listPrograms({ status: "Active" }), incentiveService.agents()]);
    return { programs, agentCount: agents.length };
  }, []);
  const setup = useStableLoad(setupLoader, { enabled: canWrite, initialData: { programs: [], agentCount: 0 } });

  const rows = (data || []).filter((c) => {
    const text = search.trim().toLowerCase();
    const matches = !text || [c.batchId, c.period, c.createdBy, c.description].some((v) => String(v || "").toLowerCase().includes(text));
    const label = months.find((m) => m.value === period)?.label;
    return matches && (!status || c.status === status) && (!period || c.period === label);
  });

  const changed = (batch, message) => {
    reload();
    if (message) showSuccess(toast, message, batch?.batchId);
  };

  return (
    <div className="inc-page">
      <Toast ref={toast} />
      <IncentiveHeader title={t("incentive.incentiveCalculations")} help={t("incentive.help.calculations")}
        actions={canWrite ? <Button type="button" label={t("incentive.newCalculation")} icon="pi pi-plus" onClick={() => setCreating(true)} /> : null} />

      <DetailSection className="bv-loading-host" flush>
        <LoadingBar active={refreshing} />
        <div className="inc-filters">
          <InputField placeholder={t("incentive.filters.searchBatches")} value={search} onChange={(e) => setSearch(e.target.value)} icon={<SvgSearchIcon />}
            aria-label={t("incentive.filters.search")} />
          <Dropdown value={status} options={BATCH_STATUSES.map((s) => ({ label: s, value: s }))} onChange={(e) => setStatus(e.value)} showClear
            placeholder={t("incentive.filters.allStatuses")} aria-label={t("incentive.filters.status")} />
          <Dropdown value={period} options={months} onChange={(e) => setPeriod(e.value)} showClear placeholder={t("incentive.filters.allPeriods")}
            aria-label={t("incentive.filters.period")} />
        </div>
        <DataTable value={rows} dataKey="batchId" loading={loading} paginator rows={20} size="small" className="inc-table" emptyMessage={t("incentive.batch.noBatches")}
          onRowClick={(e) => setOpenBatch(e.data.batchId)} rowClassName={() => "inc-row-link"}>
          <Column header={t("incentive.batch.batch")} field="batchId" />
          <Column header={t("incentive.batch.period")} field="period" />
          <Column header={t("incentive.batch.calculatedOn")} body={(c) => formatDate(c.calculationDate)} />
          <Column header={t("incentive.batch.programs")} body={(c) => (c.programsIncluded || []).length} className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.agents")} field="agentCount" className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.totalPayout")} body={(c) => formatCurrency(c.totalAmount)} className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.createdBy")} body={(c) => c.createdBy || "-"} />
          <Column header={t("incentive.batch.status")} body={(c) => <StatusChip label={c.status} />} />
          <Column header={t("incentive.batch.actions")} body={(c) => (
            <Button type="button" icon="pi pi-eye" text rounded aria-label={t("incentive.viewDetails")} tooltip={t("incentive.viewDetails")}
              onClick={(e) => { e.stopPropagation(); setOpenBatch(c.batchId); }} />
          )} />
        </DataTable>
      </DetailSection>

      {canWrite ? (
        <NewCalculationDialog visible={creating} onHide={() => setCreating(false)} programs={setup.data?.programs || []} agentCount={setup.data?.agentCount || 0}
          loadError={setup.error} onDone={(batch) => {
            setCreating(false);
            reload();
            showSuccess(toast, t("incentive.wizard.done", { batchId: batch.batchId, agents: batch.agentCount, amount: formatCurrency(batch.totalAmount) }), t("incentive.wizard.doneTitle"));
            setOpenBatch(batch.batchId);
          }} />
      ) : null}
      <BatchDetailDialog batchId={openBatch} onHide={() => setOpenBatch(null)} onChanged={changed} />
    </div>
  );
};

export default Calculations;
