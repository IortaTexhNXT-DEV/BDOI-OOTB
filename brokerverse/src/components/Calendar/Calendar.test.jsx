import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Calendar } from "primereact/calendar";
import DateField from "../DateField";
import { setDateFormat } from "../../utility/dateFormat";
import { viewDateFormat } from "./index";

afterEach(() => setDateFormat("DD/MM/YYYY"));

describe("date fields", () => {
  it("show the configured date format whatever format the screen asked for, with the calendar button", () => {
    render(<Calendar inputId="d" value={new Date(2026, 9, 9)} dateFormat="yy-mm-dd" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("09/10/2026");
    expect(screen.getByRole("button", { hidden: true })).toBeInTheDocument();
  });

  it("keep a month picker to the month and year, and a time field as it is", () => {
    expect(viewDateFormat("month")).toBe("mm/yy");
    expect(viewDateFormat()).toBe("dd/mm/yy");
    setDateFormat("YYYY-MM-DD");
    expect(viewDateFormat("month")).toBe("yy-mm");
    render(<Calendar value={null} timeOnly onChange={() => {}} />);
    expect(screen.queryByRole("button", { hidden: true })).toBeNull();
  });

  it("replace the browser date input: ISO text in and out, an input-like change event", () => {
    const onChange = jest.fn();
    render(<DateField id="from" name="effectiveFrom" value="2026-10-09" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("09/10/2026");
    fireEvent.input(input, { target: { value: "12/10/2026" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ name: "effectiveFrom", value: "2026-10-12" }) }));
  });
});
