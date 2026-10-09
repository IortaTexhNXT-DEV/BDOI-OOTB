import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import claimsService from "../../services/claimsService";
import StatCards from "../../components/StatCards";
import { PageHeader, SectionCard } from "../../components/RecordPage";
import { useListState } from "../../hooks/useServerList";
import ClaimTable from "./claimTable";

const FIGURES = ["open", "pending-approval", "approved", "settled"];

/** Operations > Claims: the claims register with the number of claims at each stage (each figure filters the list). */
const ClaimsPage = () => {
  const { t } = useTranslation();
  const [state, patch] = useListState("claims", { search: "", status: "" });
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
    <div className="bv-ops-page claims-page">
      <PageHeader title={t("claims.title")} crumbs={[{ label: t("sidebar.Operations") }, { label: t("claims.title") }]} />
      <StatCards items={figures} />
      <SectionCard>
        <ClaimTable state={state} patch={patch} />
      </SectionCard>
    </div>
  );
};

export default ClaimsPage;
