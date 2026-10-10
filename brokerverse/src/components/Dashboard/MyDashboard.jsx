import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { defaultDashboard } from "./personas";

/** /dashboard: the dashboard of the signed-in user's persona (personas.js); My Work for a role without one. */
const MyDashboard = () => {
  const [target] = useState(() => defaultDashboard());
  return <Navigate to={target ? target.path : "/my-work"} replace />;
};

export default MyDashboard;
