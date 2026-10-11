import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import slaService from "../../services/slaService";
import ServiceLevels from "./ServiceLevels";

jest.mock("../../services/slaService", () => ({
  __esModule: true,
  default: { list: jest.fn(), clocks: jest.fn(), update: jest.fn(), run: jest.fn(), roles: jest.fn() },
}));

beforeEach(() => {
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:settings", "write:settings"]));
  slaService.list.mockResolvedValue({
    data: [
      { code: "POL-PEND", name: "Placement pending with insurer", document: "placement", targetHours: 24, workingTime: false, escalateToRoles: ["tis-ops-unit-head"], monitored: true, active: true },
      { code: "CLAIM-HANDLING", name: "Claim handling", document: "claim", targetHours: 160, workingTime: true, escalateToRoles: [], monitored: false, active: true },
    ],
    summary: { open: 2, dueSoon: 1, breached: 1 },
  });
  slaService.clocks.mockResolvedValue([{ id: 1, title: "Placement", ref: "PS-2026-0001", clientName: "J. Santos", targetName: "Placement pending with insurer", ownerName: "A. Lim", startedAt: "2026-10-09T01:00:00Z", dueAt: "2026-10-10T01:00:00Z", breachedAt: "2026-10-10T02:00:00Z" }]);
  slaService.roles.mockResolvedValue([{ code: "tis-ops-unit-head", name: "TIS Operations Unit Head" }]);
  slaService.update.mockResolvedValue({});
  slaService.run.mockResolvedValue({ opened: 0, breached: 1, escalated: 1, closed: 0 });
});

const mount = () => render(<MemoryRouter><ServiceLevels /></MemoryRouter>);

test("shows the register with the turnaround, escalation and monitoring of each line", async () => {
  mount();
  await screen.findByText("Placement pending with insurer");
  expect(screen.getByText("24 hours")).toBeInTheDocument();
  expect(screen.getByText("160 working hours")).toBeInTheDocument();
  await screen.findByText("TIS Operations Unit Head");
  expect(screen.getByText("Timed")).toBeInTheDocument();
});

test("edits a line and saves the turnaround", async () => {
  mount();
  await screen.findByText("Claim handling");
  fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
  const hours = await screen.findByLabelText("Turnaround (hours)");
  fireEvent.change(hours, { target: { value: "120" } });
  fireEvent.blur(hours);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(slaService.update).toHaveBeenCalledWith("CLAIM-HANDLING", expect.objectContaining({ targetHours: 120, workingTime: true })));
});

test("runs the monitor on request", async () => {
  mount();
  await screen.findByText("Claim handling");
  fireEvent.click(screen.getByRole("button", { name: "Run monitor" }));
  await waitFor(() => expect(slaService.run).toHaveBeenCalled());
  await waitFor(() => expect(slaService.list).toHaveBeenCalledTimes(2));
});
