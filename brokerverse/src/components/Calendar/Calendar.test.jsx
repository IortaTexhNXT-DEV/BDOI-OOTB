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

  it("leave an inline calendar showing the days of the month", () => {
    render(<Calendar inline value={new Date(2026, 9, 9)} onChange={() => {}} />);
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.queryByRole("button", { hidden: true, name: /choose date/i })).toBeNull();
  });

  it("take a date typed digit by digit: a part of a date changes nothing, the whole date is the value", () => {
    const Host = () => {
      const [value, setValue] = React.useState("");
      return <><DateField id="cheque" name="chequeDate" value={value} onChange={(e) => setValue(e.target.value)} /><output>{value || "none"}</output></>;
    };
    render(<Host />);
    const input = screen.getByRole("textbox");
    let text = "";
    for (const ch of "15/10/2026") {
      text += ch;
      fireEvent.input(input, { target: { value: text } });
      expect(input).toHaveValue(text);
    }
    expect(screen.getByText("2026-10-15")).toBeInTheDocument();
    fireEvent.input(input, { target: { value: "" } });
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("let a date already set be corrected by typing over it", () => {
    const Host = () => {
      const [value, setValue] = React.useState(new Date(2026, 9, 15));
      return <><Calendar inputId="d2" value={value} onChange={(e) => setValue(e.value)} /><output>{value ? value.toDateString() : "none"}</output></>;
    };
    render(<Host />);
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "15/11/202" } });
    expect(input).toHaveValue("15/11/202");
    fireEvent.input(input, { target: { value: "15/11/2026" } });
    expect(screen.getByText(new Date(2026, 10, 15).toDateString())).toBeInTheDocument();
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
