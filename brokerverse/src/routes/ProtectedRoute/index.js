import React, { useRef, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Toast } from "primereact/toast";
import { Button } from "primereact/button";

import "./index.scss";
import { isAuthenticated } from "../../utility/tokenManager";
import { initializeGlobalToast } from "../../utility/toastUtils";

import AgentNavBar from "../../agentModule/component/navBar";
import NewSideBar from "../../components/SideBar/NewSideBar";
import { menuList } from "../../components/SideBar/list";
import { firstAllowedPath, getUserRoles, isPathAllowed } from "../../utils/menuPermissions";
import ErrorBoundary from "../../components/ErrorBoundary";
import { loadIdleMinutes, startIdleTimer } from "../../utility/idleTimeout";
import { logout } from "../../utility/logout";

const NotAuthorised = () => (
  <div className="protected__layout__not-authorised" role="alert">
    <h2>Not authorised</h2>
    <p>Your role does not give access to this screen. Choose a screen from the menu.</p>
  </div>
);

const ProtectedLayout = () => {
  const toastRef = useRef(null);
  const location = useLocation();
  const [idleWarning, setIdleWarning] = useState(false);

  // Sign out after the configured idle time, with a one-minute warning.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    loadIdleMinutes().then((minutes) => {
      if (cancelled) return;
      stop = startIdleTimer(minutes, {
        onWarn: () => setIdleWarning(true),
        onActive: () => setIdleWarning(false),
        onTimeout: () => logout().catch(() => (window.location.href = "/login")),
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Initialize global toast reference
    initializeGlobalToast(toastRef);

    // Initialize sidebar state based on screen size
    const initializeSidebar = () => {
      if (window.innerWidth > 1024) {
        setSidebarOpen(false);
      }
    };

    initializeSidebar();
  }, []);

  // Handle mobile/tablet sidebar toggle with debouncing
  const toggleSidebar = () => {
    setSidebarOpen((prevState) => {
      return !prevState;
    });
  };

  // Close sidebar when clicking outside on mobile/tablet
  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Close sidebar after navigation (only on mobile/tablet)
  const handleSidebarNavigation = () => {
    // Only close sidebar on mobile and tablet devices
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  // Handle window resize with debouncing
  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Hide sidebar on desktop (larger than tablets)
        if (window.innerWidth > 1024) {
          setSidebarOpen(false);
        }
      }, 100); // 100ms debounce
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Add debug logging for sidebar state changes
  useEffect(() => {
    console.log("Sidebar state changed:", sidebarOpen);
    console.log("Window width:", window.innerWidth);
  }, [sidebarOpen]);

  const Auth = () => {
    const user = isAuthenticated();
    console.log(user, "user");

    return !!user;
  };

  return (
    <div className="protected__layout__container">
      {/* Global Toast for logout messages */}
      <Toast ref={toastRef} position="top-right" />

      {/* Mobile/Tablet Navigation Toggle */}
      <Button
        icon="pi pi-bars"
        className="mobile-nav-toggle"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar();
        }}
        aria-label="Toggle navigation"
      />

      {/* Mobile/Tablet Overlay */}
      {sidebarOpen && (
        <div
          className="mobile-overlay active"
          onClick={closeSidebar}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeSidebar();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <div
        className={`protected__layout__sidebar__container ${
          sidebarOpen ? "mobile-open" : ""
        }`}
      >
        {/* Mobile/Tablet Close Button */}
        <Button
          icon="pi pi-times"
          className="sidebar-close-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSidebar();
          }}
          aria-label="Close sidebar"
        />
        <NewSideBar onNavigate={handleSidebarNavigation} />
      </div>

      {idleWarning && (
        <div className="bv-idle-warning" role="alert">
          You will be signed out in one minute because of inactivity. Move the mouse or press a key to stay signed in.
        </div>
      )}

      <div className="protected__layout__content__space">
        <div className="main__content">
          <div className="protected__layout__header">
            <AgentNavBar />
          </div>
          {!Auth() ? (
            <Navigate to="/login" replace />
          ) : location.pathname === "/" && !isPathAllowed("/", menuList, getUserRoles()) && firstAllowedPath(menuList, getUserRoles()) ? (
            <Navigate to={firstAllowedPath(menuList, getUserRoles())} replace />
          ) : isPathAllowed(location.pathname, menuList, getUserRoles()) ? (
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          ) : (
            <NotAuthorised />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProtectedLayout;
