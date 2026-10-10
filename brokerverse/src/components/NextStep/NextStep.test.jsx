import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NextStep from "./index";

describe("NextStep", () => {
  it("links to the screen of the next step with the record it starts from", () => {
    render(
      <MemoryRouter initialEntries={["/policy"]}>
        <Routes>
          <Route path="/policy" element={<NextStep title="Next step: collect the premium" text="The bill INV-1 is open." actions={[{ key: "receipt", label: "Record receipt", to: "/accounts/receipts/addreceipts?client=CL-1&policy=POL-1" }]} />} />
          <Route path="/accounts/receipts/addreceipts" element={<p>Add receipt</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("note")).toHaveTextContent("Next step: collect the premium");
    expect(screen.getByText("The bill INV-1 is open.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Record receipt"));
    expect(screen.getByText("Add receipt")).toBeInTheDocument();
  });

  it("shows nothing without an action or a text", () => {
    const { container } = render(<MemoryRouter><NextStep title="Next step" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
