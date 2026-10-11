import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import promotionService from "../../../services/promotionService";
import PromotionPath from "./PromotionPath";

jest.mock("../../../services/promotionService", () => ({
  __esModule: true,
  default: { getPath: jest.fn(), getHistory: jest.fn(), markEnvironment: jest.fn() },
}));

const path = (extra = {}) => ({
  environment: "uat", label: "User Acceptance Testing", onPath: true,
  previous: { code: "sit", label: "System Integration Testing" }, next: { code: "preprod", label: "Pre-Production" },
  path: [
    { code: "dev", label: "Development", position: 1, current: false, done: true },
    { code: "sit", label: "System Integration Testing", position: 2, current: false, done: true },
    { code: "uat", label: "User Acceptance Testing", position: 3, current: true, done: false },
    { code: "preprod", label: "Pre-Production", position: 4, current: false, done: false },
    { code: "production", label: "Production", position: 5, current: false, done: false },
  ],
  choices: [{ code: "dev", label: "Development" }, { code: "uat", label: "User Acceptance Testing" }, { code: "preprod", label: "Pre-Production" }],
  release: { apiVersion: "2026.1.3", webVersion: null, commit: "a1b2c3d", ref: null, buildTime: null, schema: "0595" },
  cutoverDate: "2026-11-01", locked: false,
  lastExport: { at: "2026-10-10T02:00:00Z", by: "it.admin" }, lastLoad: null, lastComparison: null,
  ...extra,
});

beforeEach(() => {
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:data-load", "write:data-load"]));
  promotionService.getPath.mockResolvedValue(path());
  promotionService.getHistory.mockResolvedValue([{ id: 7, fileName: "Setup_Workbook.xlsx", status: "loaded", rowsRead: 412, rowsError: 0, createdBy: "IT AppSupport", createdAt: "2026-10-10T02:05:00Z" }]);
  promotionService.markEnvironment.mockResolvedValue({ message: "Environment marked as Pre-Production" });
});

const mount = () => render(<MemoryRouter><ConfirmDialogHost /><PromotionPath /></MemoryRouter>);

test("shows the path with this environment marked, the release and the loads", async () => {
  mount();
  await screen.findByTestId("promotion-path");
  const steps = screen.getAllByRole("listitem").filter((li) => li.className.includes("ep-step"));
  expect(steps).toHaveLength(5);
  expect(steps[2].className).toContain("ep-step--current");
  expect(screen.getByText("This environment")).toBeInTheDocument();
  expect(screen.getByText("0595")).toBeInTheDocument();
  expect(screen.getByText("a1b2c3d")).toBeInTheDocument();
  expect(screen.getByText("Setup_Workbook.xlsx")).toBeInTheDocument();
  expect(screen.getByText("Loaded")).toBeInTheDocument();
});

test("marks the environment after confirmation", async () => {
  mount();
  await screen.findByTestId("promotion-path");
  const button = screen.getByRole("button", { name: "Mark environment" });
  expect(button).toBeDisabled();
  fireEvent.keyDown(screen.getByLabelText("Environment"), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  // the overlay is still entering (hidden to the accessibility tree) when it is clicked
  fireEvent.click(await screen.findByRole("option", { name: "Pre-Production", hidden: true }));
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await screen.findByText("Mark this environment?");
  fireEvent.click(screen.getByRole("button", { name: "Mark" }));
  await waitFor(() => expect(promotionService.markEnvironment).toHaveBeenCalledWith("preprod"));
  await waitFor(() => expect(promotionService.getPath).toHaveBeenCalledTimes(2));
});

test("without write:data-load the marker cannot be changed", async () => {
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:data-load"]));
  mount();
  await screen.findByTestId("promotion-path");
  expect(screen.queryByRole("button", { name: "Mark environment" })).toBeNull();
});
