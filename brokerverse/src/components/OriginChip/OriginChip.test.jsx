import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OriginChip, { OriginFilter, isMigrated, loadPath, originColumnBody, policyOriginOf } from "./index";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, o) => {
      const text = typeof o === "string" ? o : (o && o.defaultValue) || key;
      return typeof o === "object" ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k] ?? "") : text;
    },
  }),
}));

const migrated = {
  kind: "migrated", label: "Migrated", legacySystem: "TISPH Excel", legacyNumber: "PC-MLY-2026-000101", loadId: 12, loadNumber: "MIG-000012",
  migratedAt: "2026-11-01T03:12:44Z", migratedByName: "Andrea Lim",
};
const signIn = (permissions) => {
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
};
const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(() => localStorage.clear());

describe("OriginChip", () => {
  it("renders nothing for a record issued in BrokerVerse or without origin", () => {
    const { container } = show(<><OriginChip origin={{ kind: "issued", label: "Issued in BrokerVerse" }} /><OriginChip origin={null} /><OriginChip origin="issued" /></>);
    expect(container.querySelector("[data-testid='origin-chip']")).toBeNull();
    expect(isMigrated({ kind: "issued" })).toBe(false);
    expect(isMigrated("migrated")).toBe(true);
  });

  it("shows Migrated, the legacy number and a link to the load for holders of read:data-load", () => {
    signIn(["read:policies", "read:data-load"]);
    show(<OriginChip origin={migrated} />);
    expect(screen.getByText("Migrated")).toHaveClass("p-tag-value");
    expect(screen.getByText("Legacy no. PC-MLY-2026-000101")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Load MIG-000012" });
    expect(link).toHaveAttribute("href", loadPath(12));
    expect(link).toHaveAttribute("href", "/master/configuration/go-live/loads/12");
    expect(screen.getByText(/Legacy system: TISPH Excel/)).toBeInTheDocument();
  });

  it("shows the load as plain text to users without read:data-load", () => {
    signIn(["read:policies"]);
    show(<OriginChip origin={migrated} />);
    expect(screen.getByText("Load MIG-000012")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("marks a record issued on a migrated policy as Migrated policy, and the renewal of one as a renewal of a legacy policy", () => {
    const claim = { origin: { kind: "issued" }, policyOrigin: "migrated", policyLegacyNumber: "PC-MLY-2026-000101" };
    expect(policyOriginOf(claim)).toEqual({ kind: "migrated", legacyNumber: "PC-MLY-2026-000101" });
    expect(policyOriginOf({ policyOrigin: "issued" })).toBeNull();
    const { rerender } = show(<OriginChip origin={policyOriginOf(claim)} variant="policy" />);
    expect(screen.getByText("Migrated policy")).toBeInTheDocument();
    expect(screen.getByText("Legacy no. PC-MLY-2026-000101")).toBeInTheDocument();
    rerender(<MemoryRouter><OriginChip origin={policyOriginOf(claim)} variant="renewal" /></MemoryRouter>);
    expect(screen.getByText("Renewal of legacy policy")).toBeInTheDocument();
  });

  it("in a list column shows the chip alone, the record's own origin first, the policy's otherwise", () => {
    signIn(["read:data-load"]);
    const { container, rerender } = show(originColumnBody({ origin: migrated }));
    expect(screen.getByText("Migrated")).toBeInTheDocument();
    expect(container.querySelector(".bv-origin__legacy")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<MemoryRouter>{originColumnBody({ origin: { kind: "issued" }, policyOrigin: "migrated", policyLegacyNumber: "X-1" })}</MemoryRouter>);
    expect(screen.getByText("Migrated policy")).toBeInTheDocument();
    rerender(<MemoryRouter>{originColumnBody({ origin: { kind: "issued" }, policyOrigin: "issued" })}</MemoryRouter>);
    expect(container.querySelector("[data-testid='origin-chip']")).toBeNull();
  });
});

describe("OriginFilter", () => {
  it("offers All, Issued in BrokerVerse and Migrated and returns the API value", () => {
    const onChange = jest.fn();
    show(<OriginFilter value="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("origin-filter"));
    expect(screen.getByText("Issued in BrokerVerse")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Migrated"));
    expect(onChange).toHaveBeenCalledWith("migrated");
  });
});
