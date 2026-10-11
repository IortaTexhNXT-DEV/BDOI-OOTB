/**
 * PrimeReact Calendar with the date field of every screen.
 *
 * `import { Calendar } from "primereact/calendar"` resolves to this module (craco.config.js aliases it, like the
 * DataTable), so every date field shows the same thing without changes to the screens:
 *  - dates in the configured date format (System Settings, dd/mm/yyyy by default), whatever format a screen wrote
 *    (older screens asked for yyyy-mm-dd); a month picker shows the month and year in the same order;
 *  - the calendar button beside the field, unless the screen turns it off or the calendar is inline or a time;
 *  - a date can be typed: the value changes only once the text is a whole date, so a part of a date is never read as
 *    another date (15/10/2 as the year 2002) and a date already set can be typed over without the field emptying.
 * The value a screen receives is unchanged (a Date), so what is sent to the API does not change.
 */
import React, { forwardRef } from "react";
import { Calendar as PrimeCalendar } from "primereact/calendar/calendar.esm.js";
import { calendarDateFormat } from "../../utility/dateFormat";

/** The configured format for a calendar view: the date, or for a month picker the month and year ("mm/yy"). */
export const viewDateFormat = (view) => {
  const date = calendarDateFormat();
  if (view === "year") return "yy";
  if (view !== "month") return date;
  return date.replace(/d+[^a-zA-Z]*/i, "").replace(/[^a-zA-Z]+$/, "");
};

/**
 * Whether typed text is a whole date of `format` (PrimeReact tokens): as many parts as the format and, when the format
 * has a four-digit year (yy), a year of four digits.
 */
export const wholeDate = (text, format) => {
  const parts = String(text).split(/[^0-9A-Za-z]+/).filter(Boolean);
  const wanted = String(format).split(/[^A-Za-z]+/).filter(Boolean);
  if (parts.length !== wanted.length) return false;
  const year = wanted.findIndex((p) => p === "yy");
  return year < 0 || /^\d{4}$/.test(parts[year]);
};

export const Calendar = forwardRef((props, ref) => {
  const { view, timeOnly, showTime, inline, showIcon, onChange, selectionMode } = props;
  const dateFormat = viewDateFormat(view);
  // only the props set here are added: an explicit undefined would replace the component's own defaults (view "date")
  const format = timeOnly ? {} : { dateFormat };
  const typing = onChange && !timeOnly && !showTime && !inline && (!selectionMode || selectionMode === "single");
  const change = typing ? (e) => {
    const typed = e?.originalEvent?.type === "input" ? String(e.originalEvent.target?.value ?? "") : null;
    if (typed !== null && typed.trim() && !wholeDate(typed, dateFormat)) return;
    onChange(e);
  } : onChange;
  return <PrimeCalendar ref={ref} {...props} {...format} onChange={change} showIcon={showIcon ?? !(inline || timeOnly)} />;
});

Calendar.displayName = "Calendar";

export default Calendar;
