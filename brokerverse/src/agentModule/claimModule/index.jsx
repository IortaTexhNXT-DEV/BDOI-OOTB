import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { TabMenu } from "primereact/tabmenu";
import claimsService from "../../services/claimsService";
import StatCards from "../../components/StatCards";
import { PageHeader, SectionCard } from "../../components/RecordPage";
import { useListState } from "../../hooks/useServerList";
import { canOpen } from "../../utils/canOpen";
import ClaimDocuments from "../../module/OpsAccounting/ClaimDocuments";
import MotorClaimRepairs from "../../module/OpsAccounting/MotorClaimRepairs";
import ClaimTable from "./claimTable";

const FIGURES = ["open", "pending-approval", "approved", "settled"];

/**
 * The tabs of Claims: the register, the claims awaiting documents and the motor claim repairs. A tab other than the
 * register shows only to the roles its menu grant allows (Claim Documents, Motor Claim Repairs in components/SideBar/list.js).
 */
export const CLAIM_TABS = [
  { key: "claims", path: "/agent/claim" },
  { key: "documents", path: "/agent/claim/documents" },
  { key: "motorRepairs", path: "/agent/claim/motor-repairs" },
];

/** The claims register with the number of claims at each stage (each figure filters the list). */
const ClaimsRegister = () => {
  const { t } = useTranslation();
  const [state, patch] = useListState("claims", { search: "", status: "", origin: "" });
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let live = true;
    Promise.all(FIGURES.map((status) => claimsService.getClaimsList(1, 1, { status }).then((r) => [status, r.success ? (r.data?.data?.pagination?.total ?? r.data?.total ?? null) : null])))
      .then((pairs) => { if (live) setCounts(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, []);

  const figures = FIGURES.map((status) => ({
    key: status, label: t(`claimFlow.figures.${status}`), value: counts[status] ?? null,
    onClick: () => patch({ status: state.status === status ? "" : status }), active: state.status === status,
  }));

  return (
    <>
      <StatCards items={figures} />
      <SectionCard>
        <ClaimTable state={state} patch={patch} />
      </SectionCard>
    </>
  );
};

/** Policy Servicing > Claims: the register and, for the roles given them, the Awaiting Documents and Motor Repairs tabs. */
const ClaimsPage = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tabs = CLAIM_TABS.filter((tab) => tab.key === "claims" || canOpen(tab.path));
  const current = tabs.find((tab) => pathname.replace(/\/+$/, "") === tab.path) || tabs[0];
  const title = t(`claims.tabs.${current.key}`);
  return (
    <div className="bv-ops-page claims-page">
      <PageHeader title={t("claims.title")}
        crumbs={[{ label: t("sidebar.Policy Servicing") }, { label: t("claims.title") }, ...(current.key === "claims" ? [] : [{ label: title }])]} />
      {tabs.length > 1 && (
        <TabMenu model={tabs.map((tab) => ({ label: t(`claims.tabs.${tab.key}`), command: () => navigate(tab.path) }))} activeIndex={tabs.indexOf(current)}
          className="claims-page__tabs mb-3" />
      )}
      {current.key === "claims" && <ClaimsRegister />}
      {current.key === "documents" && <ClaimDocuments embedded />}
      {current.key === "motorRepairs" && <MotorClaimRepairs embedded />}
    </div>
  );
};

export default ClaimsPage;
