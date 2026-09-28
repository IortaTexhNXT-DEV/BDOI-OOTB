import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Maincomponent from "./routes/MainRoute";
import "./App.scss";
import AgentLogin from "./agentModule/authModule/Login";
import ApproveQuote from "./agentModule/ApproveQuote";
import { isAuthenticated, getUserData } from "./utility/tokenManager";
import { NotificationProvider } from "./context/NotificationContext";

const App = () => {
  // Use a more stable authentication check
  const [authState, setAuthState] = useState(() => {
    const hasToken = isAuthenticated();
    const userData = getUserData();
    return { hasToken, userData };
  });

  const { hasToken, userData } = authState;
  const userName = userData?.displayName || userData?.username || "User";

  // Update auth state only when needed
  useEffect(() => {
    const currentHasToken = isAuthenticated();
    const currentUserData = getUserData();

    // Only update if authentication state has actually changed
    if (
      currentHasToken !== authState.hasToken ||
      JSON.stringify(currentUserData) !== JSON.stringify(authState.userData)
    ) {
      setAuthState({ hasToken: currentHasToken, userData: currentUserData });
    }
  }, [authState.hasToken, authState.userData]);

  useEffect(() => {
    // Set dynamic page title based on authentication status
    if (hasToken) {
      document.title = `INXT Broker Suite - Dashboard | ${userName || "User"}`;
    } else {
      document.title =
        "INXT Broker Suite - Login | Insurance Broker Management";
    }

    // Update meta tags for authenticated pages
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      if (hasToken) {
        metaDescription.content =
          "INXT Broker Suite Dashboard - Manage insurance policies, process claims, generate quotes, and track client information in one comprehensive platform.";
      } else {
        metaDescription.content =
          "Login to INXT Broker Suite - Secure access to your insurance broker management platform. Manage policies, claims, and clients efficiently.";
      }
    }
  }, [hasToken, userName]);

  return (
    <NotificationProvider>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={hasToken ? <Navigate to="/" replace /> : <AgentLogin />}
          />
          {/* Public route for customer quote approval */}
          <Route path="/approve-quote" element={<ApproveQuote />} />
          <Route
            path="/"
            element={
              hasToken ? <Maincomponent /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/*"
            element={
              hasToken ? <Maincomponent /> : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </div>
    </NotificationProvider>
  );
};

export default App;
