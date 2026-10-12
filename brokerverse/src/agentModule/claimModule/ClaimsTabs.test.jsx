import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import ClaimsPage from "./index";
import { canOpen } from "../../utils/canOpen";
import claimsService from "../../services/claimsService";

jest.mock("../../utils/canOpen", () => ({ __esModule: true, canOpen: jest.fn(), hasPermission: () => true, default: jest.fn() }));
jest.mock("../../services/claimsService", () => ({ __esModule: true, default: { getClaimsList: jest.fn() } }));
jest.mock("./claimTable", () => () => <div>claims register</div>);
jest.mock("../../module/OpsAccounting/ClaimDocuments", () => () => <div>awaiting documents queue</div>);
jest.mock("../../module/OpsAccounting/MotorClaimRepairs", () => () => <div>motor repairs queue</div>);

const at = (path) => render(<MemoryRouter initialEntries={[path]}><ClaimsPage /></MemoryRouter>);

describe("Claims tabs", () => {
  beforeEach(() => claimsService.getClaimsList.mockResolvedValue({ success: false }));
  it("shows Awaiting Documents and Motor Repairs as tabs of Claims to a role granted them", () => {
    canOpen.mockReturnValue(true);
    at("/agent/claim/documents");
    expect(screen.getByRole("menuitem", { name: "Claims" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Awaiting Documents" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Motor Repairs" })).toBeInTheDocument();
    expect(screen.getByText("awaiting documents queue")).toBeInTheDocument();
  });

  it("shows only the register to a role that reads claims without the two screens", () => {
    canOpen.mockReturnValue(false);
    at("/agent/claim/motor-repairs");
    expect(screen.queryByRole("menuitem", { name: "Motor Repairs" })).toBeNull();
    expect(screen.queryByText("motor repairs queue")).toBeNull();
    expect(screen.getByText("claims register")).toBeInTheDocument();
  });
});
