import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DetailPageSkeleton } from "../Skeletons";
import "../ErrorBoundary/index.scss";

/**
 * What a detail screen shows until its record is there, so no screen can stay on "Loading..." for ever: the page
 * skeleton while the request runs, then either the record (children) or, when the request failed or found nothing,
 * the reason with Try again and the way back. `error` is the failed request's message; `notFound` an answer without
 * the record.
 */
const LoadState = ({ loading, error, notFound, onRetry, backLabel, onBack, children }) => {
  const { t } = useTranslation();
  if (loading) return <DetailPageSkeleton />;
  if (!error && !notFound) return children;
  return (
    <div className="bv-state" role="alert">
      <i className={`pi ${error ? "pi-exclamation-triangle" : "pi-search"} bv-state__icon`} aria-hidden="true" />
      <h2>{error ? t("common.loadFailedTitle") : t("common.notFoundTitle")}</h2>
      <p>{error || t("common.notFoundText")}</p>
      <div className="flex justify-content-center gap-2">
        {onRetry && <Button label={t("common.retry")} icon="pi pi-refresh" outlined onClick={onRetry} />}
        {onBack && <Button label={backLabel || t("common.back")} icon="pi pi-arrow-left" onClick={onBack} />}
      </div>
    </div>
  );
};

LoadState.propTypes = {
  loading: PropTypes.bool,
  error: PropTypes.string,
  notFound: PropTypes.bool,
  onRetry: PropTypes.func,
  backLabel: PropTypes.string,
  onBack: PropTypes.func,
  children: PropTypes.node,
};

export default LoadState;
