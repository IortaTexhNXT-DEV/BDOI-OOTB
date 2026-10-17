/* eslint-disable testing-library/no-node-access -- the test checks where the footer puts each button */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { arrangeFooter, footerButtons } from "./arrange";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : k) }) }));

describe("arrangeFooter", () => {
  it("puts Close on the left, keeps one filled primary and sets the destructive action apart", () => {
    const footer = (
      <div className="flex gap-2 justify-content-end">
        <Button label="Save" />
        <Button label="Delete" severity="danger" text />
        <Button label="Close" outlined />
        <Button label="Submit" />
      </div>
    );
    render(arrangeFooter(footer));
    const start = document.querySelector(".bv-dialog-footer__start");
    expect(within(start).getByRole("button", { name: "Close" })).toHaveClass("p-button-text");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("p-button-outlined");
    expect(screen.getByRole("button", { name: "Submit" })).not.toHaveClass("p-button-outlined");
    expect(document.querySelector(".bv-dialog-footer__danger")).toContainElement(screen.getByRole("button", { name: "Delete" }));
  });

  it("collapses three or more secondary actions into More actions", () => {
    render(arrangeFooter(<><Button label="A" outlined /><Button label="B" outlined /><Button label="C" outlined /><Button label="Go" /></>));
    expect(screen.queryByRole("button", { name: "A" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("leaves a footer with anything other than buttons as it is", () => {
    const footer = <div><input aria-label="Agree" type="checkbox" /><Button label="OK" /></div>;
    expect(footerButtons(footer)).toBeNull();
    expect(arrangeFooter(footer)).toBe(footer);
  });

  it("applies to every primereact Dialog", () => {
    render(<Dialog visible onHide={() => {}} header="X" footer={<><Button label="Confirm" /><Button label="Cancel" text /></>}>body</Dialog>);
    expect(document.querySelector(".bv-dialog-footer__start")).toContainElement(screen.getByRole("button", { name: "Cancel" }));
  });
});
