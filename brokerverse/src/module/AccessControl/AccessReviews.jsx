import React, { useCallback, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import ProgressMeter from "../../components/ProgressMeter";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { hasPermission } from "../../utils/canOpen";
import AccessReviewDetail from "./AccessReviewDetail";
import ReviewStartPanel from "./ReviewStartPanel";
import { STATUS_WORDS } from "./accessReviews";
import { EmptyState, LoadError, StatusTag, TwoLines, dateTime, download, shortDate, useDirectory, useLabels, useQueryState } from "./common";
import "../Administration/index.scss";
import "./index.scss";

/**
 * Master > Users and Access > Access Reviews: confirm at least every quarter that each user still needs his or her
 * access. The list of reviews with scope, progress, removals and status; a review opens on its own page
 * (?review=<id>, the link of My Work and the notifications). Removals apply when another administrator signs the
 * review off. Exports to Excel for audit.
 */
const AccessReviews = () => {
  const k = useLabels();
  const [params, set] = useQueryState();
  const reviewId = Number(params.get("review")) || null;
  const { data: directory } = useDirectory();
  const loader = useCallback(() => accessControlService.reviews(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !reviewId });
  const [starting, setStarting] = useState(false);
  const edit = hasPermission("write:access-control");

  if (reviewId) return <AccessReviewDetail id={reviewId} directory={directory} onBack={() => set({ review: null, q: null, dept: null, outcome: null, todo: null })} />;

  const status = (r) => {
    if (r.status === "closed") return <TwoLines main={<StatusTag status="closed" label={k("review.status.closed", STATUS_WORDS.closed)} />} sub={shortDate(r.closedAt)} />;
    return (
      <span className="access-chips">
        <StatusTag status={r.status} label={k(`review.status.${r.status}`, STATUS_WORDS[r.status])} />
        {r.overdue ? <Tag severity="danger" value={k("review.overdue", "Overdue")} /> : null}
      </span>
    );
  };
  const actions = (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined disabled={!data} onClick={() => download(accessControlService.downloadReviews)} />
      {edit ? <Button label={k("startReview", "Start a review")} icon="pi pi-plus" onClick={() => setStarting(true)} /> : null}
    </>
  );

  return (
    <div className="admin__page access__page rp-page access-page">
      <PageHeader title={k("reviewsTitle", "Access Reviews")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("reviewsTitle", "Access Reviews")]} actions={actions}
        help={k("review.help", "Confirm at least every quarter that each user still needs his or her access. Removals apply when another administrator signs the review off.")} />
      <div className="rp-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <LoadError error={error} onRetry={reload} />
        <DataTable value={data || []} dataKey="id" loading={loading} size="small" className="rp-table access-table" scrollable paginator={(data || []).length > 20} rows={20}
          onRowClick={(e) => set({ review: e.data.id })} rowClassName={() => "access-row--click"}
          emptyMessage={<EmptyState icon="pi pi-verified" text={k("noReviews", "No access review yet")}
            action={edit ? <Button label={k("startReview", "Start a review")} icon="pi pi-plus" text onClick={() => setStarting(true)} /> : null} />}>
          <Column header={k("colReview", "Review")} body={(r) => <strong>{r.name}</strong>} />
          <Column header={k("review.colScope", "Scope")} body={(r) => r.scopeText} />
          <Column header={k("colDue", "Due")} body={(r) => shortDate(r.dueDate)} />
          <Column header={k("colProgress", "Progress")} body={(r) => (
            <ProgressMeter value={r.users ? Math.round(((r.users - r.pending) / r.users) * 100) : 0} tone="primary" width="8rem"
              label={k("review.progress", "{{done}} of {{total}}", { done: r.users - r.pending, total: r.users })} />
          )} />
          <Column header={k("review.colRemovals", "Removals")} body={(r) => {
            if (!r.removals) return <span className="rp-muted">0</span>;
            return r.applied ? k("review.applied", "{{count}} applied", { count: r.applied }) : k("review.toApply", "{{count}} to apply", { count: r.removals });
          }} />
          <Column header={k("colStatus", "Status")} body={status} />
          <Column header={k("colStartedBy", "Started by")} body={(r) => <TwoLines main={r.createdBy} sub={dateTime(r.createdAt)} />} />
          <Column header={k("review.signedOffBy", "Signed off by")} body={(r) => (r.signedOffBy ? <TwoLines main={r.signedOffBy} sub={dateTime(r.signedOffAt)} /> : "—")} />
        </DataTable>
      </div>
      <ReviewStartPanel visible={starting} directory={directory} onHide={() => setStarting(false)} onStarted={(id) => { setStarting(false); set({ review: id }); }} />
    </div>
  );
};

export default AccessReviews;
