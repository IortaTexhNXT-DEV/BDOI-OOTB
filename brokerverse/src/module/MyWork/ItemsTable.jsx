import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { useServerList } from "../../hooks/useServerList";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { CATEGORY_ICONS, itemsQuery } from "./logic";
import { DueCell, PriorityTag, cell, withSkeleton } from "./parts";

/**
 * The open items of My Work (and of a team member on My Team): paged, sorted and filtered by the server. A row opens
 * its record; on My Team a row whose module supports it can be reassigned.
 */
const ItemsTable = ({ filters, listKey, today, soonDays, showOwner, onReassign, reloadKey }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();

  const fetchPage = useCallback(async (paging) => {
    try {
      return await myWorkService.items(itemsQuery(filters, paging));
    } catch (e) {
      throw new Error(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded")));
    }
    // reloadKey: refetch after a reassignment or a change made in a dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, t, reloadKey]);
  const list = useServerList(fetchPage, { key: listKey });

  const open = (row) => row.link && navigate(row.link);
  const label = (row) => t(`myWork.category.${row.category}`, { defaultValue: row.category });

  return (
    <DataTable {...withSkeleton(list)} dataKey="id" size="small" className="mw-table" rowHover
      emptyMessage={list.error || t("myWork.items.empty", "Nothing waiting here")}
      rowClassName={(row) => ({ "mw-row--overdue": !row.skeleton && row.overdue })}>
      <Column header={t("myWork.col.due", "Due")} style={{ width: "7.5rem" }}
        body={cell((r) => <DueCell date={r.dueDate} today={today} soonDays={soonDays} />)} />
      <Column header={<i className="pi pi-flag" aria-label={t("myWork.col.priority", "Priority")} title={t("myWork.col.priority", "Priority")} />} style={{ width: "3rem" }}
        body={cell((r) => <PriorityTag priority={r.priority} compact />, "1.2rem")} />
      <Column header={t("myWork.col.item", "Item")} style={{ minWidth: "10rem" }} body={cell((r) => (
        <div className="mw-item">
          <i className={CATEGORY_ICONS[r.category] || "pi pi-circle"} aria-hidden="true" title={label(r)} />
          <div>
            <button type="button" className="mw-link" onClick={() => open(r)}>{r.ref || r.kind}</button>
            <span className="bv-cell-sub">{r.ref ? r.kind : label(r)}</span>
          </div>
        </div>
      ))} />
      <Column header={t("myWork.col.client", "Client")} style={{ minWidth: "9.5rem" }} body={cell((r) => (
        <div>
          <span>{r.clientName || "-"}</span>
          {r.title && r.title !== r.nextAction ? <span className="bv-cell-sub">{r.title}</span> : null}
        </div>
      ))} />
      <Column header={t("myWork.col.nextAction", "Next action")} style={{ minWidth: "11rem" }} body={cell((r) => <span className="mw-next">{r.nextAction}</span>, "90%")} />
      <Column header={t("myWork.col.amount", "Amount")} className="bv-num" headerClassName="bv-num" style={{ width: "7.5rem" }}
        body={cell((r) => (r.amount === null || r.amount === undefined ? "-" : formatCurrency(r.amount)), "5rem")} />
      {showOwner && (
        <Column header={t("myWork.col.owner", "Owner")} style={{ minWidth: "9rem" }} body={cell((r) => (r.queue
          ? <Tag severity="secondary" value={t("myWork.queue", "Queue")} icon="pi pi-users" />
          : r.ownerName || "-"))} />
      )}
      <Column header={t("myWork.col.actions", "Actions")} className="bv-actions" headerClassName="bv-actions" style={{ width: "4.5rem" }}
        body={cell((r) => (
          <div className="flex gap-1 justify-content-end">
            {onReassign && r.reassign && (
              <Button icon="pi pi-user-edit" text rounded size="small" aria-label={t("myWork.reassign", "Reassign")} tooltip={t("myWork.reassign", "Reassign")}
                tooltipOptions={{ position: "top" }} onClick={() => onReassign(r)} />
            )}
            <Button icon="pi pi-arrow-right" text rounded size="small" aria-label={t("myWork.open", "Open")} tooltip={t("myWork.open", "Open")}
              tooltipOptions={{ position: "top" }} disabled={!r.link} onClick={() => open(r)} />
          </div>
        ), "3rem")} />
    </DataTable>
  );
};

ItemsTable.propTypes = {
  filters: PropTypes.object.isRequired,
  listKey: PropTypes.string.isRequired,
  today: PropTypes.string.isRequired,
  soonDays: PropTypes.number,
  showOwner: PropTypes.bool,
  onReassign: PropTypes.func,
  reloadKey: PropTypes.number,
};

export default ItemsTable;
