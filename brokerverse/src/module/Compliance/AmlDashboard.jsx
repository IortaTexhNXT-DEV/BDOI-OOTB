import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { PageHeader, StatTile } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > AML Dashboard: the compliance officer's counts (clients by risk rating, screening hits, EDD reviews,
 * KYC refreshes, transaction alerts, cases and report files); each tile opens the list behind it.
 */
const AmlDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [d, setD] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setD(await amlService.dashboard());
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const r = d.ratings || {};
  const tiles = (items) => (
    <div className="access__stats">
      {items.map(([key, value, path]) => <StatTile key={key} value={value} label={t(`aml.dash.${key}`)} loading={loading} onClick={() => navigate(path)} />)}
    </div>
  );

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.dashboardTitle")} intro={t("aml.dashboardIntro")} actions={<Button icon="pi pi-refresh" text label={t("aml.refresh")} onClick={load} />} />
      {d.listsWithoutVersion ? <Message severity="warn" className="w-full mb-3" text={t("aml.dash.listsMissing", { count: d.listsWithoutVersion })} /> : null}
      <h3 className="aml__section">{t("aml.dash.clients")}</h3>
      {tiles([
        ["high", r.high, "/compliance/aml/clients?rating=high"], ["normal", r.normal, "/compliance/aml/clients?rating=normal"], ["low", r.low, "/compliance/aml/clients?rating=low"],
        ["unrated", r.unrated, "/compliance/aml/clients?rating=unrated"], ["refreshDue", d.refreshDue, "/compliance/aml/kyc-refresh"], ["refreshOverdue", d.refreshOverdue, "/compliance/aml/kyc-refresh?overdue=true"],
      ])}
      <h3 className="aml__section">{t("aml.dash.reviews")}</h3>
      {tiles([
        ["openHits", d.openHits, "/compliance/aml/hits"], ["escalatedHits", d.escalatedHits, "/compliance/aml/hits?status=escalated"], ["confirmedHits", d.confirmedHits, "/compliance/aml/hits?status=confirmed"],
        ["eddOpen", d.eddOpen, "/compliance/aml/edd"], ["eddSubmitted", d.eddSubmitted, "/compliance/aml/edd?status=submitted"], ["providerFailures", d.providerFailures, "/compliance/aml/lists"],
      ])}
      <h3 className="aml__section">{t("aml.dash.transactions")}</h3>
      {tiles([
        ["coveredOpen", d.coveredOpen, "/compliance/aml/alerts?kind=covered"], ["suspiciousOpen", d.suspiciousOpen, "/compliance/aml/alerts?kind=suspicious"],
        ["casesOpen", d.casesOpen, "/compliance/aml/cases"], ["casesOverdue", d.casesOverdue, "/compliance/aml/cases"], ["reportsToSubmit", d.reportsToSubmit, "/compliance/aml/reports"],
      ])}
    </div>
  );
};

export default AmlDashboard;
