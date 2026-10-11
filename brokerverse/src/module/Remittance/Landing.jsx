import React, { useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import LoadingBar from "../../components/LoadingBar";
import { useStableLoad } from "../../hooks/useStableLoad";
import { remittanceService } from "../../services/remittanceService";
import { canOpen } from "../../utils/canOpen";
import { REMITTANCE_ROUTES } from "./shared";
import "./remittance.scss";

/**
 * /finance/remittance: opens the page the summary names for the user (GET /remittance/summary landing): Approvals when
 * something awaits their decision, Exceptions when some are assigned to them, else Remittances > My work. A page the
 * user's menu does not reach (exceptions assigned to a role without the Exceptions entry) gives way to My work.
 */
const MY_WORK = `${REMITTANCE_ROUTES.remittances}?segment=my-work`;
export const landingOf = (summary) => {
  const link = summary?.landing?.link;
  return link && canOpen(link.split("?")[0]) ? link : MY_WORK;
};

const Landing = () => {
  const { t } = useTranslation();
  const loader = useCallback(() => remittanceService.summary(), []);
  const { data, error, reload } = useStableLoad(loader);
  if (data) return <Navigate to={landingOf(data)} replace />;
  if (error) {
    return (
      <div className="rm-page">
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.landing.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      </div>
    );
  }
  return (
    <div className="rm-page bv-loading-host">
      <LoadingBar active inline label={t("remittance.landing.loading")} />
    </div>
  );
};

export default Landing;
