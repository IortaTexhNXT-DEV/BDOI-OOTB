import React from "react";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../ErrorBoundary/index.scss";

/** Shown for the address of a function this environment does not run (features/entitlements.js). */
const NotInEdition = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="bv-state" role="alert" data-testid="not-in-edition">
      <i className="pi pi-lock bv-state__icon" aria-hidden="true" />
      <h2>{t("features.notInEdition.title")}</h2>
      <p>{t("features.notInEdition.text")}</p>
      <Button label={t("features.notInEdition.home")} icon="pi pi-home" onClick={() => navigate("/")} />
    </div>
  );
};

export default NotInEdition;
