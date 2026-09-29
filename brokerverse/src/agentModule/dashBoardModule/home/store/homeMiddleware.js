import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_DASHBOARD_DATA } from "../../../../redux/agentActionTypes";
import dashboardService from "../../../../services/dashboardService";
import policyService from "../../../../services/policyService";

const POLICY_PAGE_SIZE = 500;
/** The policy list is not owner-scoped; createdBy carries the creator's id or name. */
const isOwnPolicy = (policy) =>
  ["USER_ID", "USERNAME", "USER_NAME"].some((key) => {
    const value = localStorage.getItem(key);
    return value && policy.createdBy === value;
  });
const isPaid = (policy) => String(policy.paymentStatus || "").toLowerCase() === "paid";
const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

/** Commission per month of policy inception, keyed by year: { "2026": [12 monthly totals] }. */
const commissionByYear = (policies) =>
  policies.reduce((years, policy) => {
    const date = policy.inceptionDate || policy.issuedDate;
    if (!date) return years;
    const year = String(date).slice(0, 4);
    const month = Number(String(date).slice(5, 7)) - 1;
    years[year] = years[year] || Array(12).fill(0);
    years[year][month] += Number(policy.commissionAmount) || 0;
    return years;
  }, {});

const buildDashboardDetails = (home, policies) => ({
  userDetails: {
    name: localStorage.getItem("USER_NAME") || "",
    totalLeads: home.funnel?.leads ?? 0,
    // premium and client figures come from the server, over the same book as the lists (D118)
    totalClients: home.clients ?? new Set(policies.map((p) => p.clientId).filter(Boolean)).size,
    policySold: home.funnel?.policies ?? 0,
    earnedCommission: (home.commission?.paid || 0) + (home.commission?.unpaid || 0),
    collectedPremium: home.premium?.collected ?? sum(policies.filter(isPaid), (p) => p.premiumTotal),
    receivables: home.premium?.receivable ?? sum(policies.filter((p) => !isPaid(p)), (p) => p.premiumTotal),
    grossPremium: home.premium?.gross ?? sum(policies, (p) => p.premiumTotal),
  },
  commission: commissionByYear(policies),
  recentQuotations: home.recentQuotations || [],
  expiringPolicies: home.expiringPolicies || [],
});

export const getDashboardDataMiddleware = createAsyncThunk(
  GET_DASHBOARD_DATA,
  async (_a, { rejectWithValue }) => {
    try {
      const [home, policiesResult] = await Promise.all([
        dashboardService.getAgentHome(),
        policyService.getPolicies(1, POLICY_PAGE_SIZE),
      ]);
      if (!policiesResult.success) throw new Error(policiesResult.error);
      // agents' policy lists are already limited to their book on the server; others keep the policies they created
      const all = policiesResult.data?.data || [];
      const ownPolicies = home.scoped ? all : all.filter(isOwnPolicy);
      return buildDashboardDetails(home, ownPolicies);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
