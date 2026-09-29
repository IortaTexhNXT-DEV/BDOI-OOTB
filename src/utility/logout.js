import authService from "../services/authService";
import { showLogoutSuccessMessage } from "./toastUtils";

/**
 * Logout utility function
 * Calls logout API and clears all authentication data
 */
export const logout = async () => {
  try {
    // Call logout API and clear localStorage
    await authService.logout();
    
    // Show success message
    showLogoutSuccessMessage();
    
    // Reduced delay for better UX with real API
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  } catch (error) {
    console.error("Logout error:", error);
    // Force redirect even if there's an error
    window.location.href = "/login";
  }
};

export default logout;
