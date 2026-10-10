import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "../../i18n";
import store from "../../redux/store";
import adminService from "../../services/adminService";
import { OPEN_HELP_EVENT } from "./helpEvents";

jest.mock("../../services/adminService", () => ({ __esModule: true, default: { getSettings: jest.fn(), getVersion: jest.fn() } }));

// the web build of the release: version and build time (UTC) as craco.config.js sets them
process.env.REACT_APP_VERSION = "2026.1.3";
process.env.REACT_APP_BUILD_DATE = "2026-10-10T10:34:00.000Z";
const { default: HelpPanel, aboutFacts, formatReleaseDate, manualEdition, ticketDetails } = require("./index");

const edition = { edition: "tisph", version: "1.3", versionLabel: "PH Version", date: "10 October 2026", status: "Draft", brandPack: "toyota-insurance-services", files: {}, roles: {}, sections: [] };
const release = { webVersion: "PH-WEB-2026.1.3", apiVersion: "PH-API-2026.1.3", environment: "Development", requirementsApprover: "Andrew", versionApprover: "Vijay" };
const t = (key) => ({ "help.version": "Version", "help.webApp": "Web", "help.api": "API" })[key] || key;

const openPanel = async () => {
  render(<MemoryRouter><Provider store={store}><HelpPanel /></Provider></MemoryRouter>);
  act(() => { window.dispatchEvent(new Event(OPEN_HELP_EVENT)); });
  await screen.findByText("PH-WEB-2026.1.3 · PH-API-2026.1.3");
};
const aboutRows = () => {
  const about = within(screen.getByLabelText(/^About /));
  const values = about.getAllByRole("definition").map((d) => d.textContent);
  return about.getAllByRole("term").map((term, i) => [term.textContent, values[i]]);
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(edition) }));
  adminService.getSettings.mockResolvedValue([{ key: "support.email", value: "itsupport@tisph.example.ph" }]);
  adminService.getVersion.mockResolvedValue({ name: "brokerverse-backend", version: "2026.1.3", environment: "production", commit: "f56851e2292c520a", release });
});

describe("About Toyota Insurance Services", () => {
  it("shows the release, environment, build and release date, manual edition and approvers", async () => {
    await openPanel();
    expect(aboutRows()).toEqual([
      ["Version", "PH-WEB-2026.1.3 · PH-API-2026.1.3"],
      ["Environment", "Development"],
      ["Build & Release Date", "Oct 10, 2026, 06.34 PM"],
      ["User Manual", "PH Version 1.3 - 10 October 2026 Draft"],
      ["Requirements Approval", "Andrew"],
      ["Version Release Approval", "Vijay"],
    ]);
  });

  it("hides an approver that is not set", async () => {
    adminService.getVersion.mockResolvedValue({ version: "2026.1.3", release: { ...release, requirementsApprover: undefined } });
    await openPanel();
    expect(aboutRows().map(([label]) => label)).toEqual(["Version", "Environment", "Build & Release Date", "User Manual", "Version Release Approval"]);
  });

  it("copies the same release facts into the support details", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy details" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0];
    expect(text).toContain([
      "Version: PH-WEB-2026.1.3 · PH-API-2026.1.3",
      "Environment: Development",
      "Build & Release Date: Oct 10, 2026, 06.34 PM",
      "User Manual: PH Version 1.3 - 10 October 2026 Draft",
      "Requirements Approval: Andrew",
      "Version Release Approval: Vijay",
      "Commit: f56851e",
    ].join("\n"));
  });
});

describe("release facts", () => {
  it("writes the build time in Manila with a dot between hours and minutes", () => {
    expect(formatReleaseDate("2026-10-10T10:34:00Z", "Asia/Manila")).toBe("Oct 10, 2026, 06.34 PM");
    expect(formatReleaseDate("2026-10-04T16:05:00Z", "Asia/Manila")).toBe("Oct 05, 2026, 12.05 AM");
    expect(formatReleaseDate("")).toBe("");
  });

  it("names the manual edition with its label, else Version, and leaves out the status of an approved edition", () => {
    expect(manualEdition(edition, "Version")).toBe("PH Version 1.3 - 10 October 2026 Draft");
    expect(manualEdition({ version: "1.3", date: "10 October 2026", status: "Approved" }, "Version")).toBe("Version 1.3 - 10 October 2026");
    expect(manualEdition(null, "Version")).toBe("");
  });

  it("falls back to the versions of the builds while no release is set", () => {
    const facts = aboutFacts({ t, version: { version: "2026.1.3", environment: "production" }, manual: null, webVersion: "2026.1.3", buildDate: "" });
    expect(facts.map((f) => [f.key, f.value])).toEqual([["version", "Web 2026.1.3 · API 2026.1.3"], ["environment", "production"], ["buildDate", ""]]);
  });

  it("puts every fact into the ticket, a missing value as -", () => {
    const text = ticketDetails({
      screen: "Claims", url: "https://tisph.example.ph/agent/claim", user: { username: "carlo.estrada", roles: ["tis-ops-officer"] },
      facts: [{ label: "Version", value: "PH-WEB-2026.1.3" }, { label: "Build & Release Date", value: "" }], at: "2026-10-04T08:00:00.000Z",
    });
    expect(text.split("\n")).toEqual([
      "Screen: Claims", "Address: https://tisph.example.ph/agent/claim", "User: carlo.estrada", "Roles: tis-ops-officer",
      "Version: PH-WEB-2026.1.3", "Build & Release Date: -", "Time: 2026-10-04T08:00:00.000Z",
    ]);
  });
});
