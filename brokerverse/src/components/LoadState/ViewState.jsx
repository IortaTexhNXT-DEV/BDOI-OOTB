import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import "./index.scss";

/**
 * The four states of an async view (a KPI row, a chart, a panel), from useStableLoad (hooks/useStableLoad.js):
 *
 * - loading: the `skeleton`, only before the first answer (useStableLoad gives up after 10 s, then error);
 * - loaded: the children; while a refresh runs they stay on screen under a light veil (no blanking, no skeleton);
 * - empty: one line naming why there is nothing and the next step (`empty`, a node: may hold a link);
 * - error: the reason with Retry.
 *
 * `minHeight` reserves the height of the content, so nothing jumps when the answer arrives. A request that has
 * finished never leaves a skeleton or a grey block on screen.
 */
const ViewState = ({ state, skeleton, empty, minHeight, className, children }) => {
  const { t } = useTranslation();
  const { status, refreshing, error, timedOut, reload } = state;
  const style = minHeight ? { minHeight } : undefined;
  if (status === "loading") {
    return <div className={`bv-view-state bv-view-state--loading ${className}`} style={style} aria-busy="true" data-testid="view-state" data-state="loading">{skeleton}</div>;
  }
  if (status === "error") {
    return (
      <div className={`bv-view-state bv-view-state--message bv-view-state--error ${className}`} style={style} role="alert" data-testid="view-state" data-state="error">
        <i className="pi pi-exclamation-triangle" aria-hidden="true" />
        <span>{timedOut ? t("common.loadTimeout", "This is taking too long to load.") : (error || t("common.loadFailed", "This could not be loaded."))}</span>
        {reload ? <Button type="button" label={t("common.retry", "Retry")} icon="pi pi-refresh" size="small" outlined onClick={() => reload()} /> : null}
      </div>
    );
  }
  if (status === "empty" && empty !== undefined) {
    return (
      <div className={`bv-view-state bv-view-state--message bv-view-state--empty ${className}`} style={style} role="status" data-testid="view-state" data-state="empty">
        <i className="pi pi-inbox" aria-hidden="true" />
        <span>{empty}</span>
      </div>
    );
  }
  return (
    <div className={`bv-view-state ${refreshing ? "bv-view-state--refreshing" : ""} ${className}`} style={style} aria-busy={refreshing || undefined}
      data-testid="view-state" data-state={refreshing ? "refreshing" : "loaded"}>
      {children}
    </div>
  );
};

ViewState.propTypes = {
  state: PropTypes.shape({
    status: PropTypes.oneOf(["loading", "loaded", "empty", "error"]).isRequired,
    refreshing: PropTypes.bool,
    error: PropTypes.string,
    timedOut: PropTypes.bool,
    reload: PropTypes.func,
  }).isRequired,
  skeleton: PropTypes.node,
  /** what to say when the answer holds nothing; leave out to render the children (e.g. a chart with its own empty state) */
  empty: PropTypes.node,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  children: PropTypes.node,
};
ViewState.defaultProps = { skeleton: null, empty: undefined, minHeight: undefined, className: "", children: null };

export default ViewState;
