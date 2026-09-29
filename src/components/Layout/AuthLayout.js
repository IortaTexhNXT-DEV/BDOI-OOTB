import React from "react";
import { Outlet } from "react-router-dom";
// import AuthenticationIndex from "../auth";

const AuthLayout = () => {
  const layoutStyle = {
    minWidth: "600px",
    minHeight: "600px",
  };

  const outLineStyle = {
    width: "500px",
  };

  return (
    <div className="outline-app">
      <div className="flex">
        <div className="col-3" style={{ padding: "unset" }}>
          {/* <AuthenticationIndex /> */}
        </div>
        <div
          className="col-9 layout flex justify-content-center align-items-center"
          style={layoutStyle}
        >
          <div style={outLineStyle}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
