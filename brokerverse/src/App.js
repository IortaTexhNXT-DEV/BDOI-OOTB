import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Maincomponent from "./routes/MainRoute";
import "./App.scss";
import AgentLogin from "./agentModule/authModule/Login";
import ApproveQuote from "./agentModule/ApproveQuote";
import { isAuthenticated, getUserData } from "./utility/tokenManager";
import { NotificationProvider } from "./context/NotificationContext";
import { fetchSystemSettings } from "./module/SystemSettings/store/systemSettingsSlice";
import { applyAppTitle } from "./utility/applySystemSettings";
import AppDialogs from "./components/AppDialogs";

const App = () => {
  const [authState, setAuthState] = useState(() => {
    const hasToken = isAuthenticated();
    const userData = getUserData();
    return { hasToken, userData };
  });

  const dispatch = useDispatch();
  const appTitle = useSelector(
    (state) => state.systemSettingsReducer?.appTitle || "BrokerVerse"
  );

  const { hasToken, userData } = authState;
  const userName = userData?.displayName || userData?.username || "User";

  useEffect(() => {
    dispatch(
      fetchSystemSettings({
        authenticated: hasToken,
        userName,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    const currentHasToken = isAuthenticated();
    const currentUserData = getUserData();

    if (
      currentHasToken !== authState.hasToken ||
      JSON.stringify(currentUserData) !== JSON.stringify(authState.userData)
    ) {
      setAuthState({ hasToken: currentHasToken, userData: currentUserData });
    }
  }, [authState.hasToken, authState.userData]);

  useEffect(() => {
    applyAppTitle(appTitle, { authenticated: hasToken, userName });

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      if (hasToken) {
        metaDescription.content = `${appTitle} Dashboard - Manage insurance policies, process claims, generate quotes, and track client information.`;
      } else {
        metaDescription.content = `Login to ${appTitle} - Secure access to your insurance broker management platform.`;
      }
    }
  }, [hasToken, userName, appTitle]);

  return (
    <NotificationProvider>
      <div className="App">
        <AppDialogs />
        <Routes>
          <Route
            path="/login"
            element={hasToken ? <Navigate to="/" replace /> : <AgentLogin />}
          />
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
