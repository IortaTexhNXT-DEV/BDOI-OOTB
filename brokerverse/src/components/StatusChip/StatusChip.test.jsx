import React from "react";
import { render, screen } from "@testing-library/react";
import StatusChip, { chipSeverity } from "./index";

const chip = (text) => screen.queryByText((_, el) => !!el?.classList?.contains("p-tag") && el.textContent === text);

describe("StatusChip", () => {
  it("colours a status by its label when the label is a known status word, else by its code", () => {
    expect(chipSeverity("for-approval", "Pending Approval")).toBe("warning");
    expect(chipSeverity("approved", "Signed off")).toBe("success");
    expect(chipSeverity(null, "Rejected")).toBe("danger");
    expect(chipSeverity(null, null)).toBe("secondary");
  });

  it("is a compact tag of the status text, the code in words when there is no label", () => {
    const { rerender } = render(<StatusChip code="for-approval" label="Pending Approval" />);
    expect(chip("Pending Approval")).toHaveClass("bv-status-chip", "p-tag-warning");
    rerender(<StatusChip code="in-review" />);
    expect(chip("In review")).toBeInTheDocument();
    rerender(<StatusChip />);
    expect(screen.queryByText((_, el) => !!el?.classList?.contains("p-tag"))).toBeNull();
  });
});
