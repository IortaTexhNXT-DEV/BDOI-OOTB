import { approverGroups, coverGroups, delegationProblems, filterDelegations, periodDays } from "./delegations";

const people = [
  { id: "m", name: "Mariela", department: "Finance and Accounting", approves: ["journal_voucher", "payment_voucher"], platformOnly: false },
  { id: "c", name: "Chrystal", department: "Finance and Accounting", approves: ["journal_voucher"], platformOnly: false },
  { id: "s", name: "Sales One", department: "Sales", approves: [], platformOnly: false },
  { id: "a", name: "Accountant", department: null, approves: ["journal_voucher"], platformOnly: true },
];
const departments = [{ name: "Sales" }, { name: "Finance and Accounting" }];

describe("delegation rules", () => {
  it("offers as approvers away only the people who can approve, by department, base platform users on request", () => {
    expect(approverGroups(people, departments).map((g) => [g.label, g.items.map((i) => i.value)])).toEqual([["Finance and Accounting", ["m", "c"]]]);
    expect(approverGroups(people, departments, { base: true }).map((g) => g.label)).toEqual(["Finance and Accounting", "Other"]);
  });

  it("disables a person covering who cannot approve a chosen transaction, and leaves out the approver away", () => {
    const groups = coverGroups(people, departments, { delegatorId: "m", types: ["journal_voucher", "payment_voucher"] });
    const items = groups.flatMap((g) => g.items);
    expect(items.map((i) => i.value)).toEqual(["s", "c"]);
    expect(items.find((i) => i.value === "c")).toMatchObject({ disabled: true, missing: ["payment_voucher"] });
    expect(coverGroups(people, departments, { delegatorId: "m", types: [], me: "c", approval: false }).flatMap((g) => g.items).map((i) => i.value)).toEqual(["s"]);
  });

  it("checks dates on the business date and the longest period", () => {
    const form = { delegatorId: "m", delegateId: "c", transactionTypes: ["journal_voucher"], dateFrom: "2026-10-09", dateTo: "2026-10-08" };
    expect(delegationProblems(form, { asOf: "2026-10-10" })).toEqual({ dateFrom: "past", dateTo: "beforeStart" });
    expect(delegationProblems({ ...form, dateFrom: "2026-10-10", dateTo: "2027-02-01" }, { asOf: "2026-10-10", maxDays: 90 })).toEqual({ dateTo: "tooLong" });
    expect(delegationProblems({ ...form, delegateId: "m", dateFrom: "2026-10-10", dateTo: "2026-10-14" }, { asOf: "2026-10-10" })).toEqual({ delegateId: "self" });
    expect(periodDays("2026-10-10", "2026-10-14")).toBe(5);
  });

  it("filters by person, department and transaction", () => {
    const rows = [{ delegatorName: "Mariela", delegateName: "Chrystal", delegatorDepartment: "Finance and Accounting", delegateDepartment: "Finance and Accounting",
      transactionTypes: ["journal_voucher"] }];
    expect(filterDelegations(rows, { search: "chry" })).toHaveLength(1);
    expect(filterDelegations(rows, { department: "Sales" })).toHaveLength(0);
    expect(filterDelegations(rows, { type: "payment_voucher" })).toHaveLength(0);
  });
});
