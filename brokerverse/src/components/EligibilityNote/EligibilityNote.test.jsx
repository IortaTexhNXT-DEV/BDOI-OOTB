import React from "react";
import { render, screen } from "@testing-library/react";
import "../../i18n";
import EligibilityNote from "./index";

describe("EligibilityNote", () => {
  it("says why the user cannot decide, and who can", () => {
    render(<EligibilityNote reason="You submitted this remittance. Another user with remittance authority must approve it."
      approvers={[{ id: "usr_9", name: "J. Cruz" }, { id: "usr_12", name: "A. Tan" }]} />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("You submitted this remittance. Another user with remittance authority must approve it.");
    expect(note).toHaveTextContent("Can decide: J. Cruz, A. Tan");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the reason alone, and nothing without a reason or approvers", () => {
    const { rerender, container } = render(<EligibilityNote reason="Period 10/2026 is closed." />);
    expect(screen.getByRole("note")).toHaveTextContent(/^Period 10\/2026 is closed\.$/);
    rerender(<EligibilityNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
