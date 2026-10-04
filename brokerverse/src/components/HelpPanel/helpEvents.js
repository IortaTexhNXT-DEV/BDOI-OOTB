/** Opening the Help panel from anywhere (avatar menu > Help): the panel (components/HelpPanel) listens for this event. */
export const OPEN_HELP_EVENT = "bv:open-help";

export const openHelp = () => window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT));

/** True when a key press goes into a text field (the "?" and "/" shortcuts then type the character instead). */
export const isTyping = (target) => {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"].includes(type);
  }
  return false;
};
