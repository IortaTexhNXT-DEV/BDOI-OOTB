/**
 * PrimeReact Calendar with the date field of every screen.
 *
 * `import { Calendar } from "primereact/calendar"` resolves to this module (craco.config.js aliases it, like the
 * DataTable), so every date field shows the same thing without changes to the screens:
 *  - dates in the configured date format (System Settings, dd/mm/yyyy by default), whatever format a screen wrote
 *    (older screens asked for yyyy-mm-dd); a month picker shows the month and year in the same order;
 *  - the calendar button beside the field, unless the screen turns it off or the calendar is inline or a time.
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

export const Calendar = forwardRef((props, ref) => {
  const { view, timeOnly, inline, showIcon } = props;
  // only the props set here are added: an explicit undefined would replace the component's own defaults (view "date")
  const format = timeOnly ? {} : { dateFormat: viewDateFormat(view) };
  return <PrimeCalendar ref={ref} {...props} {...format} showIcon={showIcon ?? !(inline || timeOnly)} />;
});

Calendar.displayName = "Calendar";

export default Calendar;
