import React from "react";
import { render, screen } from "@testing-library/react";
import DetailSection from "./index";

const byClass = (name) => screen.queryByText((_, el) => !!el?.classList?.contains(name));

describe("DetailSection", () => {
  it("is a section named by its heading, with its actions and content", () => {
    render(
      <DetailSection title="Policies" actions={<button type="button">Export</button>} flush>
        <span>POL-1</span>
      </DetailSection>
    );
    expect(screen.getByRole("region", { name: "Policies" })).toHaveClass("bv-section");
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(byClass("bv-section__body--flush")).toHaveTextContent("POL-1");
  });

  it("can hold content without a heading", () => {
    render(<DetailSection><p>Only facts</p></DetailSection>);
    expect(byClass("bv-section__head")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Only facts")).toBeInTheDocument();
  });
});
