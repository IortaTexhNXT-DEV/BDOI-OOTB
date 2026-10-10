import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { REDIRECTS, redirectTarget, remittanceRoutes } from "./routes";

jest.mock("../InsurerReconciliation/Statements", () => () => <div>Insurer statements</div>);
jest.mock("../InsurerReconciliation/Workspace", () => () => <div>Statement workspace</div>);
jest.mock("./DirectBillProcessing", () => () => <div>Direct bill</div>);
jest.mock("./ElectronicTransfer", () => () => <div>Transfers</div>);
jest.mock("./Approvals", () => () => <div>Approvals</div>);
jest.mock("./Record", () => () => <div>Remittance record</div>);
jest.mock("./RemittanceExceptions", () => () => <div>Exceptions</div>);
jest.mock("./Settlement", () => () => <div>Settlement</div>);
jest.mock("./Remittances", () => () => <div>Remittances</div>);
jest.mock("./Landing", () => () => <div>Landing</div>);
jest.mock("./Setup", () => () => <div>Setup</div>);

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
};

const open = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>{remittanceRoutes()}</Routes>
    <Where />
  </MemoryRouter>
);

describe("Accounts > Remittance routes", () => {
  it("adds the query of the old address to the target, the target's own parameters first", () => {
    expect(redirectTarget("/finance/remittance/approvals", "?approval=21")).toBe("/finance/remittance/approvals?approval=21");
    expect(redirectTarget("/finance/remittance/payments?segment=legacy", "?segment=x&id=3")).toBe("/finance/remittance/payments?segment=legacy&id=3");
    expect(redirectTarget("/finance/remittance/remittances", "")).toBe("/finance/remittance/remittances");
  });

  it.each([
    ["/finance/remittance/automated/execute", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/tracking/status", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/statements/generate", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/reconciliation", "/finance/remittance/reconciliation/insurer-statements", "Insurer statements"],
    ["/finance/remittance/bulkprocessing", "/finance/remittance/remittances?import=new", "Remittances"],
    ["/finance/remittance/scheduling", "/finance/remittance/setup/schedules", "Setup"],
    ["/finance/remittance/electronictransfer", "/finance/remittance/payments?segment=legacy", "Transfers"],
    ["/finance/remittance/approval?approval=21", "/finance/remittance/approvals?approval=21", "Approvals"],
    ["/finance/remittance/directbill", "/finance/remittance/billing", "Direct bill"],
    ["/finance/remittance/agencybill", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/adjustments", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/notifications", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/history", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/analytics", "/finance/remittance/remittances", "Remittances"],
    ["/finance/remittance/setup", "/finance/remittance/setup/schedules", "Setup"],
    ["/accounts/insurer-reconciliation/statements", "/finance/remittance/reconciliation/insurer-statements", "Insurer statements"],
    ["/accounts/insurer-reconciliation/statements/42", "/finance/remittance/reconciliation/statements/42", "Statement workspace"],
  ])("the old address %s lands on %s", (from, to, page) => {
    open(from);
    expect(screen.getByTestId("where")).toHaveTextContent(to);
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  it("every retired address of §1.2 is redirected, and the entries keep their pages", () => {
    expect(REDIRECTS).toHaveLength(16);
    for (const [path, page] of [["/finance/remittance", "Landing"], ["/finance/remittance/exceptions", "Exceptions"], ["/finance/remittance/settlement/process", "Settlement"],
      ["/finance/remittance/setup/schedules", "Setup"], ["/finance/remittance/remittances/rm_21", "Remittance record"], ["/finance/remittance/remittances", "Remittances"]]) {
      const { unmount } = open(path);
      expect(screen.getByTestId("where")).toHaveTextContent(path);
      expect(screen.getByText(page)).toBeInTheDocument();
      unmount();
    }
  });
});
