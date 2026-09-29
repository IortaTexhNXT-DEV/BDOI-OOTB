import { Toast } from "primereact/toast";
import { createRef } from "react";

// Global toast reference
let globalToastRef = null;

/**
 * Initialize the global toast reference
 * This should be called from the main App component
 */
export const initializeGlobalToast = (toastRef) => {
  globalToastRef = toastRef;
};

/**
 * Show logout success message
 */
export const showLogoutSuccessMessage = () => {
  if (globalToastRef && globalToastRef.current) {
    globalToastRef.current.show({
      severity: 'success',
      summary: 'Logout successfully',
      life: 2000,
      icon: 'pi pi-check-circle',
      className: 'logout-success'
    });
  } else {
    // Fallback: create a temporary toast if global ref is not available
    const tempToast = createRef();
    const tempToastElement = document.createElement('div');
    document.body.appendChild(tempToastElement);
    
    // This is a fallback - in practice, the global toast should be used
  }
};

/**
 * Show success message with custom text
 */
export const showSuccessMessage = (message, summary = 'Success') => {
  if (globalToastRef && globalToastRef.current) {
    globalToastRef.current.show({
      severity: 'success',
      summary: summary,
      detail: message,
      life: 3000,
      icon: 'pi pi-check-circle'
    });
  }
};

/**
 * Show error message with custom text
 */
export const showErrorMessage = (message, summary = 'Error') => {
  if (globalToastRef && globalToastRef.current) {
    globalToastRef.current.show({
      severity: 'error',
      summary: summary,
      detail: message,
      life: 4000,
      icon: 'pi pi-exclamation-triangle'
    });
  }
};

/**
 * Show info message with custom text
 */
export const showInfoMessage = (message, summary = 'Info') => {
  if (globalToastRef && globalToastRef.current) {
    globalToastRef.current.show({
      severity: 'info',
      summary: summary,
      detail: message,
      life: 3000,
      icon: 'pi pi-info-circle'
    });
  }
};

/**
 * Show warning message with custom text
 */
export const showWarningMessage = (message, summary = 'Warning') => {
  if (globalToastRef && globalToastRef.current) {
    globalToastRef.current.show({
      severity: 'warn',
      summary: summary,
      detail: message,
      life: 3000,
      icon: 'pi pi-exclamation-triangle'
    });
  }
};
