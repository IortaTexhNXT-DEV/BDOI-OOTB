import React from "react";
import { Outlet, Navigate } from "react-router-dom";

export default function UnprotectedRoutes() {
  let auth = localStorage.getItem("token");
  // return auth === null ? <Outlet /> : <Navigate to="/login"></Navigate>;
  return <Outlet/>
}
