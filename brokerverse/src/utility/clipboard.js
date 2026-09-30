/**
 * Put text on the clipboard. The Clipboard API exists only in secure contexts (https or localhost), so a page served
 * over plain http falls back to a hidden text area and the copy command. Resolves true when the text was copied.
 */
export const copyText = async (text) => {
  const value = String(text ?? "");
  if (!value) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // permission refused or document not focused: try the fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return Boolean(ok);
  } catch {
    return false;
  }
};

export default copyText;
