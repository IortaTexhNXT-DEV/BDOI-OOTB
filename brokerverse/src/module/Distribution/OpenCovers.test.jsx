import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import OpenCovers from "./OpenCovers";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: {
    openCovers: jest.fn(), openCover: jest.fn(), openCoverChoices: jest.fn(), createOpenCover: jest.fn(), addParcel: jest.fn(), declaration: jest.fn(), endorsement: jest.fn(),
    decideEndorsement: jest.fn(), coverCertificates: jest.fn(),
  },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));

const COVERS = [{ name: "Marine (parcel)", line: "MARINE", insurerPolicyNo: "MN-HO-26-000631-00", sumInsured: 10000, premium: 12, commissionPercent: 3, coverDays: null },
  { name: "Personal Accident", line: "PA", insurerPolicyNo: "", sumInsured: 50000, premium: 50, commissionPercent: 3, coverDays: 365 }];
const CHOICES = { types: [{ value: "parcel", label: "Parcel / Courier" }, { value: "cargo", label: "Marine Cargo" }], defaultCharge: 500, defaultCovers: COVERS,
  deliveryTypes: [{ code: "RUSH", label: "Rush", charge: 2500 }], coverLines: ["MARINE", "PA"], layouts: [{ value: "axa-parcel", label: "AXA parcel layout" }],
  documentsSent: ["Certificate of registration", "Deed of sale"], cancelReasons: ["Parcel not sent"], dailyDeclaration: true };
const COVER = { id: "ocv_1", coverNumber: "MOC-2026-00001", coverType: "parcel", clientName: "Toyota Financial Services Philippines", insurerName: "AXA Philippines", policyNumber: "POL-2026-00151",
  insurerReference: "MN-HO-26-000631-00", periodFrom: "2026-08-01", periodTo: "2027-08-01", rates: [], covers: COVERS, premiumPerCertificate: 62, chargePerCertificate: 500, serviceFeePerCertificate: 438,
  deliveryTypes: [{ code: "RUSH", label: "Rush", charge: 2500 }], remittanceBasis: "gross", dailyDeclaration: true, fileFrequency: "monthly", fileLayout: "axa-parcel", declarationEmail: "decl@axa.example.ph",
  status: "active", certificates: 1, billedPremium: 0, goodsDescription: "Loan collateral documents", pendingEndorsement: null,
  certificateList: [{ id: "occ_1", certificateNumber: "PCC-2026-000001", kind: "parcel", shipmentDate: "2026-10-09", customerName: "Maria Clara Reyes", loanAccount: "0701-2026-118842",
    waybillNo: "143298765012", deliveryType: "Rush", premium: 62, status: "declared", possibleDuplicate: true, dailyDeclarationNumber: "MDD-2026-000070", late: false, covers: COVERS }],
  dailyDeclarations: [{ id: "odd_1", declarationNumber: "MDD-2026-000070", date: "2026-10-09", items: 1, lateItems: 0, premium: 62, status: "closed", closedAt: "2026-10-10T00:10:00Z" }],
  declarations: [], endorsements: [{ id: "oce_1", endorsementNumber: null, effectiveFrom: "2026-11-01", reason: "AXA premium review", changes: { covers: COVERS }, changedFields: ["covers"],
    beforeTerms: { covers: COVERS }, status: "pending", requestedByName: "Ops User" }] };

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/operations/open-covers" element={<OpenCovers />} />
      <Route path="/operations/open-covers/:id" element={<OpenCovers />} />
    </Routes>
  </MemoryRouter>,
);
const grant = (perms) => localStorage.setItem("USER_PERMISSIONS", JSON.stringify(perms));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["operations"]));
  mastersService.options.mockResolvedValue([{ id: 7, label: "AXA Philippines" }]);
  service.openCoverChoices.mockResolvedValue(CHOICES);
  service.openCovers.mockResolvedValue([COVER]);
  service.openCover.mockResolvedValue(COVER);
});

describe("Marine Open Covers", () => {
  it("lists the covers with their type and covers; a parcel cover is set up with the delivered covers and the service fee shown", async () => {
    grant(["read:marine", "write:marine"]);
    renderAt("/operations/open-covers");
    expect(await screen.findByText("MOC-2026-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Parcel / Courier").length).toBeGreaterThan(0);
    expect(screen.getByText(/^Marine \(parcel\) .*10,000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New open cover" }));
    expect(await screen.findByText("Covers on each certificate")).toBeInTheDocument();
    expect(screen.getByText(/Service fee .*438\.00/)).toBeInTheDocument();
    expect(screen.queryByText("Mark-up on invoice %")).not.toBeInTheDocument();
  });

  it("Sales adds and uploads parcels but neither endorses nor bills; read-only users only view", async () => {
    grant(["read:marine", "write:parcel-certificates"]);
    const { unmount } = renderAt("/operations/open-covers/ocv_1");
    fireEvent.click(await screen.findByRole("tab", { name: "Certificates" }));
    expect(await screen.findByRole("button", { name: "Upload parcels" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add parcel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Endorse open policy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reverse certificate" })).toBeInTheDocument();
    expect(screen.getByText("Possible duplicate")).toBeInTheDocument();
    unmount();
    grant(["read:marine"]);
    renderAt("/operations/open-covers/ocv_1");
    fireEvent.click(await screen.findByRole("tab", { name: "Certificates" }));
    await screen.findByText("PCC-2026-000001");
    expect(screen.queryByRole("button", { name: "Upload parcels" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reverse certificate" })).not.toBeInTheDocument();
  });

  it("the approver opens a pending endorsement from My Work and sees the changed fields; Operations endorses", async () => {
    grant(["read:marine", "approve:marine"]);
    service.endorsement.mockResolvedValue(COVER.endorsements[0]);
    service.decideEndorsement.mockResolvedValue({ message: "Endorsement MOE-2026-00001 approved, effective 2026-11-01", data: {} });
    renderAt("/operations/open-covers/ocv_1?endorsement=oce_1");
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByText("AXA premium review").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(service.decideEndorsement).toHaveBeenCalledWith("oce_1", "approve", undefined));
  });

  it("an operations user sees Endorse open policy on an active cover", async () => {
    grant(["read:marine", "write:marine"]);
    renderAt("/operations/open-covers/ocv_1");
    expect(await screen.findByRole("button", { name: "Endorse open policy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload parcels" })).not.toBeInTheDocument();
  });
});
