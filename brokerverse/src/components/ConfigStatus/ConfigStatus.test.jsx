import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConfigStatus, { businessItems, configurePath } from "./index";

jest.mock("react-i18next", () => {
  const words = { "configStatus.state.ready": "Ready", "configStatus.state.incomplete": "Incomplete", "configStatus.state.off": "Off" };
  return { useTranslation: () => ({ t: (k, d) => words[k] || (typeof d === "string" ? d : d?.defaultValue) || k }) };
});

const signIn = (roles) => window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));
const inApp = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
// the panel is still in its opening transition when the test looks into it
const configureLink = () => screen.queryByRole("link", { name: /Configure/, hidden: true });

describe("ConfigStatus", () => {
  afterEach(() => window.localStorage.clear());

  it("is a plain chip when nothing is missing and the user cannot configure", () => {
    signIn(["accounting"]);
    inApp(<ConfigStatus state="ready" feature="E-invoicing" />);
    expect(screen.getByRole("status", { name: "E-invoicing: Ready" })).toHaveClass("bv-config-status--ready");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens what it summarises when given onClick, without the configuration panel", () => {
    signIn(["system-admin"]);
    const open = jest.fn();
    inApp(<ConfigStatus state="ready" feature="Weekly run" label="12/10/2026 06:15 · 3 created" onClick={open} />);
    fireEvent.click(screen.getByRole("button", { name: "Weekly run: 12/10/2026 06:15 · 3 created" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(configureLink()).toBeNull();
  });

  it("lists the missing items in business words, without setting keys, and no Configure link for other users", () => {
    signIn(["accounting"]);
    inApp(<ConfigStatus state="incomplete" feature="CAS" missing={["BIR permit number (cas.permit_number)", "invoice.atp_number", "Backup custodian"]} />);
    fireEvent.click(screen.getByRole("button", { name: "CAS: Incomplete" }));
    expect(screen.getByText("BIR permit number")).toBeInTheDocument();
    expect(screen.getByText("Backup custodian")).toBeInTheDocument();
    expect(screen.queryByText(/permit_number|atp_number/)).toBeNull();
    expect(configureLink()).toBeNull();
  });

  it("offers the administrator a Configure link to the area of Master > Configuration", () => {
    signIn(["system-admin"]);
    inApp(<ConfigStatus state="off" feature="E-invoicing" area="accounting" />);
    fireEvent.click(screen.getByRole("button", { name: "E-invoicing: Off" }));
    expect(configureLink()).toHaveAttribute("href", "/master/configuration/settings?area=accounting");
  });

  it("checks the given permission instead of the administrator role", () => {
    signIn(["accounting"]);
    window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["write:period-end"]));
    inApp(<ConfigStatus state="incomplete" missing={["Loose-leaf book permit"]} to="/accounts/tax/cas" permission="write:period-end" />);
    fireEvent.click(screen.getByRole("button", { name: "Incomplete" }));
    expect(configureLink()).toHaveAttribute("href", "/accounts/tax/cas");
  });

  it("builds the configure address and cleans the item list", () => {
    expect(configurePath("/master/configuration/settings", "company")).toBe("/master/configuration/settings?area=company");
    expect(configurePath("/master/x?tab=1", "company")).toBe("/master/x?tab=1&area=company");
    expect(configurePath("/master/x")).toBe("/master/x");
    expect(businessItems(["Company TIN (Master > Company)", "ATP number (invoice.atp_number / invoice.cas_permit_number)", "eis.enabled", ""]))
      .toEqual(["Company TIN", "ATP number"]);
  });

  it("names the state in the feature's words and marks a state that stops the business as danger, in text and colour", () => {
    signIn(["accounting"]);
    const { rerender } = inApp(<ConfigStatus state="off" feature="Automation" label="Off" tone="danger" />);
    const chip = screen.getByRole("status", { name: "Automation: Off" });
    expect(chip).toHaveClass("bv-config-status--off", "bv-config-status--danger");
    expect(chip).toHaveTextContent("AutomationOff");
    rerender(<MemoryRouter><ConfigStatus state="ready" feature="Automation" label="On" /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Automation: On" })).not.toHaveClass("bv-config-status--danger");
  });
});
