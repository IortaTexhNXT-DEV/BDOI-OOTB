import authService from "../services/authService";
import { showLogoutSuccessMessage } from "./toastUtils";
import logger from "./logger";
import { setRevealOn } from "./piiReveal";

/**
 * Logout utility function
 * Calls logout API and clears all authentication data
 */
export const logout = async () => {
  try {
    // the "Show full identifiers" switch does not outlive the sign-in
    setRevealOn(false);
    // Call logout API and clear localStorage
    await authService.logout();
    
    // Show success message
    showLogoutSuccessMessage();
    
    // Reduced delay for better UX with real API
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  } catch (error) {
    logger.error("Logout error:", error);
    // Force redirect even if there's an error
    window.location.href = "/login";
  }
};

export default logout;
