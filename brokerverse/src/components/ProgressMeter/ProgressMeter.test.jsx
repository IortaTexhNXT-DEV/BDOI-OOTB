import React from "react";
import { render, screen } from "@testing-library/react";
import ProgressMeter, { meterLabel, meterTone } from "./index";

describe("ProgressMeter", () => {
  it("writes the value outside the bar with one decimal at most", () => {
    render(<ProgressMeter value={7.61} />);
    expect(screen.getByText("7.6%")).toHaveClass("bv-meter__value");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7.6");
    expect(screen.getByRole("progressbar")).toHaveTextContent("");
    expect(screen.getByTestId("progress-meter")).toHaveClass("bv-meter", "bv-meter--primary");
  });

  it("takes a given label and width", () => {
    render(<ProgressMeter value={50} label="5 of 10" width="8rem" />);
    expect(screen.getByText("5 of 10")).toBeInTheDocument();
    expect(screen.getByTestId("progress-meter")).toHaveStyle({ width: "8rem" });
  });

  it("colours the bar from the value unless a tone is given", () => {
    expect(meterTone(40)).toBe("primary");
    expect(meterTone(80)).toBe("primary");
    expect(meterTone(80.1)).toBe("warning");
    expect(meterTone(100)).toBe("warning");
    expect(meterTone(104)).toBe("danger");
    expect(meterTone(104, "success")).toBe("success");
    render(<ProgressMeter value={104} />);
    expect(screen.getByTestId("progress-meter")).toHaveClass("bv-meter--danger");
    expect(screen.getByText("104%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("treats a missing or unreadable value as zero", () => {
    expect(meterLabel(0)).toBe("0%");
    render(<ProgressMeter value="n/a" />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
