import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, PageHeader, RATINGS, showDate, showDateTime, showMoney, useOptionList } from "./common";
import KycDocuments from "./KycDocuments";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Client Due Diligence > client: the AML profile of one client. Rating with the factors that scored and
 * its history, screenings and hits, authorised signatories and beneficial owners, KYC documents and EDD reviews.
 * Actions: rate again, screen now, override the rating (compliance officer), record the KYC refresh.
 */
const ClientAmlProfile = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const ratings = useOptionList(RATINGS, "rating");
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState(null);
  const [refresh, setRefresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const canApprove = hasPermission("approve:aml");
  const canWrite = hasPermission("write:aml");

  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
  const done = (m) => toast.current?.show({ severity: "success", summary: m });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setP(await amlService.profile(id));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      done(r.message);
      setOverride(null);
      setRefresh(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const c = p?.client || {};
  const latest = p?.assessments?.[0];
  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={c.displayName ? `${c.displayName} (${c.clientCode})` : t("aml.profileTitle")} intro={t("aml.profileIntro")}
        actions={<>
          <Button icon="pi pi-arrow-left" text label={t("aml.back")} onClick={() => navigate("/compliance/aml/clients")} />
          <Button icon="pi pi-id-card" outlined label={t("aml.editIdentification")} onClick={() => navigate(`/agent/client-onboarding/${c.id}`)} disabled={!c.id} />
          <Button icon="pi pi-search" outlined label={t("aml.screenNow")} loading={busy} onClick={() => act(() => amlService.screenClient(c.id))} disabled={!c.id} />
          <Button icon="pi pi-calculator" outlined label={t("aml.assess")} loading={busy} onClick={() => act(() => amlService.assess(c.id))} disabled={!c.id} />
          {canWrite ? <Button icon="pi pi-check-square" label={t("aml.completeRefresh")} onClick={() => setRefresh({ notes: "" })} disabled={!c.id} /> : null}
          {canApprove ? <Button icon="pi pi-sliders-h" severity="warning" label={t("aml.override")} onClick={() => setOverride({ rating: c.riskRating || "normal", reason: "" })} disabled={!c.id} /> : null}
        </>} />
      {loading && !p ? <p className="access__muted">{t("aml.loading")}</p> : null}
      {p ? (
        <>
          <div className="aml__summary">
            <div><label>{t("aml.colRating")}</label><AmlTag value={c.riskRating} group="rating" /> <span className="access__muted">{t("aml.scoreOf", { score: c.riskScore ?? "-" })}</span></div>
            <div><label>{t("aml.colKycStatus")}</label><AmlTag value={c.kycStatus} group="kycStatus" /></div>
            <div><label>{t("aml.colNextReview")}</label>{showDate(c.kycNextReviewOn)}</div>
            <div><label>{t("aml.lastReviewed")}</label>{showDate(c.kycReviewedOn)}</div>
            <div><label>{t("aml.colOnboardedVia")}</label>{t(`aml.onboardedVia.${c.onboardedVia}`, { defaultValue: c.onboardedVia })}</div>
            <div><label>{t("aml.colPep")}</label>{c.isPep ? t("aml.yes") : t("aml.no")}</div>
          </div>
          {p.missing?.length ? <Message severity="warn" className="w-full mb-2" text={`${t("aml.missing")}: ${p.missing.join(", ")}`} /> : null}
          {p.ownerWarnings?.map((w) => <Message key={w} severity="warn" className="w-full mb-2" text={w} />)}
          <TabView>
            <TabPanel header={t("aml.tabRating")}>
              {latest ? (
                <>
                  <p className="access__muted">{t("aml.latestAssessment", { when: showDateTime(latest.assessedAt), by: latest.assessedBy || t("aml.system"), trigger: t(`aml.trigger.${latest.trigger}`, { defaultValue: latest.trigger }) })}</p>
                  {latest.reasons?.length ? <Message severity="info" className="w-full mb-2" text={latest.reasons.join("; ")} /> : null}
                  {latest.overrideReason ? <Message severity="warn" className="w-full mb-2" text={`${t("aml.overrideReason")}: ${latest.overrideReason}`} /> : null}
                  <DataTable value={latest.factors} dataKey="factor" size="small" className="access__table mb-3">
                    <Column header={t("aml.colFactor")} body={(f) => t(`aml.factor.${f.factor}`)} />
                    <Column header={t("aml.colValue")} body={(f) => (f.factor === "premium-size" ? showMoney(f.value) : f.value)} />
                    <Column field="description" header={t("aml.colDescription")} />
                    <Column field="score" header={t("aml.colScore")} />
                  </DataTable>
                </>
              ) : <p className="access__muted">{t("aml.notRated")}</p>}
              <h4>{t("aml.history")}</h4>
              <DataTable value={p.assessments} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
                <Column header={t("aml.colDate")} body={(a) => showDateTime(a.assessedAt)} />
                <Column header={t("aml.colTrigger")} body={(a) => t(`aml.trigger.${a.trigger}`, { defaultValue: a.trigger })} />
                <Column field="score" header={t("aml.colScore")} />
                <Column header={t("aml.colComputed")} body={(a) => <AmlTag value={a.computedRating} group="rating" />} />
                <Column header={t("aml.colRating")} body={(a) => <AmlTag value={a.rating} group="rating" />} />
                <Column field="reference" header={t("aml.colReference")} />
                <Column field="assessedBy" header={t("aml.colBy")} />
              </DataTable>
            </TabPanel>
            <TabPanel header={t("aml.tabScreening")}>
              <DataTable value={p.hits} dataKey="id" size="small" className="access__table mb-3" emptyMessage={t("aml.noHits")}>
                <Column field="partyName" header={t("aml.colParty")} />
                <Column header={t("aml.colMatch")} body={(h) => `${h.matchedName} (${h.listCode})`} />
                <Column header={t("aml.colScore")} body={(h) => h.score.toFixed(2)} />
                <Column header={t("aml.colStatus")} body={(h) => <AmlTag value={h.status} group="hitStatus" />} />
                <Column field="decisionReason" header={t("aml.colReason")} />
              </DataTable>
              <DataTable value={p.screenings} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
                <Column header={t("aml.colDate")} body={(s) => showDateTime(s.screenedAt)} />
                <Column header={t("aml.colEvent")} body={(s) => t(`aml.event.${s.event}`, { defaultValue: s.event })} />
                <Column field="partyName" header={t("aml.colParty")} />
                <Column header={t("aml.colPartyType")} body={(s) => t(`aml.partyType.${s.partyType}`, { defaultValue: s.partyType })} />
                <Column field="provider" header={t("aml.colProvider")} />
                <Column header={t("aml.colStatus")} body={(s) => <AmlTag value={s.status} group="screeningStatus" />} />
                <Column field="hits" header={t("aml.colHits")} />
                <Column field="message" header={t("aml.colMessage")} />
              </DataTable>
            </TabPanel>
            {c.clientType === "corporate" ? (
              <TabPanel header={t("aml.tabParties")}>
                <h4>{t("aml.signatories")}</h4>
                <DataTable value={p.signatories} dataKey="id" size="small" className="access__table mb-3" emptyMessage={t("aml.none")}>
                  <Column field="fullName" header={t("aml.colName")} />
                  <Column field="position" header={t("aml.colPosition")} />
                  <Column header={t("aml.colAuthority")} body={(s) => `${t(`aml.authority.${s.authorityDocument}`)} ${s.authorityReference || ""} ${showDate(s.authorityDate)}`} />
                  <Column header={t("aml.colStatus")} body={(s) => t(`aml.rowStatus.${s.status}`)} />
                </DataTable>
                <h4>{t("aml.beneficialOwners", { threshold: p.beneficialOwnerThreshold })}</h4>
                <DataTable value={p.beneficialOwners} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
                  <Column field="fullName" header={t("aml.colName")} />
                  <Column header={t("aml.colOwnership")} body={(o) => (o.ownershipPercent === null ? "" : `${o.ownershipPercent}%`)} />
                  <Column header={t("aml.colControl")} body={(o) => t(`aml.control.${o.controlType}`)} />
                  <Column field="nationality" header={t("aml.colNationality")} />
                  <Column header={t("aml.colPep")} body={(o) => (o.isPep ? t("aml.yes") : "")} />
                  <Column header={t("aml.colStatus")} body={(o) => t(`aml.rowStatus.${o.status}`)} />
                </DataTable>
              </TabPanel>
            ) : null}
            <TabPanel header={t("aml.tabDocuments")}>
              <KycDocuments clientId={c.id} documents={p.documents} signatories={p.signatories} owners={p.beneficialOwners} onUploaded={load} />
            </TabPanel>
            <TabPanel header={t("aml.tabEdd")}>
              <DataTable value={p.eddReviews} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}
                selectionMode="single" onRowSelect={(e) => navigate(`/compliance/aml/edd?review=${e.data.id}`)}>
                <Column field="reviewNumber" header={t("aml.colNumber")} />
                <Column field="reason" header={t("aml.colReason")} />
                <Column header={t("aml.colStatus")} body={(e) => <AmlTag value={e.status} group="eddStatus" />} />
                <Column header={t("aml.colDecided")} body={(e) => (e.decidedAt ? `${showDateTime(e.decidedAt)} ${e.decidedBy || ""}` : "")} />
              </DataTable>
            </TabPanel>
          </TabView>
        </>
      ) : null}

      <Dialog header={t("aml.override")} visible={!!override} style={{ width: "30rem" }} modal onHide={() => setOverride(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setOverride(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={busy} disabled={(override?.reason || "").trim().length < 5} onClick={() => act(() => amlService.override(c.id, override))} />
        </>}>
        {override ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="ov-rating">{t("aml.colRating")}</label>
              <Dropdown inputId="ov-rating" value={override.rating} options={ratings} onChange={(e) => setOverride((o) => ({ ...o, rating: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="ov-reason">{t("aml.colReason")}</label>
              <InputTextarea id="ov-reason" rows={3} value={override.reason} onChange={(e) => setOverride((o) => ({ ...o, reason: e.target.value }))} />
              <small>{t("aml.overrideNote")}</small>
            </div>
          </div>
        ) : null}
      </Dialog>
      <Dialog header={t("aml.completeRefresh")} visible={!!refresh} style={{ width: "30rem" }} modal onHide={() => setRefresh(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setRefresh(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={busy} onClick={() => act(() => amlService.completeRefresh(c.id, refresh.notes))} />
        </>}>
        {refresh ? (
          <div className="admin__field">
            <label htmlFor="rf-notes">{t("aml.notes")}</label>
            <InputTextarea id="rf-notes" rows={3} value={refresh.notes} onChange={(e) => setRefresh({ notes: e.target.value })} />
            <small>{t("aml.refreshNote")}</small>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default ClientAmlProfile;
