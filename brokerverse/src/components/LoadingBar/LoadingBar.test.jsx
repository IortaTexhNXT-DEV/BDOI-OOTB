import React from "react";
import { render, screen } from "@testing-library/react";
import LoadingBar from "./index";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : d?.defaultValue) || k }) }));

describe("LoadingBar", () => {
  it("shows a progress line over the container edge while active", () => {
    const { rerender, container } = render(<LoadingBar active />);
    expect(screen.getByRole("progressbar", { name: "Refreshing" })).toHaveClass("bv-loading-bar", "bv-delayed-loading");
    rerender(<LoadingBar active={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps its line in the flow when inline, so nothing moves when it stops", () => {
    const { rerender, container } = render(<LoadingBar active inline label="Refreshing the statement" />);
    expect(screen.getByRole("progressbar", { name: "Refreshing the statement" })).toHaveClass("bv-loading-bar--inline");
    rerender(<LoadingBar active={false} inline />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(container).not.toBeEmptyDOMElement();
  });
});
