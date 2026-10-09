import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import NewProspectGate from "./NewProspectGate";
import { prospectChosen, prospectFormState } from "../leadListing/useProspectStart";
import placementService from "../../../services/placementService";
import systemSettingsService from "../../../services/systemSettingsService";

jest.mock("../../../services/placementService", () => ({ __esModule: true, default: { productLines: jest.fn() } }));
jest.mock("../../../services/systemSettingsService", () => ({ __esModule: true, default: { getConfiguration: jest.fn() } }));

beforeEach(() => {
  placementService.productLines.mockResolvedValue([]);
  systemSettingsService.getConfiguration.mockResolvedValue([]);
});

const at = (state) => render(
  <MemoryRouter initialEntries={[{ pathname: "/agent/createlead", state }]}>
    <Routes>
      <Route path="/agent/createlead" element={<NewProspectGate><p>Prospect form</p></NewProspectGate>} />
    </Routes>
  </MemoryRouter>,
);

describe("a new prospect", () => {
  it("opened from the side bar, a dashboard or a link starts with the Create prospect choice", () => {
    at(undefined);
    expect(screen.queryByText("Prospect form")).not.toBeInTheDocument();
    expect(screen.getByText("Is the customer new, or already one of our clients?")).toBeInTheDocument();
  });

  it("opens the form once the product is chosen or skipped, and for an existing prospect", () => {
    for (const state of [prospectFormState({ product: { id: 1, lob: "MOTOR" } }), prospectFormState({ untagged: true }), { leadRefId: "ld_1" }]) {
      const { unmount } = at(state);
      expect(screen.getByText("Prospect form")).toBeInTheDocument();
      unmount();
    }
  });

  it("carries the product, the client or the skip to the form", () => {
    expect(prospectFormState({ product: { id: 7, lob: "LIFE", name: "Credit Life" }, client: { clientId: "cl_1" } }))
      .toEqual({ existingClient: { clientId: "cl_1" }, product: { lob: "LIFE", productId: 7 } });
    expect(prospectFormState({ untagged: true })).toEqual({ untagged: true });
    expect(prospectChosen({ existingClient: { clientId: "cl_1" } })).toBe(false);
    expect(prospectChosen(null)).toBe(false);
  });
});
