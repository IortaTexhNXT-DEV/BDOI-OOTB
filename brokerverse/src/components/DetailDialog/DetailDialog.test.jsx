import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import DetailDialog from "./index";

describe("DetailDialog", () => {
  it("opens centred with the content and a Close button when no footer is given", () => {
    const onHide = jest.fn();
    render(<DetailDialog visible onHide={onHide} header="Remittance details" size="md"><p>Facts</p></DetailDialog>);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bv-centered", "bv-detail-dialog");
    expect(dialog).toHaveStyle({ width: "44rem" });
    expect(screen.getByText("Remittance details")).toBeInTheDocument();
    expect(screen.getByText("Facts")).toBeInTheDocument();
    // the header close icon has no text; the footer button reads Close
    fireEvent.click(screen.getByText("Close"));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("shows the footer actions the screen gives, or none", () => {
    const { rerender } = render(
      <DetailDialog visible onHide={() => {}} header="Debit note" footer={<button type="button">Print</button>}><p>Facts</p></DetailDialog>
    );
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    expect(screen.queryByText("Close")).toBeNull();
    rerender(<DetailDialog visible onHide={() => {}} header="Debit note" footer={null}><p>Facts</p></DetailDialog>);
    expect(screen.queryByRole("button", { name: "Print" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
