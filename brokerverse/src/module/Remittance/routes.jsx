/**
 * The routes of Accounts > Remittance (R1), mounted by routes/MainRoute.js: the landing, the seven entries of the menu
 * plus Settlement (until R2), the record routes and the addresses of the retired screens, which open their new page
 * (§1.2), keeping their query (?approval=, ?import=new, ?segment=legacy).
 */
import React from "react";
import PropTypes from "prop-types";
import { Navigate, Route, useLocation, useParams } from "react-router-dom";
import InsurerStatements from "../InsurerReconciliation/Statements";
import InsurerStatementWorkspace from "../InsurerReconciliation/Workspace";
import DirectBillProcessing from "./DirectBillProcessing";
import RemittanceExceptions from "./RemittanceExceptions";
import SettlementProcessing from "./Settlement";
import Approvals from "./Approvals";
import Payments from "./Payments";
import Remittances from "./Remittances";
import Landing from "./Landing";
import RemittanceRecord from "./Record";
import Setup from "./Setup";
import { REMITTANCE_ROUTES } from "./shared";

/** The target with the query of the old address added (the target's own parameters win). */
export const redirectTarget = (target, search) => {
  const [path, query = ""] = target.split("?");
  const merged = new URLSearchParams(query);
  new URLSearchParams(search || "").forEach((value, key) => {
    if (!merged.has(key)) merged.set(key, value);
  });
  const q = merged.toString();
  return q ? `${path}?${q}` : path;
};

/** Opens `to` (or `to(params)`) in place of a retired address. */
export const Redirect = ({ to }) => {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={redirectTarget(typeof to === "function" ? to(params) : to, search)} replace />;
};

Redirect.propTypes = { to: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired };

const R = REMITTANCE_ROUTES;
const OLD = "finance/remittance";

/** Retired address -> new page (§1.2; D-21 for Reconciliation until R3). */
export const REDIRECTS = [
  [`${OLD}/automated/execute`, R.remittances],
  [`${OLD}/tracking/status`, R.remittances],
  [`${OLD}/statements/generate`, R.remittances],
  [`${OLD}/reconciliation`, R.reconciliation],
  [`${OLD}/bulkprocessing`, `${R.remittances}?import=new`],
  [`${OLD}/scheduling`, R.setup("schedules")],
  [`${OLD}/electronictransfer`, `${R.payments}?segment=legacy`],
  [`${OLD}/approval`, R.approvals],
  [`${OLD}/directbill`, R.billing],
  [`${OLD}/agencybill`, R.remittances],
  [`${OLD}/adjustments`, R.remittances],
  [`${OLD}/notifications`, R.remittances],
  [`${OLD}/history`, R.remittances],
  [`${OLD}/analytics`, R.remittances],
  [`${OLD}/setup`, R.setup("schedules")],
  ["/accounts/insurer-reconciliation/statements", R.reconciliation],
];

export const remittanceRoutes = () => [
  <Route key="landing" path={OLD} element={<Landing />} />,
  <Route key="remittances" path={`${OLD}/remittances`} element={<Remittances />} />,
  <Route key="record" path={`${OLD}/remittances/:id`} element={<RemittanceRecord />} />,
  <Route key="approvals" path={`${OLD}/approvals`} element={<Approvals />} />,
  <Route key="payments" path={`${OLD}/payments`} element={<Payments />} />,
  <Route key="reconciliation" path={`${OLD}/reconciliation/insurer-statements`} element={<InsurerStatements />} />,
  <Route key="statement" path={`${OLD}/reconciliation/statements/:id`} element={<InsurerStatementWorkspace />} />,
  <Route key="exceptions" path={`${OLD}/exceptions`} element={<RemittanceExceptions />} />,
  <Route key="billing" path={`${OLD}/billing`} element={<DirectBillProcessing />} />,
  <Route key="setup" path={`${OLD}/setup/:tab`} element={<Setup />} />,
  <Route key="settlement" path={`${OLD}/settlement/process`} element={<SettlementProcessing />} />,
  <Route key="old-statement" path="/accounts/insurer-reconciliation/statements/:id" element={<Redirect to={(p) => R.statement(p.id)} />} />,
  ...REDIRECTS.map(([from, to]) => <Route key={from} path={from} element={<Redirect to={to} />} />),
];
