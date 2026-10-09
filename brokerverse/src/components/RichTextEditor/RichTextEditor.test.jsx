import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import RichTextEditor, { htmlIsEmpty } from ".";

const Host = ({ initial }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <RichTextEditor value={value} onChange={setValue} ariaLabel="Message"
        placeholders={[{ name: "firstName", label: "First name" }, { name: "optOutLink", label: "Opt-out link", html: '<a href="{{optOutLink}}">unsubscribe</a>' }]} />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe("RichTextEditor", () => {
  it("counts a body left with an empty paragraph as empty", () => {
    expect(htmlIsEmpty("<p><br></p>")).toBe(true);
    expect(htmlIsEmpty("<p>&nbsp;</p>")).toBe(true);
    expect(htmlIsEmpty("<p>Dear {{firstName}}</p>")).toBe(false);
  });

  it("shows the formatted text, switches to the HTML source and inserts a placeholder there", () => {
    render(<Host initial="<p>Dear </p>" />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveTextContent("Dear");
    fireEvent.click(screen.getByRole("button", { name: "HTML source" }));
    const source = screen.getByRole("textbox", { name: "Message" });
    expect(source).toHaveValue("<p>Dear </p>");
    source.setSelectionRange(8, 8);
    fireEvent.click(screen.getByRole("button", { name: "First name" }));
    expect(screen.getByTestId("value")).toHaveTextContent("<p>Dear {{firstName}}</p>");
    fireEvent.click(screen.getByRole("button", { name: "Opt-out link" }));
    expect(screen.getByTestId("value").textContent).toContain('<a href="{{optOutLink}}">unsubscribe</a>');
  });
});
