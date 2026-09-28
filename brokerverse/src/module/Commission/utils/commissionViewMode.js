export const COMMISSION_VIEW_MODE_KEY = "COMMISSION_VIEW_MODE";
export const COMMISSION_VIEW_MODE_EVENT = "commission-view-mode-changed";

export const getCommissionViewMode = () => {
  try {
    const mode = localStorage.getItem(COMMISSION_VIEW_MODE_KEY);
    return mode === "management" ? "management" : "accounting";
  } catch {
    return "accounting";
  }
};

export const setCommissionViewMode = (mode) => {
  const next = mode === "management" ? "management" : "accounting";
  try {
    localStorage.setItem(COMMISSION_VIEW_MODE_KEY, next);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(COMMISSION_VIEW_MODE_EVENT, { detail: next })
  );
  return next;
};
