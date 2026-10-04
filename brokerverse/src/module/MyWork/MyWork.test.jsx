import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "../../i18n";
import store from "../../redux/store";
import myWorkService from "../../services/myWorkService";
import MyWork from "./index";

jest.mock("../../services/myWorkService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => e?.message || fallback,
  default: {
    summary: jest.fn(), items: jest.fn(), team: jest.fn(), agenda: jest.fn(), assignees: jest.fn(), reassign: jest.fn(),
    tasks: jest.fn(), task: jest.fn(), createTask: jest.fn(), updateTask: jest.fn(), completeTask: jest.fn(), reopenTask: jest.fn(), cancelTask: jest.fn(), records: jest.fn(),
  },
}));

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

const renderAt = (path = "/operations/my-work") => render(
  <Provider store={store}>
    <MemoryRouter initialEntries={[path]}>
      <MyWork />
    </MemoryRouter>
  </Provider>,
);

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
  myWorkService.items.mockResolvedValue({ rows: [item], total: 1 });
  myWorkService.tasks.mockResolvedValue({ rows: [], total: 0, counts: { open: 0, overdue: 0, today: 0 } });
  myWorkService.agenda.mockResolvedValue({ items: [] });
  myWorkService.assignees.mockResolvedValue([{ id: "usr_1", displayName: "Maria Rivera", self: true }]);
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
  // no My Team tab without a team
  expect(screen.queryByText(/My Team/)).not.toBeInTheDocument();
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

test("a manager has the My Team tab with the per-person breakdown", async () => {
  myWorkService.summary.mockResolvedValue(summary(2));
  myWorkService.team.mockResolvedValue({
    categories: [{ code: "quotes", label: "Quotations", icon: "pi pi-file-edit" }],
    members: [{ userId: "usr_2", name: "Paolo Dizon", designation: "Account Executive", total: 5, overdue: 2, dueToday: 1, high: 2, byCategory: { quotes: { count: 5, overdue: 2 } }, depth: 1 }],
  });
  renderAt("/operations/my-work?tab=team");
  expect(await screen.findByText("Paolo Dizon", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(/My Team \(2\)/)).toBeInTheDocument();
  await waitFor(() => expect(myWorkService.items).toHaveBeenCalledWith(expect.objectContaining({ scope: "team" })));
});

test("a reminder link opens the task", async () => {
  myWorkService.summary.mockResolvedValue(summary());
  myWorkService.task.mockResolvedValue({ id: "tsk_1", title: "Call the client", dueDate: "2026-10-05", dueTime: "10:30", priority: "high", reminderMinutes: 60, assignedTo: "usr_1", canReassign: true });
  renderAt("/operations/my-work?tab=tasks&task=tsk_1");
  expect(await screen.findByText("Edit task", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByDisplayValue("Call the client")).toBeInTheDocument();
  expect(myWorkService.task).toHaveBeenCalledWith("tsk_1");
});
