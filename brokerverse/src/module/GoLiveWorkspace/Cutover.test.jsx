import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Cutover, { defaultRun, stepActions } from "./Cutover";
import { WorkspaceContext } from "./shared";
import goLiveService from "../../services/goLiveService";
import { WRITE, runRecord, signIn, step, steps } from "./testData";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../services/goLiveService", () => {
  const real = jest.requireActual("../../services/goLiveService");
  const fns = Object.fromEntries(Object.keys(real.default).filter((k) => typeof real.default[k] === "function").map((k) => [k, jest.fn()]));
  return { __esModule: true, saveFile: jest.fn(), default: { ...fns, paths: real.default.paths } };
});

const renderPage = () => render(
  <WorkspaceContext.Provider value={{ notify: jest.fn(), overview: null, reloadOverview: jest.fn() }}>
    <MemoryRouter initialEntries={["/master/configuration/go-live/cutover"]}><Cutover /></MemoryRouter>
  </WorkspaceContext.Provider>,
);
const rowOf = (code) => screen.findByRole("row", { name: new RegExp(`^${code} `) });

beforeEach(() => {
  jest.clearAllMocks();
  signIn(WRITE);
  goLiveService.runs.mockResolvedValue({ rows: [runRecord({ id: 2, kind: "mock-2", runNumber: "RUN-000002", status: "completed" }), runRecord()], total: 2, extra: {} });
  goLiveService.users.mockResolvedValue([{ userId: "usr_paolo", name: "Paolo Cruz", roles: [], canWrite: true, canApprove: false }]);
  goLiveService.stepAction.mockResolvedValue({});
});

describe("cutover checklist", () => {
  it("opens on the production run and offers each step the actions its status allows", async () => {
    goLiveService.steps.mockResolvedValue(steps([
      step({ id: 30, code: "CO-2", title: "Freeze legacy", status: "done" }),
      step({ id: 31, code: "CO-3", status: "not-started" }),
      step({ id: 32, code: "CO-4", title: "Validate", status: "not-started", waitingFor: ["CO-3"] }),
    ]));
    renderPage();
    await waitFor(() => expect(goLiveService.steps).toHaveBeenCalledWith(3));
    expect(within(await rowOf("CO-3")).getByRole("button", { name: "goLive.cutover.start" })).toBeInTheDocument();
    expect(within(await rowOf("CO-4")).queryByRole("button", { name: "goLive.cutover.start" })).toBeNull();
    expect(screen.getByText(/goLive.cutover.waitsFor/)).toBeInTheDocument();
    expect(within(await rowOf("CO-2")).queryByRole("button", { name: "goLive.cutover.markDone" })).toBeNull();
    fireEvent.click(within(await rowOf("CO-3")).getByRole("button", { name: "goLive.cutover.start" }));
    await waitFor(() => expect(goLiveService.stepAction).toHaveBeenCalledWith(3, 31, "start"));
  });

  it("marks a step done only with its evidence or a note, and CO-3 with the restore point", async () => {
    goLiveService.steps.mockResolvedValue(steps([step({ status: "in-progress", actualStart: "2026-10-31T14:02:00Z" })]));
    renderPage();
    fireEvent.click(within(await rowOf("CO-3")).getByRole("button", { name: "goLive.cutover.markDone" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.cutover.markDone" }));
    expect(await within(dialog).findByText("goLive.cutover.noteNeeded")).toBeInTheDocument();
    expect(within(dialog).getByText("goLive.cutover.restorePointRequired")).toBeInTheDocument();
    expect(goLiveService.stepAction).not.toHaveBeenCalled();
  });

  it("blocks a step with a note", async () => {
    goLiveService.steps.mockResolvedValue(steps([step({ status: "in-progress" })]));
    renderPage();
    const row = await rowOf("CO-3");
    fireEvent.click(within(row).getByRole("button", { name: "recordPage.moreActions" }));
    fireEvent.click(await screen.findByText("goLive.cutover.noted.block.confirm"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Legacy day-end still running" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "goLive.cutover.noted.block.confirm" }));
    await waitFor(() => expect(goLiveService.stepAction).toHaveBeenCalledWith(3, 31, "block", { note: "Legacy day-end still running" }));
  });

  it("chooses the run and the actions by status", () => {
    const runs = [runRecord({ id: 1, kind: "mock-1", status: "completed" }), runRecord({ id: 2, kind: "mock-2", status: "running" })];
    expect(defaultRun(runs, null)).toBe(2);
    expect(defaultRun([...runs, runRecord({ id: 3 })], null)).toBe(3);
    expect(defaultRun(runs, "1")).toBe(1);
    expect(stepActions(step({ status: "not-started" }), "planned")).toEqual({ start: false, done: false, block: false, skip: true });
    expect(stepActions(step({ status: "blocked" }), "running")).toEqual({ start: true, done: false, block: false, skip: true });
    expect(stepActions(step({ status: "in-progress" }), "running")).toEqual({ start: false, done: true, block: true, skip: false });
  });
});
