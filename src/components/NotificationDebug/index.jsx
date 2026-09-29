import React, { useState, useEffect } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { getAccessToken, isAuthenticated } from "../../utility/tokenManager";
import notificationService from "../../services/notificationService";

const NotificationDebug = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [loading, setLoading] = useState(false);

  const checkAuthStatus = () => {
    const token = getAccessToken();
    const isAuth = isAuthenticated();

    setDebugInfo({
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "No token",
      isAuthenticated: isAuth,
      timestamp: new Date().toLocaleString(),
    });
  };

  const testNotificationAPI = async () => {
    setLoading(true);
    try {
      console.log("Testing notification API...");
      const response = await notificationService.getNotifications();
      console.log("API Response:", response);
      setDebugInfo((prev) => ({
        ...prev,
        apiTest: "Success",
        apiResponse: response,
        lastTest: new Date().toLocaleString(),
      }));
    } catch (error) {
      console.error("API Test Error:", error);
      setDebugInfo((prev) => ({
        ...prev,
        apiTest: "Failed",
        apiError: error.message,
        lastTest: new Date().toLocaleString(),
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <div className="notification-debug">
      <Card title="Notification API Debug">
        <div className="debug-info">
          <h4>Authentication Status</h4>
          <p>
            <strong>Has Token:</strong> {debugInfo.hasToken ? "Yes" : "No"}
          </p>
          <p>
            <strong>Token Length:</strong> {debugInfo.tokenLength}
          </p>
          <p>
            <strong>Token Preview:</strong> {debugInfo.tokenPreview}
          </p>
          <p>
            <strong>Is Authenticated:</strong>{" "}
            {debugInfo.isAuthenticated ? "Yes" : "No"}
          </p>
          <p>
            <strong>Last Check:</strong> {debugInfo.timestamp}
          </p>

          {debugInfo.apiTest && (
            <>
              <h4>API Test Results</h4>
              <p>
                <strong>Test Status:</strong> {debugInfo.apiTest}
              </p>
              {debugInfo.apiError && (
                <p>
                  <strong>Error:</strong> {debugInfo.apiError}
                </p>
              )}
              <p>
                <strong>Last Test:</strong> {debugInfo.lastTest}
              </p>
            </>
          )}
        </div>

        <div className="debug-actions">
          <Button
            label="Check Auth Status"
            onClick={checkAuthStatus}
            className="p-button-outlined"
          />
          <Button
            label="Test Notification API"
            onClick={testNotificationAPI}
            loading={loading}
            className="p-button-primary"
          />
        </div>
      </Card>
    </div>
  );
};

export default NotificationDebug;
