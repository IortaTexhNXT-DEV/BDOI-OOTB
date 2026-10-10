import React from "react";
import { act, render, screen } from "@testing-library/react";
import { menuList } from "../components/SideBar/list";
import { flattenLeaves } from "../components/SideBar/menuTree";
import { filterMenuForRoles, isPathAllowed } from "../utils/menuPermissions";
import { blockedFeatureFor, clearFeatureState, featureStatus, hasFeatureState, setFeatureState, withoutFeatures } from "./entitlements";
import Feature, { useFeature } from "./Feature";

const PAYABLES = { key: "payables", status: "off", menus: ["Accounts > Payables > Supplier Invoices", "Accounts > Payables > Supplier Payments", "Accounts > Payables > AP Ageing"], routes: [] };
const LINES = { key: "lines-employee-benefits", status: "off", menus: [], routes: ["/agent/employee-benefit"] };
const WIN_BACK = { key: "win-back", status: "read-only", menus: [], routes: [] };

const names = (menu) => flattenLeaves(menu).map((l) => [...l.ancestors.map((a) => a.name), l.item.name].join(" > "));

afterEach(() => clearFeatureState());

describe("feature entitlements on the screens", () => {
  it("leaves the menu entries of features that are off out of the menu, for every role", () => {
    setFeatureState([PAYABLES]);
    const finance = names(filterMenuForRoles(menuList, ["tis-finance"]));
    expect(finance).toContain("Accounts > Payables > Suppliers");
    expect(finance).not.toContain("Accounts > Payables > Supplier Invoices");
    const admin = names(filterMenuForRoles(menuList, ["system-admin"]));
    expect(admin).not.toContain("Accounts > Payables > AP Ageing");
    expect(names(withoutFeatures(menuList, []))).toContain("Accounts > Payables > AP Ageing");
  });

  it("blocks the addresses of a feature that is off: its menu entries and its routes", () => {
    setFeatureState([PAYABLES, LINES]);
    expect(blockedFeatureFor("/accounts/payables/invoices", menuList)).toBe("payables");
    expect(blockedFeatureFor("/accounts/payables/invoices/12", menuList)).toBe("payables");
    expect(blockedFeatureFor("/accounts/payables/suppliers", menuList)).toBeNull();
    expect(blockedFeatureFor("/agent/employee-benefit/create-quote", menuList)).toBe("lines-employee-benefits");
    expect(blockedFeatureFor("/accounts/receipts", menuList)).toBeNull();
    expect(isPathAllowed("/accounts/payables/invoices", menuList, ["tis-finance"])).toBe(false);
  });

  it("keeps a read-only feature visible and a feature it does not know on", () => {
    setFeatureState([WIN_BACK]);
    expect(featureStatus("win-back")).toBe("read-only");
    expect(featureStatus("a-later-screen")).toBe("on");
    expect(blockedFeatureFor("/renewal/lapse-management", menuList)).toBeNull();
  });

  it("shows the platform section to the iorta TechNXT platform administrator only", () => {
    setFeatureState([]);
    expect(names(filterMenuForRoles(menuList, ["iorta-platform-admin"]))).toEqual(["Master > Platform > Features & Releases"]);
    expect(names(filterMenuForRoles(menuList, ["system-admin"]))).not.toContain("Master > Platform > Features & Releases");
    expect(names(filterMenuForRoles(menuList, ["tis-it-admin"]))).toContain("Master > System Configuration > Features & Releases");
    expect(names(filterMenuForRoles(menuList, ["tis-general-manager"]))).toContain("Master > System Configuration > Features & Releases");
    expect(isPathAllowed("/master/platform/features", menuList, ["tis-superid", "system-admin"])).toBe(false);
  });

  it("remembers the state of the environment between visits", () => {
    expect(hasFeatureState()).toBe(false);
    setFeatureState([PAYABLES]);
    expect(hasFeatureState()).toBe(true);
    expect(JSON.parse(localStorage.getItem("FEATURE_STATE"))).toEqual([PAYABLES]);
  });
});

describe("<Feature> and useFeature", () => {
  const Probe = () => {
    const f = useFeature("coinsurance");
    return <span data-testid="probe">{f.status}</span>;
  };

  it("shows a section while its feature is on and follows a change of state", () => {
    setFeatureState([{ key: "coinsurance", status: "off", menus: [], routes: [] }]);
    render(
      <>
        <Feature name="coinsurance"><span>participants</span></Feature>
        <Feature name="win-back" readOnly><span>campaigns</span></Feature>
        <Probe />
      </>,
    );
    expect(screen.queryByText("participants")).toBeNull();
    expect(screen.getByText("campaigns")).toBeInTheDocument();
    expect(screen.getByTestId("probe")).toHaveTextContent("off");
    act(() => setFeatureState([WIN_BACK]));
    expect(screen.getByText("participants")).toBeInTheDocument();
    expect(screen.getByText("campaigns")).toBeInTheDocument();
    expect(screen.getByTestId("probe")).toHaveTextContent("on");
  });
});
