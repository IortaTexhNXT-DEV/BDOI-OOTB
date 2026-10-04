import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Avatar } from "primereact/avatar";
import { Tag } from "primereact/tag";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { CATEGORY_ICONS } from "./logic";
import { ItemFilters } from "./MyItems";
import ItemsTable from "./ItemsTable";
import { SKELETON_ROWS, cell } from "./parts";

const initials = (name) => String(name || "?").split(/[\s.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

/** Reassign an item (claim handler, data subject request, task) to the manager or someone in the team. */
const ReassignDialog = ({ item, onHide, onDone }) => {
  const { t } = useTranslation();
  const [people, setPeople] = useState([]);
  const [to, setTo] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!item) return;
    setTo(null);
    myWorkService.assignees().then((list) => setPeople(list.filter((u) => u.id !== item.ownerId))).catch((e) => notifyError(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded"))));
  }, [item, t]);
  const save = async () => {
    setSaving(true);
    try {
      const r = await myWorkService.reassign({ category: item.category, id: item.id, assignTo: to });
      notifySuccess(t("myWork.reassigned", { name: r.ownerName, defaultValue: "Reassigned to {{name}}" }));
      onDone();
    } catch (e) {
      notifyError(errorMessage(e, t("myWork.reassignFailed", "The item could not be reassigned")));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog header={t("myWork.reassignTitle", { ref: item?.ref || "", defaultValue: "Reassign {{ref}}" })} visible={!!item} onHide={onHide} style={{ width: "28rem" }} breakpoints={{ "640px": "95vw" }}
      footer={(
        <div>
          <Button label={t("common.cancel", "Cancel")} text onClick={onHide} />
          <Button label={t("myWork.reassign", "Reassign")} icon="pi pi-user-edit" onClick={save} disabled={!to} loading={saving} />
        </div>
      )}>
      <div className="mw-form">
        <span className="mw-form__hint">{item?.ownerName ? t("myWork.currentOwner", { name: item.ownerName, defaultValue: "With {{name}}" }) : t("myWork.queue", "Queue")}</span>
        <label htmlFor="mw-reassign-to">{t("myWork.reassignTo", "Reassign to")}</label>
        <Dropdown inputId="mw-reassign-to" value={to} onChange={(e) => setTo(e.value)} filter
          options={people.map((u) => ({ label: u.self ? `${u.displayName} (${t("myWork.me", "me")})` : u.displayName, value: u.id }))}
          placeholder={t("myWork.choosePerson", "Choose a person")} />
      </div>
    </Dialog>
  );
};
ReassignDialog.propTypes = { item: PropTypes.object, onHide: PropTypes.func.isRequired, onDone: PropTypes.func.isRequired };

/** My Team: the open items of everyone reporting to the manager, per person, with their items below. */
const MyTeam = ({ state, patch, today, soonDays, reloadKey, onChanged }) => {
  const { t } = useTranslation();
  const [team, setTeam] = useState(null);
  const [reassign, setReassign] = useState(null);
  const [localReload, setLocalReload] = useState(0);

  useEffect(() => {
    let alive = true;
    myWorkService.team({ category: state.category })
      .then((d) => alive && setTeam(d))
      .catch((e) => { if (alive) { setTeam({ members: [], categories: [] }); notifyError(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded"))); } });
    return () => { alive = false; };
  }, [state.category, reloadKey, localReload, t]);

  const filters = useMemo(() => ({ scope: "team", assignee: state.member, category: state.category, due: state.due, priority: state.priority, search: state.search, sort: state.sort }),
    [state.member, state.category, state.due, state.priority, state.search, state.sort]);
  const members = team?.members || [];
  const cats = (team?.categories || []).filter((c) => members.some((m) => m.byCategory[c.code]));
  const categoryOptions = [{ label: t("myWork.allCategories", "All categories"), value: "" },
    ...(team?.categories || []).map((c) => ({ label: t(`myWork.category.${c.code}`, c.label), value: c.code }))];
  const selected = members.find((m) => m.userId === state.member) || null;

  return (
    <div className="mw-team">
      <DataTable value={team ? members : SKELETON_ROWS.slice(0, 4)} dataKey={team ? "userId" : "id"} size="small" className="mw-table mw-team__table" selectionMode="single"
        selection={selected} onSelectionChange={(e) => patch({ member: e.value && e.value.userId !== state.member ? e.value.userId : "" })}
        emptyMessage={t("myWork.team.empty", "Nobody reports to you")} rowHover>
        <Column header={t("myWork.team.member", "Team member")} style={{ minWidth: "13rem" }} body={cell((m) => (
          <div className="mw-person">
            <Avatar label={initials(m.name)} shape="circle" className="mw-person__avatar" />
            <div>
              <span className="mw-person__name">{m.name}</span>
              <span className="bv-cell-sub">{[m.designation, m.depth > 1 && m.managerName ? t("myWork.team.via", { name: m.managerName, defaultValue: "via {{name}}" }) : null].filter(Boolean).join(" · ") || "-"}</span>
            </div>
          </div>
        ), "60%")} />
        <Column header={t("myWork.team.open", "Open")} className="bv-num" headerClassName="bv-num" style={{ width: "5rem" }} body={cell((m) => <strong>{m.total}</strong>, "2rem")} />
        <Column header={t("myWork.team.overdue", "Overdue")} className="bv-num" headerClassName="bv-num" style={{ width: "6rem" }}
          body={cell((m) => (m.overdue ? <Tag severity="danger" value={m.overdue} /> : <span className="mw-muted">0</span>), "2rem")} />
        <Column header={t("myWork.team.dueToday", "Due today")} className="bv-num" headerClassName="bv-num" style={{ width: "6.5rem" }}
          body={cell((m) => (m.dueToday ? <Tag severity="warning" value={m.dueToday} /> : <span className="mw-muted">0</span>), "2rem")} />
        <Column header={t("myWork.team.byCategory", "By category")} style={{ minWidth: "16rem" }} body={cell((m) => (
          <div className="mw-chips">
            {cats.filter((c) => m.byCategory[c.code]).map((c) => (
              <span key={c.code} className={`mw-chip ${m.byCategory[c.code].overdue ? "mw-chip--late" : ""}`} title={t(`myWork.category.${c.code}`, c.label)}>
                <i className={c.icon || CATEGORY_ICONS[c.code]} aria-hidden="true" />{t(`myWork.category.${c.code}`, c.label)} {m.byCategory[c.code].count}
              </span>
            ))}
            {!Object.keys(m.byCategory).length && <span className="mw-muted">{t("myWork.team.clear", "Nothing open")}</span>}
          </div>
        ), "80%")} />
        <Column header={t("myWork.col.actions", "Actions")} className="bv-actions" headerClassName="bv-actions" style={{ width: "6rem" }} body={cell((m) => (
          <Button icon={state.member === m.userId ? "pi pi-filter-slash" : "pi pi-filter"} text rounded size="small"
            aria-label={t("myWork.team.showItems", "Show the items")} tooltip={t("myWork.team.showItems", "Show the items")} tooltipOptions={{ position: "top" }}
            onClick={() => patch({ member: state.member === m.userId ? "" : m.userId })} />
        ), "2rem")} />
      </DataTable>

      <div className="mw-section-head">
        <h3>{selected ? t("myWork.team.itemsOf", { name: selected.name, defaultValue: "Open items of {{name}}" }) : t("myWork.team.allItems", "Open items of the team")}</h3>
        {selected && <Button label={t("myWork.team.everyone", "Whole team")} icon="pi pi-users" text size="small" onClick={() => patch({ member: "" })} />}
      </div>
      <ItemFilters state={state} patch={patch} soonDays={soonDays}>
        <Dropdown value={state.category} options={categoryOptions} onChange={(e) => patch({ category: e.value })} className="bv-list-filter" aria-label={t("myWork.categories", "Categories")} />
      </ItemFilters>
      <ItemsTable filters={filters} listKey="my-work-team" today={today} soonDays={soonDays} showOwner reloadKey={reloadKey + localReload}
        onReassign={(row) => setReassign(row)} />
      <ReassignDialog item={reassign} onHide={() => setReassign(null)} onDone={() => { setReassign(null); setLocalReload((n) => n + 1); onChanged(); }} />
    </div>
  );
};

MyTeam.propTypes = {
  state: PropTypes.object.isRequired,
  patch: PropTypes.func.isRequired,
  today: PropTypes.string.isRequired,
  soonDays: PropTypes.number,
  reloadKey: PropTypes.number,
  onChanged: PropTypes.func.isRequired,
};

export default MyTeam;
