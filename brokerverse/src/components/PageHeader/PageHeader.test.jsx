import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PageHeader from "./index";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : d?.defaultValue) || k }) }));

const crumbs = () => within(screen.getByRole("navigation")).getAllByRole("link").map((a) => a.textContent);

describe("PageHeader", () => {
  it("shows the title, the breadcrumb in order and the actions", () => {
    render(<PageHeader title="Period Management" home="Accounts" section="Period End" trail={["Period Management"]}><button type="button">New fiscal year</button></PageHeader>);
    expect(screen.getByRole("heading", { level: 1, name: "Period Management" })).toBeInTheDocument();
    expect(crumbs()).toEqual(["Accounts", "Period End", "Period Management"]);
    expect(within(screen.getByRole("navigation")).getAllByRole("separator")).toHaveLength(2);
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "New fiscal year" })).toBeInTheDocument();
  });

  it("puts the help behind an info icon instead of a paragraph", () => {
    render(<PageHeader title="BIR DAT Files" subtitle="Validation files of the alphalists." />);
    const icon = screen.getByRole("button", { name: "About this page" });
    expect(icon).toHaveAccessibleDescription("Validation files of the alphalists.");
    // only the description read by screen readers: no paragraph under the title
    expect(screen.getAllByText("Validation files of the alphalists.")).toHaveLength(1);
    expect(screen.getByText("Validation files of the alphalists.")).toHaveClass("p-hidden-accessible");
  });

  it("takes help, intro or description as the help text, help first", () => {
    const { rerender } = render(<PageHeader title="A" intro="From intro" />);
    expect(screen.getByRole("button", { name: "About this page" })).toHaveAccessibleDescription("From intro");
    rerender(<PageHeader title="A" description="From description" help="From help" />);
    expect(screen.getByRole("button", { name: "About this page" })).toHaveAccessibleDescription("From help");
  });

  it("leaves out the help icon, the breadcrumb and the actions when there are none", () => {
    render(<PageHeader title="Plain" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens the screen of a breadcrumb item with a link and goes back with the arrow", () => {
    const onBack = jest.fn();
    render(
      <MemoryRouter initialEntries={["/accounts/period-end/year-end"]}>
        <Routes>
          <Route path="/accounts/period-end/year-end" element={<PageHeader title="Year-End Close" home="Accounts" trail={[{ label: "Period Management", to: "/accounts/period-end/periods" }, "Year-End Close"]} onBack={onBack} />} />
          <Route path="/accounts/period-end/periods" element={<p>Periods screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Period Management"));
    expect(screen.getByText("Periods screen")).toBeInTheDocument();
  });
});
