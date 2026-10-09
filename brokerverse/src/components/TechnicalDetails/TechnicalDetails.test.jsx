import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TechnicalDetails, { mayViewTechnical } from "./index";
import { copyText } from "../../utility/clipboard";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : d?.defaultValue) || k }) }));
jest.mock("../../utility/clipboard", () => ({ copyText: jest.fn() }));

const signIn = (roles, permissions) => {
  window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  if (permissions) window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const blocks = [{ label: "Record layout", text: "HQAP,H1601EQ,TIN" }, { label: "File content", text: "HQAP,H1601EQ,685442861" }];

describe("TechnicalDetails", () => {
  beforeEach(() => copyText.mockResolvedValue(true));
  afterEach(() => window.localStorage.clear());

  it("is collapsed at first and opens to the raw content", () => {
    signIn(["system-admin"]);
    render(<TechnicalDetails blocks={blocks} />);
    const toggle = screen.getByRole("button", { name: "Technical details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("HQAP,H1601EQ,TIN")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("HQAP,H1601EQ,TIN").tagName).toBe("PRE");
    expect(screen.getByText("File content")).toBeInTheDocument();
  });

  it("copies one block and confirms it", async () => {
    signIn(["system-admin"]);
    render(<TechnicalDetails blocks={blocks} defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Copy File content" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(copyText).toHaveBeenCalledWith("HQAP,H1601EQ,685442861");
  });

  it("is not rendered for a user without the role or permission", () => {
    signIn(["accounting"], ["read:period-end"]);
    const { container } = render(<TechnicalDetails text="raw" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is shown to the roles or the permission given", () => {
    signIn(["accounting"], ["write:period-end"]);
    expect(mayViewTechnical()).toBe(false);
    expect(mayViewTechnical({ roles: ["accounting"] })).toBe(true);
    expect(mayViewTechnical({ permission: "write:period-end" })).toBe(true);
    expect(mayViewTechnical({ permission: "approve:period-end" })).toBe(false);
    render(<TechnicalDetails text="raw" permission="write:period-end" title="File layout" />);
    expect(screen.getByRole("button", { name: "File layout" })).toBeInTheDocument();
  });
});
