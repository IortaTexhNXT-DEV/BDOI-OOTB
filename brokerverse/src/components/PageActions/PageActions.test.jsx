import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PageActions from ".";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key, fallback) => fallback || key }) }));

describe("PageActions", () => {
  it("shows Upload and Add when both are given, Add last", () => {
    const onUpload = jest.fn();
    const onAdd = jest.fn();
    render(<PageActions onUpload={onUpload} onAdd={onAdd} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Upload", "Add"]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("leaves out Upload on a list without an upload and takes the screen's own Add label", () => {
    render(<PageActions onAdd={jest.fn()} addLabel="Add program" />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Add program"]);
  });
});
