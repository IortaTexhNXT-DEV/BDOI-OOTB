import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../../../i18n";
import postingRulesService from "../../../services/postingRulesService";
import AccountingFlow from "./index";
import { accountOptions, filterEvents, groupByArea } from "./flowView";

jest.mock("../../../services/postingRulesService", () => ({
  __esModule: true,
  default: { flow: jest.fn(), flowExample: jest.fn(), downloadFlow: jest.fn() },
}));

// the first render of a suite loads the PrimeReact styles, which takes a few seconds on a loaded machine
jest.setTimeout(20000);

const role = (glCode, glName, over = {}) => ({ kind: "role", role: "r", label: "Role", source: "Premiums receivable (Account Determination › Premium)", glCode, glName, glActive: true,
  mapping: null, configure: "/master/finance/premium-account-setup", fallback: null, options: null, pendingChange: null, ...over });
const line = (lineNo, side, amount, account, over = {}) => ({ lineNo, side, amountKey: `key_${lineNo}`, amount, formula: null, perParticipant: false, narration: null,
  accountType: "role", accountRef: "premium_receivable", fallbackRole: null, condition: null, account, ...over });
const event = (over) => ({ module: "policies", summary: null, screen: "/agent/policy", where: "Operations › Policy", approval: "None: posted when the policy is issued", approvalControl: null,
  authority: null, posting: "posted", postingText: "Posted at once", alwaysPosted: null, ruleId: 12, version: 2, effectiveFrom: "2000-01-01", approvedAt: null, scheduled: null,
  pending: null, lastPosted: null, mappingPending: false, settings: [], ...over });

const issue = event({
  eventCode: "policy.issue.broker_billed", label: "Policy issued – broker billed", area: "premium", when: "A broker-billed policy is issued",
  summary: "Premium billed to the client.", mappingPending: true, lastPosted: "2026-10-08",
  settings: [{ key: "accounting.split_premium_taxes", value: true }],
  lines: [
    line(2, "Cr", "Premium due to the insurer", role("210245", "Accounts Payable - Insurance Company", { mapping: "provisional" }),
      { perParticipant: true, formula: "Gross premium − brokerage commission", amountKey: "due_to_insurer" }),
    line(1, "Dr", "Gross premium billed to the client", role("1202001", "Premiums Receivable – Direct Clients", { mapping: "outside-chart" }), { amountKey: "gross" }),
    line(3, "Cr", "VAT on the premium", role("210245", "Accounts Payable - Insurance Company", { mapping: "provisional" }),
      { condition: { name: "Premium taxes booked separately", on: true }, amountKey: "vat" }),
  ],
});
const receipt = event({
  eventCode: "receipt.apply", label: "Premium collection applied", area: "collections", when: "An official receipt is applied to a bill", screen: "/accounts/receipts",
  where: "Accounts › Receipts", ruleId: 7, version: 1, pending: { changeId: 4, kind: "posting-rule-version", version: 2, effectiveFrom: "2026-11-01", requestedBy: "Liza Santos",
    requestedAt: "2026-10-08T02:00:00Z" },
  lines: [
    line(1, "Dr", "Amount of the receipt applied to the bill", { kind: "resolver", source: "Bank account of the receipt or payment; else the cash account of the payment mode", glCode: null,
      glName: null, mapping: null, configure: "/master/finance/account-determination", fallback: null, pendingChange: null,
      options: [{ name: "Cash", glCode: "100000", glName: "Cash on Hand", mapping: null }, { name: "GCash", glCode: "1102002", glName: "E-wallet", mapping: "outside-chart" }] },
    { accountType: "resolver", accountRef: "bank_account" }),
    line(2, "Cr", "Amount of the receipt applied to the bill", role("1202001", "Premiums Receivable – Direct Clients")),
  ],
});
const incentive = event({
  eventCode: "incentive.accrual", label: "Incentives approved", area: "incentives", when: "Calculated incentives are approved", screen: "/incentive/approvals", where: "Accounts › Incentive › Approvals",
  lines: [line(1, "Dr", "Incentives approved", role("4401020", "Incentive Expense")), line(2, "Cr", "Incentives approved", role("2203007", "Incentives Payable", { mapping: "inactive", glActive: false }))],
  mappingPending: true,
});
const yearEnd = event({
  eventCode: "year_end.closing", label: "Year-end closing", area: "system", module: "system", fixed: true, ruleId: null, version: null, when: "The year-end close is run",
  screen: "/accounts/period-end/year-end", where: "Accounts › Period End › Year-End Close", lines: [line(1, "Cr", "Net income of the year", role("340020", "Current Earnings"))],
});
const flow = (over = {}) => ({
  asOf: "2026-10-09", edition: "3F9A21C7", controls: { autoPost: true }, provisionalAccounts: ["210245"],
  areas: [{ code: "premium", name: "Premium billing", count: 1 }, { code: "collections", name: "Collections", count: 1 }, { code: "incentives", name: "Incentives", count: 1 },
    { code: "system", name: "Other system journals", count: 1 }],
  mapping: { state: "incomplete", pending: [{ item: "Premium payable to insurers", kind: "role", glCode: "210245", glName: "Accounts Payable - Insurance Company", reason: "provisional",
    events: [{ eventCode: "policy.issue.broker_billed", label: "Policy issued – broker billed" }], configure: "/master/finance/premium-account-setup" }] },
  pendingChanges: [{ changeId: 4, kind: "posting-rule-version", kindLabel: "New posting rule version", target: "Premium collection applied", eventCode: "receipt.apply",
    requestedBy: "Liza Santos", requestedAt: "2026-10-08T02:00:00Z" }],
  events: [issue, receipt, incentive], systemJournals: [yearEnd], ...over,
});
const example = (over = {}) => ({ eventCode: "policy.issue.broker_billed", coInsurance: false, coInsurable: true, sample: [{ amount: "Gross premium billed to the client", value: 11200 }],
  lines: [{ accountCode: "1202001", accountName: "Premiums Receivable", debit: 11200, credit: 0, example: false },
    { accountCode: "210245", accountName: "Accounts Payable - Insurance Company", debit: 0, credit: 11200, example: false }],
  totalDebit: 11200, totalCredit: 11200, balanced: true, omitted: ["VAT on the premium"], ...over });

const Where = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};
const renderAt = (path = "/master/finance/accounting-flow") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/master/finance/accounting-flow" element={<><AccountingFlow /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const signInAs = (roles, permissions) => {
  window.localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  window.localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const card = (title) => screen.getByRole("article", { name: title });
/** The page once the reference is on screen. */
const loaded = () => screen.findByText(/^\d+ of \d+ events$/);

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  signInAs(["tis-finance"], ["read:masters", "read:journal-vouchers"]);
  postingRulesService.flow.mockResolvedValue(flow());
  postingRulesService.flowExample.mockResolvedValue(example());
  postingRulesService.downloadFlow.mockResolvedValue(undefined);
});

describe("flowView", () => {
  it("filters by text, module, account and mapping state, and groups by module", () => {
    const data = flow();
    expect(filterEvents(data, { q: "1102002" }).map((e) => e.eventCode)).toEqual(["receipt.apply"]);
    expect(filterEvents(data, { q: "receipt.apply" }).map((e) => e.eventCode)).toEqual(["receipt.apply"]);
    expect(filterEvents(data, { modules: ["premium", "system"] }).map((e) => e.eventCode)).toEqual(["policy.issue.broker_billed", "year_end.closing"]);
    expect(filterEvents(data, { account: "1202001" }).map((e) => e.eventCode)).toEqual(["policy.issue.broker_billed", "receipt.apply"]);
    expect(filterEvents(data, { pending: true }).map((e) => e.eventCode)).toEqual(["policy.issue.broker_billed", "incentive.accrual"]);
    expect(groupByArea(data, filterEvents(data, { pending: true })).map((g) => g.area.code)).toEqual(["premium", "incentives"]);
    expect(accountOptions(data).find((o) => o.value === "1102002")).toEqual({ value: "1102002", label: "1102002 E-wallet" });
  });
});

describe("Accounting Flow", () => {
  it("lists the events under their modules in cycle order with contents, facts and entries in business words", async () => {
    renderAt();
    await loaded();
    expect(screen.getByRole("heading", { level: 1, name: "Accounting Flow" })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Premium billing1", "Collections1", "Incentives1", "Other system journals1"]);
    const contents = screen.getByRole("navigation", { name: "Contents" });
    expect(within(contents).getByRole("button", { name: /Premium collection applied/ })).toBeInTheDocument();
    const c = card("Policy issued – broker billed");
    expect(within(c).getByText("A broker-billed policy is issued")).toBeInTheDocument();
    expect(within(c).getByText("Operations › Policy")).toBeInTheDocument();
    expect(within(c).getByText("None: posted when the policy is issued")).toBeInTheDocument();
    const rows = within(c).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Dr", "Cr", "Cr"]);
    expect(within(rows[1]).getByText("Premium due to the insurer")).toBeInTheDocument();
    expect(within(rows[1]).getByText("For each insurer")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Only when premium taxes booked separately")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Mapping pending")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Map the account" })).toHaveAttribute("href", "/master/finance/premium-account-setup");
    expect(within(card("Incentives approved")).getByText("Account inactive")).toBeInTheDocument();
    expect(within(card("Year-end closing")).getByText("Fixed entry")).toBeInTheDocument();
    expect(screen.getByText("4 of 4 events")).toBeInTheDocument();
  });

  it("shows no rule code, amount key or setting key, and no Open the rule, to a user who cannot change posting rules", async () => {
    renderAt();
    await loaded();
    const text = document.body.textContent;
    for (const code of ["policy.issue.broker_billed", "due_to_insurer", "premium_receivable", "accounting.split_premium_taxes", "v2"]) expect(text).not.toContain(code);
    expect(screen.queryByRole("button", { name: "Open the rule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Technical details/ })).not.toBeInTheDocument();
  });

  it("gives finance administrators the technical details and Open the rule on the event", async () => {
    signInAs(["tis-finance"], ["read:masters", "write:posting-rules", "approve:posting-rules"]);
    renderAt();
    const c = await screen.findByRole("article", { name: "Policy issued – broker billed" });
    fireEvent.click(within(c).getByRole("button", { name: /Technical details/ }));
    expect(within(c).getByText(/policy\.issue\.broker_billed · version 2/)).toBeInTheDocument();
    expect(within(c).getByText("accounting.split_premium_taxes = true")).toBeInTheDocument();
    expect(within(card("Year-end closing")).queryByRole("button", { name: "Open the rule" })).not.toBeInTheDocument();
    fireEvent.click(within(c).getByRole("button", { name: "Open the rule" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/master/finance/posting-rules?event=policy.issue.broker_billed");
  });

  it("shows the account mapping status, the pending change and the accounts of a map", async () => {
    signInAs(["tis-finance"], ["read:masters", "write:posting-rules", "approve:posting-rules"]);
    renderAt();
    expect(await screen.findByText("Rules in force on 09/10/2026 · Edition 3F9A21C7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account mapping: Incomplete" }));
    expect(await screen.findByText("Premium payable to insurers: provisional account 210245")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^1 change pending approval/ })).toHaveAttribute("href", "/master/finance/configuration-approvals");
    const c = card("Premium collection applied");
    expect(within(c).getByText("Change pending approval")).toBeInTheDocument();
    fireEvent.click(within(c).getByRole("button", { name: "Accounts (2)" }));
    // the panel is placed against its button, which jsdom cannot measure: read it hidden
    const [panel] = await screen.findAllByRole("dialog", { name: /Bank account of the receipt/, hidden: true });
    expect(within(panel).getByText("1102002 E-wallet")).toBeInTheDocument();
    expect(within(panel).getByText("Mapping pending")).toBeInTheDocument();
  });

  it("filters from the address, shows an empty state and clears the filters", async () => {
    renderAt("/master/finance/accounting-flow?account=1202001");
    expect(await screen.findByText("2 of 4 events")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Incentives approved" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search events, accounts or amounts" }), { target: { value: "nothing like this" } });
    expect(await screen.findByText("No event matches these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("4 of 4 events")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Mapping pending only" }));
    expect(await screen.findByText("2 of 4 events")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("pending=1");
  });

  it("loads the example on demand and keeps it on screen while the co-insured one loads", async () => {
    renderAt();
    const c = await screen.findByRole("article", { name: "Policy issued – broker billed" });
    expect(postingRulesService.flowExample).not.toHaveBeenCalled();
    fireEvent.click(within(c).getByRole("button", { name: "Example" }));
    expect(await within(c).findByText("Balanced")).toBeInTheDocument();
    expect(postingRulesService.flowExample).toHaveBeenCalledWith("policy.issue.broker_billed", false);
    let resolve;
    postingRulesService.flowExample.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    fireEvent.click(within(c).getByText("Two insurers (60 / 40)"));
    expect(within(c).getByText("Balanced")).toBeInTheDocument();
    expect(postingRulesService.flowExample).toHaveBeenLastCalledWith("policy.issue.broker_billed", true);
    await act(async () => resolve(example({ coInsurance: true, omitted: [] })));
    await waitFor(() => expect(within(c).queryByText(/Not in this example/)).not.toBeInTheDocument());
  });

  it("exports the reference to Excel and the handbook to PDF", async () => {
    renderAt();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByText("Accounting reference (Excel)"));
    await waitFor(() => expect(postingRulesService.downloadFlow).toHaveBeenCalledWith("xlsx"));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByText("Accounting entries handbook (PDF)"));
    await waitFor(() => expect(postingRulesService.downloadFlow).toHaveBeenCalledWith("pdf"));
  });

  it("shows an inline error with Try again when the reference cannot be loaded", async () => {
    postingRulesService.flow.mockRejectedValueOnce(new Error("Server unavailable"));
    renderAt();
    expect(await screen.findByText("Could not load the accounting flow: Server unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Premium collection applied" })).toBeInTheDocument();
  });
});
