import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, HIT_STATUSES, PageHeader, PartyCell, showDateTime, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Screening Hits: potential matches of clients, beneficial owners, signatories and payees against the
 * sanctions, PEP and negative lists (and the provider). The compliance officer clears a false positive, escalates to a
 * case or confirms a true match (client blocked and rated High), always with a reason; every decision is audited.
 * Screen a name checks a prospect or payee who is not a client yet.
 */
const ScreeningHits = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const statuses = useOptionList(HIT_STATUSES, "hitStatus");
  const decisions = useOptionList(["clear", "escalate", "confirm"], "decision");
  const [filters, setFilters] = useState({ status: params.get("status") || "open", search: "" });
  const [rows, setRows] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(null);
  const [screening, setScreening] = useState(null);
  const [saving, setSaving] = useState(false);
  const canDecide = hasPermission("approve:aml");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.hits(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);

  const openDecision = async (hit) => {
    setDeciding({ hit, decision: "clear", reason: "", caseId: null });
    try {
      setCases((await amlService.cases({ status: "open,for-filing" })).map((c) => ({ value: c.id, label: `${c.caseNumber} ${c.title}` })));
    } catch {
      setCases([]);
    }
  };
  const decide = async () => {
    setSaving(true);
    try {
      const r = await amlService.decideHit(deciding.hit.id, { decision: deciding.decision, reason: deciding.reason.trim(), caseId: deciding.caseId || undefined });
      toast.current?.show({ severity: "success", summary: r.message });
      setDeciding(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const screen = async () => {
    setSaving(true);
    try {
      const r = await amlService.screenName({ name: screening.name.trim(), birthDate: screening.birthDate || undefined });
      toast.current?.show({ severity: r.data?.hits ? "warn" : "success", summary: r.message });
      setScreening(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  const h = deciding?.hit;
  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.hitsTitle")} intro={t("aml.hitsIntro")}
        actions={hasPermission("write:aml") ? <Button icon="pi pi-search" label={t("aml.screenName")} onClick={() => setScreening({ name: "", birthDate: "" })} /> : null} />
      <div className="admin__filters">
        <Dropdown value={filters.status} options={statuses} showClear placeholder={t("aml.colStatus")} onChange={(e) => setFilters((f) => ({ ...f, status: e.value || null }))} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("aml.searchHits")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.noHits")}>
        <Column header={t("aml.colDate")} body={(r) => showDateTime(r.createdAt)} />
        <Column header={t("aml.colParty")} body={(r) => (
          <PartyCell name={r.partyName} code={`${t(`aml.partyType.${r.partyType}`, { defaultValue: r.partyType })}${r.clientCode ? ` · ${r.clientCode}` : ""}`} />
        )} />
        <Column header={t("aml.colMatch")} body={(r) => <PartyCell name={r.matchedName} code={`${r.listName || r.listCode}${r.entryRef ? ` · ${r.entryRef}` : ""}`} />} />
        <Column header={t("aml.colScore")} sortable field="score" body={(r) => r.score.toFixed(2)} />
        <Column header={t("aml.colEvent")} body={(r) => t(`aml.event.${r.event}`, { defaultValue: r.event })} />
        <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="hitStatus" />} />
        <Column header={t("aml.colDecision")} body={(r) => (r.decidedAt ? `${r.decisionReason || ""} (${r.decidedBy || ""})` : "")} />
        <Column header="" style={{ width: "12rem" }} body={(r) => (
          <div className="aml__row-actions">
            {r.clientId ? <Button icon="pi pi-user" text rounded size="small" aria-label={t("aml.openProfile")} tooltip={t("aml.openProfile")} onClick={() => navigate(`/compliance/aml/clients/${r.clientId}`)} /> : null}
            {canDecide && ["open", "escalated"].includes(r.status) ? <Button label={t("aml.decide")} size="small" onClick={() => openDecision(r)} /> : null}
          </div>
        )} />
      </DataTable>

      <Dialog header={t("aml.decideHit")} visible={!!deciding} style={{ width: "40rem" }} modal onHide={() => setDeciding(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setDeciding(null)} />
          <Button label={t("aml.confirm")} icon="pi pi-check" loading={saving} disabled={(deciding?.reason || "").trim().length < 5} onClick={decide} />
        </>}>
        {h ? (
          <div className="admin__grid admin__grid--single">
            <div className="aml__compare">
              <div><label>{t("aml.colParty")}</label><strong>{h.partyName}</strong><span>{h.clientName ? `${h.clientName} (${h.clientCode})` : ""}</span></div>
              <div><label>{t("aml.colMatch")}</label><strong>{h.matchedName}</strong>
                <span>{[h.listName || h.listCode, h.entryRef, h.details?.birthDate, h.details?.nationality, h.details?.remarks].filter(Boolean).join(" · ")}</span></div>
              <div><label>{t("aml.colScore")}</label><strong>{h.score.toFixed(2)}</strong></div>
            </div>
            <div className="admin__field">
              <label htmlFor="hit-decision">{t("aml.colDecision")}</label>
              <SelectButton id="hit-decision" value={deciding.decision} options={decisions} allowEmpty={false} onChange={(e) => setDeciding((d) => ({ ...d, decision: e.value }))} />
              <small>{t(`aml.decisionHelp.${deciding.decision}`)}</small>
            </div>
            {deciding.decision === "escalate" ? (
              <div className="admin__field">
                <label htmlFor="hit-case">{t("aml.case")}</label>
                <Dropdown inputId="hit-case" value={deciding.caseId} options={cases} showClear placeholder={t("aml.newReviewCase")} onChange={(e) => setDeciding((d) => ({ ...d, caseId: e.value || null }))} />
              </div>
            ) : null}
            <div className="admin__field">
              <label htmlFor="hit-reason">{t("aml.colReason")}</label>
              <InputTextarea id="hit-reason" rows={3} value={deciding.reason} onChange={(e) => setDeciding((d) => ({ ...d, reason: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.screenName")} visible={!!screening} style={{ width: "30rem" }} modal onHide={() => setScreening(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setScreening(null)} />
          <Button label={t("aml.screen")} icon="pi pi-search" loading={saving} disabled={(screening?.name || "").trim().length < 2} onClick={screen} />
        </>}>
        {screening ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="sn-name">{t("aml.colName")}</label>
              <InputText id="sn-name" value={screening.name} onChange={(e) => setScreening((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="sn-dob">{t("aml.birthYear")}</label>
              <InputText id="sn-dob" value={screening.birthDate} onChange={(e) => setScreening((s) => ({ ...s, birthDate: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default ScreeningHits;
