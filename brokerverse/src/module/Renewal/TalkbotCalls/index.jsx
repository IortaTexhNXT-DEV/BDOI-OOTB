import React, { useCallback, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import PageActions from "../../../components/PageActions";
import LoadingBar from "../../../components/LoadingBar";
import StatusChip from "../../../components/StatusChip";
import { EmptyState, FilterBar, SectionCard } from "../../../components/RecordPage";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { hasPermission } from "../../../utils/canOpen";
import { formatDate, formatInstant } from "../../../utility/dateFormat";
import talkbotService from "../../../services/talkbotService";
import { RenewalHeader } from "../shared";
import NewCallListDialog from "./NewCallListDialog";
import UploadResultsDialog from "./UploadResultsDialog";
import "./talkbot.scss";

const PER_PAGE = 20;
export const LIST_STATUSES = ["draft", "sent", "results-loaded", "closed", "cancelled"];
const SEVERITY = { draft: "secondary", sent: "info", "results-loaded": "warning", closed: "success", cancelled: "danger" };

/** Status of a call list as a chip. */
export const ListStatus = ({ status }) => {
  const { t } = useTranslation();
  return <StatusChip code={status} label={t(`talkbot.status.${status}`, status)} severity={SEVERITY[status] || "info"} />;
};
ListStatus.propTypes = { status: PropTypes.string.isRequired };

/** The page of a user without read:talkbot-calls (MSG-TBT-033). */
export const NoAccess = () => {
  const { t } = useTranslation();
  return (
    <div className="bv-ops-page talkbot-page">
      <RenewalHeader title={t("talkbot.title")} />
      <SectionCard><EmptyState icon="pi-lock" title={t("talkbot.noAccess")} /></SectionCard>
    </div>
  );
};

/** The expiry dates of a list: one date, or from - to. */
export const expiryRange = (l) => (l.expiryFrom === l.expiryTo ? formatDate(l.expiryFrom) : `${formatDate(l.expiryFrom)} - ${formatDate(l.expiryTo)}`);

/**
 * Operations > Renewals > Talkbot Calls (FR-TBT-001, 006, 010): the call lists, newest first, with the Talkbot task
 * name, the expiry dates of the accounts, the accounts, those Willing to renew and those not called yet, the renewal
 * batches made from them and the status. New call list and Upload results for the users who maintain the lists.
 */
const TalkbotCalls = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const read = hasPermission("read:talkbot-calls");
  const write = hasPermission("write:talkbot-calls");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loader = useCallback(() => talkbotService.lists({ status, search: search.trim(), page, pageSize: PER_PAGE }), [status, search, page]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { debounceMs: 300, enabled: read });
  const rows = data?.data || [];
  const open = (l) => navigate(`/renewal/talkbot/${l.id}`);

  const created = (list, message) => {
    setCreating(false);
    toast.current?.show({ severity: "success", summary: t("talkbot.new.created"), detail: message, life: 5000 });
    open(list);
  };

  if (!read) return <NoAccess />;
  return (
    <div className="bv-ops-page talkbot-page">
      <Toast ref={toast} />
      <RenewalHeader title={t("talkbot.title")}
        actions={write ? <PageActions onUpload={() => setUploading(true)} uploadLabel={t("talkbot.uploadResults")} onAdd={() => setCreating(true)} addLabel={t("talkbot.newList")} /> : null} />
      <SectionCard>
        <FilterBar active={!!(status || search)} onClear={() => { setStatus(""); setSearch(""); setPage(1); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("talkbot.searchHint")} aria-label={t("talkbot.searchHint")} />
          </span>
          <Dropdown value={status} onChange={(e) => { setStatus(e.value || ""); setPage(1); }} aria-label={t("talkbot.col.status")}
            options={[{ label: t("talkbot.allStatuses"), value: "" }, ...LIST_STATUSES.map((s) => ({ label: t(`talkbot.status.${s}`), value: s }))]} />
        </FilterBar>
        <div className="bv-loading-host">
          <LoadingBar active={refreshing} />
          <DataTable value={rows} dataKey="id" size="small" loading={loading && !data} lazy paginator={(data?.total || 0) > PER_PAGE} rows={PER_PAGE}
            totalRecords={data?.total || 0} first={(page - 1) * PER_PAGE} onPage={(e) => setPage(e.page + 1)}
            emptyMessage={<EmptyState icon="pi-phone" title={error ? t("talkbot.loadError") : t("talkbot.emptyTitle")} />}>
            <Column header={t("talkbot.col.list")} body={(l) => (
              <span className="bv-cell-stack">
                <button type="button" className="bv-link-button" onClick={() => open(l)}>{l.listNumber}</button>
                <small>{formatInstant(l.createdAt)}{l.createdBy ? ` · ${l.createdBy}` : ""}</small>
              </span>
            )} />
            <Column header={t("talkbot.col.taskName")} body={(l) => l.taskName || "-"} />
            <Column header={t("talkbot.col.expiry")} body={expiryRange} />
            <Column header={t("talkbot.col.accounts")} body={(l) => <span className="talkbot-num">{l.accounts}</span>} align="right" />
            <Column header={t("talkbot.col.willing")} body={(l) => <span className="talkbot-num">{l.willing}</span>} align="right" />
            <Column header={t("talkbot.col.notCalled")} body={(l) => <span className="talkbot-num">{l.notCalled}</span>} align="right" />
            <Column header={t("talkbot.col.batch")} body={(l) => (l.batchNumbers?.length ? l.batchNumbers.join(", ") : "-")} />
            <Column header={t("talkbot.col.status")} body={(l) => <ListStatus status={l.status} />} />
          </DataTable>
        </div>
      </SectionCard>
      {write ? (
        <>
          <NewCallListDialog visible={creating} onHide={() => setCreating(false)} onCreated={created} />
          <UploadResultsDialog visible={uploading} onHide={() => { setUploading(false); reload(); }} onDone={reload} />
        </>
      ) : null}
    </div>
  );
};

export default TalkbotCalls;
