import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import adminService from "../../services/adminService";
import SecurityControls from "./SecurityControls";

jest.mock("../../services/adminService", () => ({
  __esModule: true,
  default: { getControls: jest.fn(), getControlEvidence: jest.fn(), recordControlEvidence: jest.fn() },
}));

const controls = () => ({
  data: [
    { key: "idle-timeout", kind: "enforced", group: "access", groupLabel: "Sign-in and sessions", name: "Idle session timeout", requirements: ["TIS-BRD-NFR-03"], current: "30 minutes", target: "3 minutes", status: "review", evidence: null, managedBy: { screen: "Configuration", path: "/master/configuration/settings" } },
    { key: "backups", kind: "evidence", group: "operations", groupLabel: "Operations and resilience", name: "Backups and restore drills", requirements: ["TIS-BRD-NFR-12"], current: "Evidence recorded", target: "Daily backup, quarterly restore drill", status: "met", evidence: { evidenceDate: "2026-10-01", reference: "Backup report 2026-09" } },
  ],
  groups: [{ code: "access", label: "Sign-in and sessions" }, { code: "operations", label: "Operations and resilience" }],
  results: ["met", "not-met", "review"],
});

beforeEach(() => {
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:settings", "write:settings"]));
  adminService.getControls.mockResolvedValue(controls());
  adminService.getControlEvidence.mockResolvedValue([{ id: 1, controlKey: "backups", evidenceDate: "2026-10-01", result: "met", reference: "Backup report 2026-09", remarks: null, recordedBy: "IT AppSupport", recordedAt: "2026-10-01T02:00:00Z" }]);
  adminService.recordControlEvidence.mockResolvedValue({ id: 2 });
});

const mount = () => render(<MemoryRouter><SecurityControls /></MemoryRouter>);

test("lists the controls by group with their status and the latest evidence", async () => {
  mount();
  await screen.findByText("Idle session timeout");
  expect(screen.getByText("Backups and restore drills")).toBeInTheDocument();
  expect(screen.getByText(/Backup report 2026-09/)).toBeInTheDocument();
  expect(screen.getAllByText("Met").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Review").length).toBeGreaterThan(0);
});

test("opens a control and records evidence", async () => {
  mount();
  await screen.findByText("Backups and restore drills");
  fireEvent.click(screen.getAllByRole("button", { name: "Record evidence" })[0]);
  const reference = await screen.findByLabelText("Reference");
  fireEvent.change(reference, { target: { value: "Restore drill 2026-10" } });
  const buttons = screen.getAllByRole("button", { name: "Record evidence" });
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(adminService.recordControlEvidence).toHaveBeenCalledWith("backups", expect.objectContaining({ reference: "Restore drill 2026-10", result: "met" })));
});
