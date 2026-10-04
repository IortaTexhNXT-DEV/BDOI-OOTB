import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { Skeleton } from "primereact/skeleton";
import myWorkService, { errorMessage } from "../../services/myWorkService";
import { formatDate } from "../../utility/dateFormat";
import { notifyError } from "../../utility/dialogs";
import { CATEGORY_ICONS, agendaDays, groupAgenda, priorityMeta, shiftDate } from "./logic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayOf = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Calendar: the day or week agenda of the user's open tasks and of the items falling due, overdue in red. */
const Agenda = ({ state, patch, today, reloadKey, onEditTask, onNewTask }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const anchor = state.date || today;
  const days = useMemo(() => agendaDays(anchor, state.view), [anchor, state.view]);
  const [data, setData] = useState(null);
  const [late, setLate] = useState([]);

  useEffect(() => {
    let alive = true;
    setData(null);
    const from = days[0];
    const to = days[days.length - 1];
    // what is already late is shown above the days when the agenda starts today or earlier
    const withLate = from <= today;
    Promise.all([
      myWorkService.tasks({ scope: "mine", status: "open", from, to, page: 1, pageSize: 500 }),
      myWorkService.agenda({ from, to, scope: "me" }),
      withLate ? myWorkService.tasks({ scope: "mine", status: "open", due: "overdue", page: 1, pageSize: 50 }) : Promise.resolve({ rows: [] }),
      withLate ? myWorkService.items({ scope: "me", due: "overdue", page: 1, pageSize: 50 }) : Promise.resolve({ rows: [] }),
    ]).then(([tasks, agenda, lateTasks, lateItems]) => {
      if (!alive) return;
      setData(groupAgenda(tasks.rows, agenda.items, days));
      setLate([...lateTasks.rows.map((x) => ({ ...x, kindOf: "task" })), ...lateItems.rows.filter((x) => x.category !== "tasks" && x.dueDate < from).map((x) => ({ ...x, kindOf: "item" }))]);
    }).catch((e) => {
      if (alive) { setData(groupAgenda([], [], days)); setLate([]); notifyError(errorMessage(e, t("myWork.loadFailed", "My Work could not be loaded"))); }
    });
    return () => { alive = false; };
  }, [days, reloadKey, today, t]);

  const step = state.view === "day" ? 1 : 7;
  const views = [{ label: t("myWork.calendar.day", "Day"), value: "day" }, { label: t("myWork.calendar.week", "Week"), value: "week" }];
  const title = state.view === "day" ? formatDate(anchor) : `${formatDate(days[0])} - ${formatDate(days[6])}`;

  return (
    <div className="mw-agenda">
      <div className="mw-agenda__bar">
        <div className="flex gap-1 align-items-center">
          <Button icon="pi pi-chevron-left" text rounded aria-label={t("myWork.calendar.previous", "Previous")} onClick={() => patch({ date: shiftDate(anchor, -step) })} />
          <Button label={t("myWork.calendar.today", "Today")} outlined size="small" onClick={() => patch({ date: today })} />
          <Button icon="pi pi-chevron-right" text rounded aria-label={t("myWork.calendar.next", "Next")} onClick={() => patch({ date: shiftDate(anchor, step) })} />
          <span className="mw-agenda__title">{title}</span>
        </div>
        <SelectButton value={state.view} options={views} onChange={(e) => e.value && patch({ view: e.value })} />
      </div>
      {late.length > 0 && (
        <section className="mw-late" aria-label={t("myWork.calendar.overdue", "Overdue")}>
          <span className="mw-late__title"><i className="pi pi-exclamation-circle" aria-hidden="true" /> {t("myWork.calendar.overdue", "Overdue")} ({late.length})</span>
          <div className="mw-late__list">
            {late.map((x) => (
              <button key={`${x.kindOf}:${x.id}`} type="button" className="mw-entry is-late" onClick={() => (x.kindOf === "task" ? onEditTask(x) : x.link && navigate(x.link))}>
                <span className="mw-entry__time">{formatDate(x.dueDate)}{x.dueTime ? ` ${x.dueTime}` : ""}</span>
                <span className="mw-entry__text">
                  <i className={x.kindOf === "task" ? priorityMeta(x.priority).icon : CATEGORY_ICONS[x.category]} aria-hidden="true" /> {x.kindOf === "task" ? x.title : x.ref || x.kind}
                </span>
                {x.kindOf === "item" && <span className="mw-entry__sub">{x.nextAction}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className={`mw-agenda__grid mw-agenda__grid--${state.view}`}>
        {days.map((d) => {
          const entries = data?.[d];
          const past = d < today;
          return (
            <section key={d} className={`mw-day ${d === today ? "is-today" : ""} ${past ? "is-past" : ""}`} aria-label={formatDate(d)}>
              <header className="mw-day__head">
                <span className="mw-day__name">{t(`myWork.weekday.${weekdayOf(d)}`, WEEKDAYS[weekdayOf(d)])}</span>
                <span className="mw-day__date">{formatDate(d)}</span>
                <Button icon="pi pi-plus" text rounded size="small" className="mw-day__add" aria-label={t("myWork.task.new", "New task")} onClick={() => onNewTask(d)} />
              </header>
              <div className="mw-day__body">
                {!entries && <><Skeleton height="2.2rem" className="mb-2" /><Skeleton height="2.2rem" /></>}
                {entries?.tasks.map((task) => (
                  <button key={task.id} type="button" className={`mw-entry mw-entry--task ${task.overdue ? "is-late" : ""}`} onClick={() => onEditTask(task)}>
                    <span className="mw-entry__time">{task.dueTime || t("myWork.task.allDay", "All day")}</span>
                    <span className="mw-entry__text"><i className={priorityMeta(task.priority).icon} aria-hidden="true" /> {task.title}</span>
                    {task.entityRef && <span className="mw-entry__sub">{task.entityRef}</span>}
                  </button>
                ))}
                {entries?.items.map((item) => (
                  <button key={`${item.category}:${item.id}`} type="button" className={`mw-entry mw-entry--item ${item.overdue ? "is-late" : ""}`} onClick={() => item.link && navigate(item.link)}>
                    <span className="mw-entry__text"><i className={CATEGORY_ICONS[item.category]} aria-hidden="true" /> {item.ref || item.kind}</span>
                    <span className="mw-entry__sub">{item.nextAction}</span>
                  </button>
                ))}
                {entries && !entries.tasks.length && !entries.items.length && <span className="mw-day__free">{t("myWork.calendar.free", "Nothing due")}</span>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

Agenda.propTypes = {
  state: PropTypes.object.isRequired,
  patch: PropTypes.func.isRequired,
  today: PropTypes.string.isRequired,
  reloadKey: PropTypes.number,
  onEditTask: PropTypes.func.isRequired,
  onNewTask: PropTypes.func.isRequired,
};

export default Agenda;
