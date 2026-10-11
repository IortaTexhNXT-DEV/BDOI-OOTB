import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { REMITTANCE_ROUTES } from "../shared";
import Schedules from "./Schedules";

/** Accounts > Remittance > Setup (/finance/remittance/setup/:tab). R1 has the Schedules tab only. */
const Setup = () => {
  const { tab } = useParams();
  if (tab !== "schedules") return <Navigate to={REMITTANCE_ROUTES.setup("schedules")} replace />;
  return <Schedules />;
};

export default Setup;
