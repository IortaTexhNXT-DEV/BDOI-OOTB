import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import ProductPicker from "./ProductPicker";
import CreateProspectDialog from "../../agentModule/leadModule/leadListing/CreateProspectDialog";
import placementService from "../../services/placementService";
import { lineOf, lobChoices, narrowLines, productOf } from "./salesProducts";

jest.mock("../../services/placementService", () => ({ __esModule: true, default: { productLines: jest.fn() } }));

const product = (id, code, name, line, lob = line, businessType = "package") => ({ id, code, name, line, lob, businessType, customerSegment: "retail" });
const LINES = [
  { code: "MOTOR", name: "Motor", products: [product(1, "MOTOR", "Motor Vehicle Insurance", "MOTOR"), product(2, "CTPL", "Compulsory Third Party Liability", "MOTOR")] },
  { code: "FIRE", name: "Fire", products: [product(3, "FIRE", "Fire and Allied Perils", "FIRE", "FIRE", "non_package"), product(4, "IAR", "Industrial All Risks", "FIRE", "IAR", "non_package")] },
  { code: "LIFE", name: "Credit Life", products: [product(7, "CL-COMP", "Credit Life - Compulsory", "LIFE")] },
];

/** Opens a PrimeReact dropdown from the keyboard (Alt+Down), once enabled, and picks an option. */
const choose = async (label, option) => {
  await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  // the overlay is still entering (hidden to the accessibility tree) when it is clicked
  fireEvent.click(await screen.findByRole("option", { name: option, hidden: true }));
};

const Harness = ({ onChange, ...props }) => {
  const [value, setValue] = useState({ lob: null, productId: null });
  return (
    <ProductPicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      {...props}
    />
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  placementService.productLines.mockResolvedValue(LINES);
});

describe("product lines", () => {
  it("finds the line of a value by its product, its line code or the line a product is quoted under", () => {
    expect(lineOf(LINES, { productId: 2 }).code).toBe("MOTOR");
    expect(lineOf(LINES, { lob: "life" }).code).toBe("LIFE");
    expect(lineOf(LINES, { lob: "IAR" }).code).toBe("FIRE");
    expect(lineOf(LINES, {})).toBeNull();
    expect(productOf(LINES, "7").name).toBe("Credit Life - Compulsory");
    expect(productOf(LINES, null)).toBeNull();
  });

  it("narrows the lines to the products a screen offers and drops the lines left empty", () => {
    expect(narrowLines(LINES, (p) => p.businessType === "non_package").map((l) => l.code)).toEqual(["FIRE"]);
    expect(narrowLines(null, () => true)).toBeNull();
  });

  it("offers each line and the quoting line of a product that differs from its line", () => {
    expect(lobChoices(LINES)).toEqual([
      { value: "MOTOR", label: "Motor" }, { value: "FIRE", label: "Fire" }, { value: "LIFE", label: "Credit Life" },
      { value: "IAR", label: "Fire - Industrial All Risks" },
    ]);
  });
});

describe("the product picker", () => {
  it("asks for the line of business first, then offers the products of that line", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} idPrefix="test" />);
    await waitFor(() => expect(screen.getByLabelText("Line of Business")).toBeEnabled());
    expect(screen.getByLabelText("Product")).toBeDisabled();
    await choose("Line of Business", "Motor");
    expect(onChange).toHaveBeenLastCalledWith({ lob: "MOTOR", productId: null, product: null });
    await choose("Product", "Compulsory Third Party Liability");
    expect(screen.getByRole("option", { name: "Motor Vehicle Insurance", hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Fire and Allied Perils", hidden: true })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ lob: "MOTOR", productId: 2, product: expect.objectContaining({ code: "CTPL" }) });
  });

  it("selects the product of a line that has only one", async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} idPrefix="test" />);
    await waitFor(() => expect(placementService.productLines).toHaveBeenCalled());
    await choose("Line of Business", "Credit Life");
    expect(onChange).toHaveBeenLastCalledWith({ lob: "LIFE", productId: 7, product: expect.objectContaining({ code: "CL-COMP" }) });
  });

  it("offers a single line at once, and loads the products of a business type", async () => {
    placementService.productLines.mockResolvedValue([LINES[0]]);
    const onChange = jest.fn();
    render(<Harness onChange={onChange} businessType="package" idPrefix="test" />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lob: "MOTOR", productId: null, product: null }));
    expect(placementService.productLines).toHaveBeenCalledWith({ businessType: "package" });
  });
});

describe("Create prospect", () => {
  const open = async (props) => {
    render(<CreateProspectDialog visible onHide={jest.fn()} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(placementService.productLines).toHaveBeenCalled());
  };

  it("creates the prospect without a product: Skip - tag product later", async () => {
    const onSkip = jest.fn();
    const onProduct = jest.fn();
    await open({ onSkip, onProduct });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Skip - tag product later" }));
    expect(onSkip).toHaveBeenCalledWith(null);
    expect(onProduct).not.toHaveBeenCalled();
  });

  it("opens the form of the product chosen by line of business, then product", async () => {
    const onProduct = jest.fn();
    await open({ onSkip: jest.fn(), onProduct });
    await choose("Line of Business", "Motor");
    await choose("Product", "Motor Vehicle Insurance");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 1, lob: "MOTOR" }), null);
  });

  it("offers no Skip when the product is required", async () => {
    await open({ onSkip: jest.fn(), onProduct: jest.fn(), productRequired: true });
    expect(screen.queryByRole("button", { name: "Skip - tag product later" })).not.toBeInTheDocument();
  });
});
