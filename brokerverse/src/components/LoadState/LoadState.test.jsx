import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import LoadState from "./index";

describe("LoadState", () => {
  it("shows the record once it is there", () => {
    render(<LoadState loading={false}><p>Record</p></LoadState>);
    expect(screen.getByText("Record")).toBeInTheDocument();
  });

  it("shows a skeleton, not a text that can stay for ever, while loading", () => {
    render(<LoadState loading><p>Record</p></LoadState>);
    expect(screen.getAllByRole("status")[0]).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Record")).not.toBeInTheDocument();
  });

  it("gives the reason of a failed request with Retry and the way back", () => {
    const retry = jest.fn();
    const back = jest.fn();
    render(<LoadState loading={false} error="Server unavailable" onRetry={retry} backLabel="Back to Collections" onBack={back} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    fireEvent.click(screen.getByText("Retry"));
    fireEvent.click(screen.getByText("Back to Collections"));
    expect(retry).toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it("says when the record of the link does not exist", () => {
    render(<LoadState loading={false} notFound onBack={() => {}} />);
    expect(screen.getByText("Record not found")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });
});
