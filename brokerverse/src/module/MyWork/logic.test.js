import {
  PRESETS, PRESET_ORDER, agendaDays, daysBetween, dueInfo, dueText, figureText, groupAgenda, itemsQuery, orderCategories, presetFor, shiftDate, tabFromSearch,
  taskPayload, validateTask, timeOf, dateOfTime,
} from "./logic";

const t = (key, opts) => {
  const o = typeof opts === "string" ? { defaultValue: opts } : opts || {};
  return String(o.defaultValue || key).replace("{{count}}", o.count);
};

describe("due dates", () => {
  it("counts calendar days across months and years", () => {
    expect(daysBetween("2026-10-04", "2026-10-04")).toBe(0);
    expect(daysBetween("2026-10-04", "2026-09-30")).toBe(-4);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(shiftDate("2026-10-30", 3)).toBe("2026-11-02");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("buckets a due date against today: overdue, today, soon, later, none", () => {
    expect(dueInfo("2026-10-01", "2026-10-04")).toMatchObject({ bucket: "overdue", days: -3, severity: "danger" });
    expect(dueInfo("2026-10-04", "2026-10-04")).toMatchObject({ bucket: "today", severity: "warning" });
    expect(dueInfo("2026-10-11", "2026-10-04", 7).bucket).toBe("soon");
    expect(dueInfo("2026-10-12", "2026-10-04", 7).bucket).toBe("later");
    expect(dueInfo(null, "2026-10-04").bucket).toBe("none");
  });

  it("words the position of a due date", () => {
    expect(dueText(dueInfo("2026-10-01", "2026-10-04"), t)).toBe("3 d overdue");
    expect(dueText(dueInfo("2026-10-04", "2026-10-04"), t)).toBe("Today");
    expect(dueText(dueInfo("2026-10-05", "2026-10-04"), t)).toBe("Tomorrow");
    expect(dueText(dueInfo("2026-10-09", "2026-10-04"), t)).toBe("In 5 d");
    expect(dueText(dueInfo(null, "2026-10-04"), t)).toBe("No due date");
  });
});

describe("agenda", () => {
  it("shows one day, or seven days from the chosen day (also across a month end)", () => {
    expect(agendaDays("2026-10-28", "week")).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(agendaDays("2026-10-07", "day")).toEqual(["2026-10-07"]);
  });

  it("puts tasks and items on their day, tasks by time (all-day first) then priority, items by priority", () => {
    const days = ["2026-10-05", "2026-10-06"];
    const tasks = [
      { id: "a", dueDate: "2026-10-05", dueTime: "14:00", priority: "normal" },
      { id: "b", dueDate: "2026-10-05", dueTime: "09:30", priority: "low" },
      { id: "c", dueDate: "2026-10-05", dueTime: null, priority: "high" },
      { id: "d", dueDate: "2026-10-09", dueTime: null, priority: "high" },
    ];
    const items = [{ id: "x", dueDate: "2026-10-06", priority: "normal" }, { id: "y", dueDate: "2026-10-06", priority: "urgent" }];
    const g = groupAgenda(tasks, items, days);
    expect(g["2026-10-05"].tasks.map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(g["2026-10-06"].items.map((x) => x.id)).toEqual(["y", "x"]);
    expect(Object.keys(g)).toEqual(days);
  });
});

describe("list query and tabs", () => {
  it("sends only the filters that are set, with the page", () => {
    expect(itemsQuery({ scope: "me", category: "", due: "overdue", search: "  QT-1 ", sort: "due" }, { page: 2, pageSize: 20 }))
      .toEqual({ scope: "me", due: "overdue", search: "QT-1", sort: "due", page: 2, pageSize: 20 });
    expect(itemsQuery({ scope: "team", assignee: "usr_1" }, { page: 1, pageSize: 50 })).toEqual({ scope: "team", assignee: "usr_1", sort: "due", page: 1, pageSize: 50 });
  });

  it("opens the tab of the address; My Team only for a manager", () => {
    expect(tabFromSearch("?tab=tasks&task=tsk_1")).toBe("tasks");
    expect(tabFromSearch("?tab=calendar")).toBe("calendar");
    expect(tabFromSearch("?tab=team")).toBe("items");
    expect(tabFromSearch("?tab=team", { isManager: true })).toBe("team");
    expect(tabFromSearch("?tab=nothing")).toBe("items");
    expect(tabFromSearch("")).toBe("items");
  });
});

describe("task form", () => {
  const form = { title: "  Call the client ", notes: "", dueDate: "2026-10-06", dueTime: "10:30", priority: "high", reminderMinutes: 30, assignedTo: "", entity: "policy", entityId: "pol_1" };

  it("builds the request body", () => {
    expect(taskPayload(form)).toEqual({ title: "Call the client", notes: null, dueDate: "2026-10-06", dueTime: "10:30", priority: "high", reminderMinutes: 30, entity: "policy", entityId: "pol_1" });
    expect(taskPayload({ ...form, assignedTo: "usr_2", entity: "", entityId: "", reminderMinutes: null })).toMatchObject({ assignedTo: "usr_2", entity: null, entityId: null, reminderMinutes: null });
  });

  it("validates the title, date, time and related record", () => {
    expect(validateTask(form)).toEqual({});
    expect(validateTask({ ...form, title: " ", dueDate: "06/10/2026", dueTime: "25:00", entityId: "" })).toEqual({
      title: "myWork.task.titleRequired", dueDate: "myWork.task.dueDateRequired", dueTime: "myWork.task.timeInvalid", entityId: "myWork.task.recordRequired",
    });
  });

  it("converts the time picker value both ways", () => {
    expect(timeOf(dateOfTime("07:05"))).toBe("07:05");
    expect(dateOfTime(null)).toBeNull();
    expect(timeOf(null)).toBeNull();
  });
});

describe("role presets of Home", () => {
  it("takes the most specific preset of the roles the user holds, else the plain My Work", () => {
    expect(presetFor(["sales"])).toBe("sales");
    expect(presetFor(["Accounting", "accounting-manager"])).toBe("accounting-manager");
    expect(presetFor(["operations", "accounting"])).toBe("accounting");
    expect(presetFor(["system-admin", "sales"])).toBe("system-admin");
    expect(presetFor(["custom-role"])).toBe("general");
    expect(presetFor(undefined)).toBe("general");
    for (const code of PRESET_ORDER) expect(PRESETS[code]).toBeDefined();
  });

  it("puts the preset's categories first and keeps the server's order for the rest, tasks last", () => {
    const summary = ["quotes", "renewals", "receivables", "claims", "approvals", "bankrec", "periodClose", "tasks"].map((code) => ({ code }));
    expect(orderCategories(summary, "accounting-manager").map((c) => c.code)).toEqual(["approvals", "periodClose", "bankrec", "receivables", "quotes", "renewals", "claims", "tasks"]);
    expect(orderCategories(summary, "sales").map((c) => c.code)).toEqual(["quotes", "renewals", "receivables", "claims", "approvals", "bankrec", "periodClose", "tasks"]);
    expect(orderCategories(summary, "general").map((c) => c.code)).toEqual(summary.map((c) => c.code));
    expect(orderCategories(undefined, "sales")).toEqual([]);
  });

  it("every preset names a default scope, the agenda categories and one primary action", () => {
    for (const code of PRESET_ORDER) {
      const p = PRESETS[code];
      expect(["me", "all"]).toContain(p.scope);
      expect(Array.isArray(p.agenda) && p.agenda.length > 0).toBe(true);
      expect(p.action.key).toBeTruthy();
      expect(!!p.action.path || !!p.action.category).toBe(true);
    }
    expect(PRESETS["accounting-manager"]).toMatchObject({ scope: "all", action: { category: "approvals" } });
    expect(PRESETS.general.action).toBeNull();
  });

  it("words a role figure: percentage, amount through the currency formatter, plain number otherwise", () => {
    const money = (v) => `PHP ${v}`;
    expect(figureText({ value: 38, format: "percent" }, money)).toBe("38%");
    expect(figureText({ value: 12500.5, format: "amount" }, money)).toBe("PHP 12500.5");
    expect(figureText({ value: 1234, format: "count" }, money, "en-US")).toBe("1,234");
    expect(figureText({ value: null, format: "days" }, money, "en-US")).toBe("0");
  });
});
