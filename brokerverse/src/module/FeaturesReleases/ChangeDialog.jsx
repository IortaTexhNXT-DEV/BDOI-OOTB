import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { RadioButton } from "primereact/radiobutton";
import DateField from "../../components/DateField";
import DetailSection from "../../components/DetailSection";
import LoadingBar from "../../components/LoadingBar";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import featuresService from "../../services/featuresService";
import { StatusOf, TierTag } from "./shared";

const List = ({ items, empty }) => (items.length ? <ul className="fr-impact__list">{items.map((x) => <li key={x}>{x}</li>)}</ul> : <span className="fr-muted">{empty}</span>);

/**
 * Enable or disable features, or a tier bundle (Enable Phase 2): the impact preview of the server (features with their
 * dependencies, read-only where records exist, menus, roles that gain access, jobs, connectors, settings to configure)
 * and the request: reason, contract or change request reference, effective date. The request waits for a second
 * platform administrator.
 */
const ChangeDialog = ({ visible, onHide, request, onDone }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [releaseRef, setReleaseRef] = useState("");
  const [effective, setEffective] = useState("immediate");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setReleaseRef("");
    setEffective("immediate");
    setEffectiveAt("");
    setTried(false);
    setError(null);
  }, [visible, request]);

  const loader = useCallback(() => featuresService.preview(request), [request]);
  const { data: preview, loading, refreshing, error: loadError } = useStableLoad(loader, { enabled: !!(visible && request) });
  const enabling = request?.action === "enable";
  const problems = {
    releaseRef: !releaseRef.trim(),
    effectiveAt: effective === "scheduled" && !effectiveAt,
  };

  const submit = async () => {
    setTried(true);
    if (reasonProblem(reason) || problems.releaseRef || problems.effectiveAt) return;
    setBusy(true);
    setError(null);
    try {
      const r = await featuresService.requestChange({ ...request, ...reasonPayload(reason), releaseRef: releaseRef.trim(), effective,
        effectiveAt: effective === "scheduled" ? `${effectiveAt}T00:00:00+08:00` : undefined });
      onDone(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const title = request?.tier ? t(`features.change.${request.action}Tier`, { tier: t(`features.tiers.${request.tier}`) }) : t(`features.change.${request?.action || "enable"}Title`);
  const footer = (
    <>
      <Button type="button" label={t("features.common.cancel")} text onClick={onHide} disabled={busy} />
      <Button type="button" label={t("features.change.submit")} icon="pi pi-send" onClick={submit} loading={busy} disabled={!preview?.changes || busy} data-testid="submit-change" />
    </>
  );

  return (
    <Dialog visible={visible} onHide={busy ? () => {} : onHide} header={title} footer={footer} modal draggable={false} resizable={false}
      style={{ width: "960px" }} breakpoints={{ "1000px": "100vw" }} className="fr-change">
      <div className="bv-loading-host">
        <LoadingBar active={refreshing} />
        {loadError ? <div className="fr-error" role="alert">{loadError}</div> : null}
        <DataTable value={preview?.features || []} dataKey="key" size="small" loading={loading} className="fr-table" emptyMessage={t("features.empty")}>
          <Column header={t("features.columns.feature")} body={(r) => (
            <span className="fr-name">
              {r.name}
              {r.reason !== "requested" ? <StatusChip label={t(`features.change.${r.reason}`, { name: r.because })} severity="info" /> : null}
            </span>
          )} />
          <Column header={t("features.columns.tier")} body={(r) => <TierTag t={t} tier={r.tier} />} />
          <Column header={t("features.change.from")} body={(r) => <StatusOf t={t} status={r.from} />} />
          <Column header={t("features.change.to")} body={(r) => <StatusOf t={t} status={r.to} />} />
          <Column header={t("features.change.records")} body={(r) => (r.records ? r.records.toLocaleString() : "-")} align="right" />
        </DataTable>
        {preview ? (
          <div className="fr-impact">
            <DetailSection title={t("features.change.menus")}><List items={preview.menus} empty={t("features.change.none")} /></DetailSection>
            {enabling ? <DetailSection title={t("features.change.roles")}><List items={preview.roles.map((r) => r.name)} empty={t("features.change.none")} /></DetailSection> : null}
            <DetailSection title={t("features.change.jobs")}><List items={preview.jobs.map((j) => j.name)} empty={t("features.change.none")} /></DetailSection>
            <DetailSection title={t("features.change.connectors")}><List items={preview.connectors.map((c) => c.name)} empty={t("features.change.none")} /></DetailSection>
            {enabling ? <DetailSection title={t("features.change.settings")}><List items={preview.settings.map((s) => s.label)} empty={t("features.change.none")} /></DetailSection> : null}
            <DetailSection title={t("features.change.sections")}><List items={preview.sections} empty={t("features.change.none")} /></DetailSection>
            {!enabling ? (
              <DetailSection title={t("features.change.readOnly")}>
                <List items={preview.readOnly.map((r) => t("features.change.readOnlyItem", { name: r.name, count: r.records }))} empty={t("features.change.none")} />
              </DetailSection>
            ) : null}
          </div>
        ) : null}
        <div className="fr-form">
          <ReasonPicker context="feature_change" value={reason} onChange={setReason} showErrors={tried} disabled={busy} />
          <div className="fr-field">
            <label htmlFor="fr-release-ref" className="bv-field-label">{t("features.change.releaseRef")}</label>
            <InputText id="fr-release-ref" value={releaseRef} onChange={(e) => setReleaseRef(e.target.value)} disabled={busy} invalid={tried && problems.releaseRef} maxLength={60} />
            {tried && problems.releaseRef ? <small className="p-error">{t("features.change.releaseRefRequired")}</small> : null}
          </div>
          <div className="fr-field">
            <span className="bv-field-label">{t("features.change.effective")}</span>
            <div className="fr-radios">
              {["immediate", "scheduled"].map((v) => (
                <span key={v} className="fr-radio">
                  <RadioButton inputId={`fr-effective-${v}`} value={v} checked={effective === v} onChange={(e) => setEffective(e.value)} disabled={busy} />
                  <label htmlFor={`fr-effective-${v}`}>{t(`features.change.${v}`)}</label>
                </span>
              ))}
            </div>
            {effective === "scheduled" ? (
              <DateField id="fr-effective-at" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} invalid={tried && problems.effectiveAt} disabled={busy} />
            ) : null}
            {tried && problems.effectiveAt ? <small className="p-error">{t("features.change.effectiveRequired")}</small> : null}
          </div>
        </div>
        {error ? <div className="fr-error" role="alert">{error}</div> : null}
      </div>
    </Dialog>
  );
};

ChangeDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  request: PropTypes.shape({ action: PropTypes.string, features: PropTypes.arrayOf(PropTypes.string), tier: PropTypes.string }),
  onDone: PropTypes.func.isRequired,
};

export default ChangeDialog;
