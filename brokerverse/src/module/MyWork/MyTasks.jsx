import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { useServerList } from "../../hooks/useServerList";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { PRIORITIES } from "./logic";
import { DueCell, PriorityTag, cell, withSkeleton } from "./parts";

/** My Tasks: the work diary of the user (or the tasks they gave to others, or their team's), with its actions. */
const MyTasks = ({ state, patch, today, soonDays, isManager, reloadKey, onEdit, onChanged }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    try {
      return await myWorkService.tasks({ scope: state.scope, status: state.status, due: state.due, priority: state.priority, search: state.search.trim(), page, pageSize });
    } catch (e) {
      throw new Error(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scope, state.status, state.due, state.priority, state.search, t, reloadKey]);
  const list = useServerList(fetchPage, { key: "my-work-tasks" });

  const act = async (fn, message) => {
    try {
      await fn();
      notifySuccess(message);
      list.reload();
      onChanged();
    } catch (e) {
      notifyError(errorMessage(e, t("myWork.task.saveFailed", "The task could not be saved")));
    }
  };
  const complete = (task) => act(() => myWorkService.completeTask(task.id), t("myWork.task.completed", "Task done"));
  const reopen = (task) => act(() => myWorkService.reopenTask(task.id), t("myWork.task.reopened", "Task reopened"));
  const cancel = async (task) => {
    const ok = await confirmAction(t("myWork.task.confirmDelete", { title: task.title, defaultValue: "Delete the task \"{{title}}\"?" }), { header: t("myWork.task.delete", "Delete task"), danger: true });
    if (ok) act(() => myWorkService.cancelTask(task.id), t("myWork.task.deleted", "Task deleted"));
  };

  const scopeOptions = [
    { label: t("myWork.taskScope.mine", "My tasks"), value: "mine" },
    { label: t("myWork.taskScope.created", "Given to others"), value: "created" },
    ...(isManager ? [{ label: t("myWork.taskScope.team", "My team's tasks"), value: "team" }] : []),
  ];
  const statusOptions = ["open", "done", "cancelled", "all"].map((s) => ({ label: t(`myWork.taskStatus.${s}`, s), value: s }));
  const dueOptions = [{ label: t("myWork.filter.anyDue", "Any due date"), value: "" },
    ...["overdue", "today", "soon", "later"].map((d) => ({ label: t(`myWork.dueFilter.${d}`, { count: soonDays, defaultValue: d }), value: d }))];
  const priorityOptions = [{ label: t("myWork.filter.anyPriority", "Any priority"), value: "" }, ...PRIORITIES.map((p) => ({ label: t(`myWork.priority.${p}`, p), value: p }))];

  return (
    <div>
      <div className="bv-list-toolbar mw-toolbar">
        <span className="p-input-icon-left bv-list-search">
          <i className="pi pi-search" />
          <InputText value={state.search} onChange={(e) => patch({ search: e.target.value })} placeholder={t("myWork.filter.searchTasks", "Search tasks")} aria-label={t("myWork.filter.searchTasks", "Search tasks")} />
        </span>
        <Dropdown value={state.scope} options={scopeOptions} onChange={(e) => patch({ scope: e.value })} className="bv-list-filter" aria-label={t("myWork.taskScope.label", "Whose tasks")} />
        <Dropdown value={state.status} options={statusOptions} onChange={(e) => patch({ status: e.value })} className="bv-list-filter" aria-label={t("myWork.col.status", "Status")} />
        <Dropdown value={state.due} options={dueOptions} onChange={(e) => patch({ due: e.value })} className="bv-list-filter" aria-label={t("myWork.col.due", "Due")} />
        <Dropdown value={state.priority} options={priorityOptions} onChange={(e) => patch({ priority: e.value })} className="bv-list-filter" aria-label={t("myWork.col.priority", "Priority")} />
      </div>
      <DataTable {...withSkeleton(list)} dataKey="id" size="small" className="mw-table" rowHover emptyMessage={list.error || t("myWork.task.empty", "No tasks")}
        rowClassName={(r) => ({ "mw-row--overdue": !r.skeleton && r.overdue, "mw-row--done": r.status && r.status !== "open" })}>
        <Column style={{ width: "3rem" }} body={cell((r) => (r.status === "open"
          ? <Button icon="pi pi-circle" text rounded size="small" className="mw-check" disabled={!r.canEdit} aria-label={t("myWork.task.markDone", "Mark done")}
              tooltip={t("myWork.task.markDone", "Mark done")} tooltipOptions={{ position: "top" }} onClick={() => complete(r)} />
          : <i className={r.status === "done" ? "pi pi-check-circle mw-done-icon" : "pi pi-times-circle mw-muted"} aria-label={t(`myWork.taskStatus.${r.status}`, r.status)} />), "1rem")} />
        <Column header={t("myWork.col.due", "Due")} style={{ width: "9rem" }} body={cell((r) => (r.status === "open"
          ? <DueCell date={r.dueDate} time={r.dueTime} today={today} soonDays={soonDays} />
          : <Tag severity={r.status === "done" ? "success" : "secondary"} value={t(`myWork.taskStatus.${r.status}`, r.status)} />))} />
        <Column header={t("myWork.col.priority", "Priority")} style={{ width: "7rem" }} body={cell((r) => <PriorityTag priority={r.priority} />, "4rem")} />
        <Column header={t("myWork.task.title", "Task")} style={{ minWidth: "16rem" }} body={cell((r) => (
          <div>
            <button type="button" className="mw-link mw-link--plain" onClick={() => onEdit(r)}>{r.title}</button>
            <span className="bv-cell-sub">
              {r.automatic ? <i className="pi pi-bolt mw-auto" aria-hidden="true" /> : null}{r.sourceLabel}{r.notes ? ` · ${r.notes}` : ""}
            </span>
          </div>
        ), "85%")} />
        <Column header={t("myWork.task.record", "Record")} style={{ minWidth: "10rem" }} body={cell((r) => (r.entity ? (
          <div>
            <button type="button" className="mw-link" disabled={!r.link} onClick={() => navigate(r.link)}>{r.entityRef || t(`myWork.record.${r.entity}`, r.entity)}</button>
            <span className="bv-cell-sub">{r.entityLabel || t(`myWork.record.${r.entity}`, r.entity)}</span>
          </div>
        ) : <span className="mw-muted">-</span>))} />
        <Column header={state.scope === "mine" ? t("myWork.task.from", "From") : t("myWork.task.assignedTo", "Assigned to")} style={{ minWidth: "9rem" }}
          body={cell((r) => (state.scope === "mine" ? (r.createdBy === r.assignedTo ? <span className="mw-muted">{t("myWork.task.self", "Self")}</span> : r.createdByName) : r.assignedToName))} />
        <Column header={<i className="pi pi-bell" aria-label={t("myWork.task.reminder", "Reminder")} />} style={{ width: "3.5rem" }}
          body={cell((r) => (r.remindAt ? <i className={r.remindedAt ? "pi pi-bell mw-muted" : "pi pi-bell mw-bell"} title={new Date(r.remindAt).toLocaleString()} /> : null), "1rem")} />
        <Column header={t("myWork.col.actions", "Actions")} className="bv-actions" headerClassName="bv-actions" style={{ width: "8rem" }} body={cell((r) => (
          <div className="flex gap-1 justify-content-end">
            {r.canEdit && r.status === "open" && <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("myWork.task.edit", "Edit task")} tooltip={t("myWork.task.edit", "Edit task")} tooltipOptions={{ position: "top" }} onClick={() => onEdit(r)} />}
            {r.canEdit && r.status !== "open" && <Button icon="pi pi-replay" text rounded size="small" aria-label={t("myWork.task.reopen", "Reopen")} tooltip={t("myWork.task.reopen", "Reopen")} tooltipOptions={{ position: "top" }} onClick={() => reopen(r)} />}
            {r.canDelete && <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("myWork.task.delete", "Delete task")} tooltip={t("myWork.task.delete", "Delete task")} tooltipOptions={{ position: "top" }} onClick={() => cancel(r)} />}
          </div>
        ), "3rem")} />
      </DataTable>
    </div>
  );
};

MyTasks.propTypes = {
  state: PropTypes.object.isRequired,
  patch: PropTypes.func.isRequired,
  today: PropTypes.string.isRequired,
  soonDays: PropTypes.number,
  isManager: PropTypes.bool,
  reloadKey: PropTypes.number,
  onEdit: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
};

export default MyTasks;
