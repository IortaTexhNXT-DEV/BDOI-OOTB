import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import "../../i18n";
import store from "../../redux/store";
import myWorkService from "../../services/myWorkService";
import { fetchFigures } from "./figures";
import MyWork from "./index";

jest.mock("../../services/myWorkService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => e?.message || fallback,
  default: {
    summary: jest.fn(), items: jest.fn(), team: jest.fn(), agenda: jest.fn(), assignees: jest.fn(), reassign: jest.fn(),
    tasks: jest.fn(), task: jest.fn(), createTask: jest.fn(), updateTask: jest.fn(), completeTask: jest.fn(), reopenTask: jest.fn(), cancelTask: jest.fn(), records: jest.fn(),
  },
}));
jest.mock("./figures", () => ({ __esModule: true, fetchFigures: jest.fn() }));

const summary = (team = 0) => ({
  asOf: "2026-10-04", scope: "me", dueSoonDays: 7,
  totals: { open: 9, overdue: 3, dueToday: 2, dueSoon: 4, high: 3 },
  categories: [
    { code: "quotes", label: "Quotations", icon: "pi pi-file-edit", count: 4, overdue: 1, dueToday: 0, dueSoon: 2, high: 1 },
    { code: "approvals", label: "Approvals", icon: "pi pi-check-square", count: 3, overdue: 2, dueToday: 1, dueSoon: 0, high: 2 },
    { code: "tasks", label: "Tasks", icon: "pi pi-calendar", count: 2, overdue: 0, dueToday: 1, dueSoon: 2, high: 0 },
  ],
  team: { size: team, isManager: team > 0 },
});
const item = {
  category: "quotes", kind: "Awaiting customer response", id: "qt_1", ref: "QT-2026-00012", title: "Private Car", clientName: "Maria Santos", dueDate: "2026-10-01",
  overdue: true, priority: "high", status: "sent", nextAction: "Follow up the customer's response", ownerId: "usr_1", link: "/agent/quotedetailview/qt_1", amount: 18250.5,
};
const figures = (preset = "sales") => ({
  asOf: "2026-10-04", preset, roleCode: preset, roleName: "Sales & Marketing (Account Executive)", firstName: "Maria", branch: "Makati", company: "BrokerVerse",
  figures: [{ key: "quotesMonth", label: "Quotes this month", value: 12, format: "count" }, { key: "conversion", label: "Conversion (90 days)", value: 38, format: "percent" }],
});

const renderAt = (path = "/operations/my-work") => render(
  <Provider store={store}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agent/home" element={<MyWork />} />
        <Route path="/operations/my-work" element={<MyWork />} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
    </MemoryRouter>
  </Provider>,
);
const signInAs = (...roles) => window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));

// the first render of a suite loads the PrimeReact styles, which takes a few seconds on a loaded machine
jest.setTimeout(20000);

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  jest.clearAllMocks();
  signInAs("sales");
  myWorkService.items.mockResolvedValue({ rows: [item], total: 1 });
  myWorkService.tasks.mockResolvedValue({ rows: [], total: 0, counts: { open: 0, overdue: 0, today: 0 } });
  myWorkService.agenda.mockResolvedValue({ items: [] });
  myWorkService.assignees.mockResolvedValue([{ id: "usr_1", displayName: "Maria Rivera", self: true }]);
  fetchFigures.mockResolvedValue(figures());
});

test("shows the header figures, the categories with counts and the user's items", async () => {
  myWorkService.summary.mockResolvedValue(summary());
  renderAt();
  expect(await screen.findByText("QT-2026-00012", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText("Follow up the customer's response")).toBeInTheDocument();
  expect(screen.getByText("3 d overdue")).toBeInTheDocument();
  const rail = screen.getByRole("navigation", { name: "Categories" });
  await waitFor(() => expect(within(rail).getByRole("button", { name: /Quotations/ })).toHaveTextContent("4"), { timeout: 5000 });
  // the open tasks are part of everything waiting on the user
  expect(within(rail).getByRole("button", { name: /Tasks/ })).toHaveTextContent("2");
  expect(within(rail).getByRole("button", { name: /All items/ })).toHaveTextContent("9");
  expect(myWorkService.items).toHaveBeenCalledWith(expect.objectContaining({ scope: "me", sort: "due", page: 1, pageSize: 20 }));
  // no My Team tab nor "My team" scope without a team
  expect(screen.queryByText(/My Team/)).not.toBeInTheDocument();
  expect(screen.queryByText("My team")).not.toBeInTheDocument();
});

test("Home: the role subtitle, the role figures next to the My Work figures and the role's primary action", async () => {
  myWorkService.summary.mockResolvedValue(summary());
  renderAt("/agent/home");
  expect(await screen.findByText("Sales | 04/10/2026 | Makati", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText("Quotes this month")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("38%")).toBeInTheDocument();
  // the breadcrumb says Home here, Operations on the menu address
  expect(screen.getByText("Home")).toBeInTheDocument();
  // one primary action: a sales user opens a new quote; refresh and New task stay secondary
  fireEvent.click(screen.getByRole("button", { name: /New quote/ }));
  expect(await screen.findByTestId("elsewhere")).toBeInTheDocument();
});

test("the accounting manager preset lists the approvals first, looks at everyone's items and opens the approvals from the primary action", async () => {
  signInAs("accounting", "accounting-manager");
  fetchFigures.mockResolvedValue({ ...figures("accounting-manager"), branch: null, figures: [{ key: "overdueReceivables", label: "Overdue receivables", value: 125000, format: "amount" }] });
  myWorkService.summary.mockResolvedValue({ ...summary(), scope: "all" });
  renderAt("/agent/home");
  const rail = await screen.findByRole("navigation", { name: "Categories" }, { timeout: 5000 });
  // the category entries of the rail (the scope buttons above them are left out)
  const entries = () => within(rail).getAllByRole("button").filter((b) => b.classList.contains("mw-rail__item")).map((b) => b.textContent);
  await waitFor(() => expect(entries()).toEqual([expect.stringContaining("All items"), expect.stringContaining("Approvals"), expect.stringContaining("Quotations"), expect.stringContaining("Tasks")]), { timeout: 5000 });
  await waitFor(() => expect(myWorkService.items).toHaveBeenCalledWith(expect.objectContaining({ scope: "all" })));
  expect(await screen.findByText("Accounting Manager | 04/10/2026 | BrokerVerse")).toBeInTheDocument();
  expect(screen.getByText("Overdue receivables")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Approvals$/ }));
  await waitFor(() => expect(myWorkService.items).toHaveBeenLastCalledWith(expect.objectContaining({ category: "approvals" })));
});

test("a category and a header figure filter the list on the server", async () => {
  myWorkService.summary.mockResolvedValue(summary());
  renderAt();
  const rail = await screen.findByRole("navigation", { name: "Categories" }, { timeout: 5000 });
  fireEvent.click(await within(rail).findByRole("button", { name: /Approvals/ }, { timeout: 5000 }));
  await waitFor(() => expect(myWorkService.items).toHaveBeenLastCalledWith(expect.objectContaining({ category: "approvals" })));
  fireEvent.click(screen.getByRole("button", { name: /Overdue/ }));
  await waitFor(() => expect(myWorkService.items).toHaveBeenLastCalledWith(expect.objectContaining({ due: "overdue" })));
});

test("a manager has the My Team tab with the per-person breakdown and the My team scope on My Items", async () => {
  myWorkService.summary.mockResolvedValue(summary(2));
  myWorkService.team.mockResolvedValue({
    categories: [{ code: "quotes", label: "Quotations", icon: "pi pi-file-edit" }],
    members: [{ userId: "usr_2", name: "Paolo Dizon", designation: "Account Executive", total: 5, overdue: 2, dueToday: 1, high: 2, byCategory: { quotes: { count: 5, overdue: 2 } }, depth: 1 }],
  });
  renderAt("/operations/my-work?tab=team");
  expect(await screen.findByText("Paolo Dizon", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(/My Team \(2\)/)).toBeInTheDocument();
  await waitFor(() => expect(myWorkService.items).toHaveBeenCalledWith(expect.objectContaining({ scope: "team" })));
  fireEvent.click(screen.getByRole("tab", { name: /My Items/ }));
  const scope = await screen.findByRole("group", { name: "Whose items" }, { timeout: 5000 });
  fireEvent.click(within(scope).getByText("My team"));
  await waitFor(() => expect(myWorkService.summary).toHaveBeenCalledWith("team"));
});

test("a reminder link opens the task", async () => {
  myWorkService.summary.mockResolvedValue(summary());
  myWorkService.task.mockResolvedValue({ id: "tsk_1", title: "Call the client", dueDate: "2026-10-05", dueTime: "10:30", priority: "high", reminderMinutes: 60, assignedTo: "usr_1", canReassign: true });
  renderAt("/operations/my-work?tab=tasks&task=tsk_1");
  expect(await screen.findByText("Edit task", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByDisplayValue("Call the client")).toBeInTheDocument();
  expect(myWorkService.task).toHaveBeenCalledWith("tsk_1");
});

test("the calendar asks only for the categories of the role preset", async () => {
  signInAs("claims");
  fetchFigures.mockResolvedValue(figures("claims"));
  myWorkService.summary.mockResolvedValue(summary());
  renderAt("/agent/home?tab=calendar");
  await waitFor(() => expect(myWorkService.agenda).toHaveBeenCalledWith(expect.objectContaining({ scope: "me", category: "claims,approvals" })), { timeout: 5000 });
});
