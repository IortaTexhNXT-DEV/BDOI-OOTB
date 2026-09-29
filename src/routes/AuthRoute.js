import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import UnProtectedRoutes from "./UnProtectedRoutes";
import LoginScreen from "../module/AuthModule/Login/index";
import Cookies from "js-cookie";
import Register from "../module/AuthModule/Register";
import ResetPassward from "../module/AuthModule/ResetPassward"
import VerfyCode from "../module/AuthModule/VerfyCode"

const AuthRoute = () => {
  const token = Cookies.get("token");
  return (
    <>
      <Routes>
        <Route path="login" element={<LoginScreen />} exact />
        <Route path="register" element={<Register />} />
        <Route path="resetpassward" element={<ResetPassward />} />
        <Route path="verifycode" element={<VerfyCode />} />
        {/* <Route
          path=""
          element={token ? <Navigate to="/home" /> : <UnProtectedRoutes />}
        /> */}
      </Routes>
    </>
  );
};

export default AuthRoute;
