import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../i18n";
import RowActions, { menuItems } from "./index";

const ACTIONS = [
  { code: "edit", label: "Edit", allowed: true },
  { code: "view", label: "View", allowed: true },
  { code: "submit", label: "Submit for approval", allowed: false, blockedCode: "WRONG_STATUS" },
  { code: "run-now", label: "Run now…", allowed: false, blockedCode: "WINDOW_DONE", blockedReason: "This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15." },
  { code: "pause", label: "Pause", allowed: true },
];

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "Actions for TIS-WEEKLY" }));
  return screen.getByRole("menu");
};

describe("RowActions", () => {
  it("lists the allowed actions with View first, and an expected blocked action disabled with its reason as text", () => {
    expect(menuItems(ACTIONS).map((a) => a.code)).toEqual(["view", "edit", "run-now", "pause"]);
    render(<RowActions label="Actions for TIS-WEEKLY" actions={ACTIONS} onAction={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: "Actions for TIS-WEEKLY" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const items = within(openMenu()).getAllByRole("menuitem");
    expect(items.map((i) => within(i).getAllByText(/./)[0].textContent)).toEqual(["View", "Edit", "Run now…", "Pause"]);
    expect(items[2]).toHaveAttribute("aria-disabled", "true");
    expect(items[2]).toHaveTextContent("This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15.");
    expect(screen.queryByText("Submit for approval")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("is used from the keyboard: open on the first item, move with the arrows, choose with Enter, Escape returns", () => {
    const onAction = jest.fn();
    render(<RowActions label="Actions for TIS-WEEKLY" actions={ACTIONS} onAction={onAction} />);
    userEvent.tab();
    const trigger = screen.getByRole("button", { name: "Actions for TIS-WEEKLY" });
    expect(trigger).toHaveFocus();
    userEvent.keyboard("{Enter}");
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(items[2]).toHaveFocus();
    userEvent.keyboard("{Enter}");
    expect(onAction).not.toHaveBeenCalled();
    userEvent.keyboard("{End}");
    expect(items[3]).toHaveFocus();
    userEvent.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
    userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    userEvent.keyboard("{ArrowDown}");
    userEvent.keyboard("{ArrowDown}");
    userEvent.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ code: "edit" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("chooses with a click, translates the labels it is given, and shows nothing without actions", () => {
    const onAction = jest.fn();
    const { rerender, container } = render(<RowActions label="Actions for TIS-WEEKLY" actions={ACTIONS} onAction={onAction} labelOf={(a) => `[${a.code}]`} />);
    fireEvent.click(within(openMenu()).getByText("[pause]"));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ code: "pause" }));
    rerender(<RowActions label="Actions" actions={[{ code: "submit", allowed: false }]} onAction={onAction} />);
    expect(container).toBeEmptyDOMElement();
  });
});
