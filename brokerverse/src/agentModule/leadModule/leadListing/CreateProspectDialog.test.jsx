import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "../../../i18n";
import CreateProspectDialog from "./CreateProspectDialog";
import clientService from "../../../services/clientService";
import placementService from "../../../services/placementService";

jest.mock("../../../services/clientService", () => ({ __esModule: true, default: { searchClients: jest.fn() } }));
jest.mock("../../../services/placementService", () => ({ __esModule: true, default: { productLines: jest.fn() } }));

const CLIENTS = [
  { clientId: "cl_1", generatedClientId: "CL-2026-90004", displayName: "Andrea Villanueva", contactNumber: "+639205551234", emailId: "andrea.villanueva.long.address@example.ph", city: "Makati City" },
  { clientId: "cl_2", generatedClientId: "CL-2026-95007", displayName: "Paolo Fernandez", contactNumber: "+639171110007", emailId: "paolo.fernandez@example.ph" },
];

// jsdom does not lay out the list
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  jest.useFakeTimers();
  placementService.productLines.mockResolvedValue([]);
  clientService.searchClients.mockResolvedValue({ success: true, data: CLIENTS });
});
afterEach(() => jest.useRealTimers());

const search = async (term) => {
  render(<CreateProspectDialog visible onHide={jest.fn()} onProduct={jest.fn()} onSkip={jest.fn()} />);
  fireEvent.click(screen.getByLabelText(/Existing client/));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Client name, mobile number or e-mail"), { target: { value: term } });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

describe("Create prospect for an existing client", () => {
  it("lists the clients found with each value in its own column, long values with their tooltip", async () => {
    await search("and");
    expect(clientService.searchClients).toHaveBeenCalledWith("and");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByTitle("andrea.villanueva.long.address@example.ph")).toHaveTextContent("andrea.villanueva.long.address@example.ph");
    expect(screen.getByText("2 clients found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this client" })).toBeDisabled();
  });

  it("selects a client by click or with the arrow keys and shows the selection", async () => {
    await search("and");
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[1]);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveClass("is-selected");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Use this client" })).toBeEnabled();
  });

  it("uses the selected client with Enter and links the prospect to it", async () => {
    const onSkip = jest.fn();
    render(<CreateProspectDialog visible onHide={jest.fn()} onProduct={jest.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByLabelText(/Existing client/));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const input = screen.getByLabelText("Client name, mobile number or e-mail");
    fireEvent.change(input, { target: { value: "paolo" } });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(screen.getByText("Prospect for Andrea Villanueva (CL-2026-90004)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip - tag product later" }));
    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ clientId: "cl_1" }));
  });

  it("offers a new customer when no client matches", async () => {
    clientService.searchClients.mockResolvedValue({ success: true, data: [] });
    const onSkip = jest.fn();
    render(<CreateProspectDialog visible onHide={jest.fn()} onProduct={jest.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByLabelText(/Existing client/));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Client name, mobile number or e-mail"), { target: { value: "nobody" } });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(await screen.findByText('No client matches "nobody".')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create a new customer instead" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip - tag product later" }));
    expect(onSkip).toHaveBeenCalledWith(null);
  });
});
