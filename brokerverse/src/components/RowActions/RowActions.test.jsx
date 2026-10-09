import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RowActions from ".";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key, fallback) => fallback || key }) }));

describe("RowActions", () => {
  it("shows only the actions it is given, each with its accessible name", () => {
    const onView = jest.fn();
    const onEdit = jest.fn();
    render(<RowActions onView={onView} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
  });

  it("offers deactivate for an active record and activate for an inactive one", () => {
    const onStatus = jest.fn();
    const { rerender } = render(<RowActions onStatus={onStatus} active />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    rerender(<RowActions onStatus={onStatus} active={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    expect(onStatus).toHaveBeenCalledTimes(2);
  });
});
