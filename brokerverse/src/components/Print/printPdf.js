import i18n from "../../i18n";
import authService from "../../services/authService";
import { BASE_URL } from "../../utility/constant";
import { apiErrorMessage } from "../../utility/apiError";

// a PDF viewer has to finish laying out the document after its frame has loaded before it prints all of it
const VIEWER_DELAY = 300;
const LOAD_TIMEOUT = 20000;
const KEEP_URL = 60000;

/**
 * Whether this browser prints a PDF shown in a frame. Safari and phones and tablets do not (a blank page or nothing),
 * so the PDF opens in a tab of its own there.
 */
export const canPrintInFrame = (nav = typeof navigator === "undefined" ? null : navigator) => {
  const ua = nav?.userAgent || "";
  const ios = /iP(hone|ad|od)/.test(ua) || (nav?.platform === "MacIntel" && nav?.maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR)\//.test(ua);
  return !(ios || safari || /Android/.test(ua));
};

const fetchPdf = async (source) => {
  if (source instanceof Blob) return source;
  if (typeof source === "function") return source();
  const response = await fetch(/^https?:/i.test(source) ? source : `${BASE_URL}${source}`, {
    headers: { Accept: "application/pdf", ...authService.getAuthHeader() },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body, response.status, i18n.t("print.failed")));
  }
  return response.blob();
};

// the frame of the last print stays until the next print: removing it while the print dialog is open cancels printing
let last = null;

const dropFrame = () => {
  if (!last) return;
  last.node.remove();
  URL.revokeObjectURL(last.url);
  last = null;
};

const printInFrame = (url, onReady) =>
  new Promise((resolve, reject) => {
    dropFrame();
    const node = document.createElement("iframe");
    node.className = "bv-print-frame";
    node.title = i18n.t("print.frameTitle");
    node.setAttribute("aria-hidden", "true");
    node.tabIndex = -1;
    const fail = (error) => {
      clearTimeout(timer);
      node.remove();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error(i18n.t("print.failed"))), LOAD_TIMEOUT);
    node.addEventListener("load", () => {
      clearTimeout(timer);
      setTimeout(() => {
        try {
          node.contentWindow.focus();
          onReady?.();
          node.contentWindow.print();
          last = { node, url };
          resolve();
        } catch (e) {
          fail(e);
        }
      }, VIEWER_DELAY);
    }, { once: true });
    node.src = url;
    document.body.appendChild(node);
  });

// open the PDF in a tab (the one opened during the click when there is one), else save it
const deliver = (url, fileName, tab) => {
  if (tab && !tab.closed) {
    tab.location.href = url;
    return "opened";
  }
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return "opened";
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return "downloaded";
};

/**
 * Print a PDF of the API: fetched with the session token, shown in a hidden frame and printed from there. Where the
 * browser cannot print a framed PDF, or refuses to, the PDF opens in a new tab for printing; when the tab is blocked it
 * is saved instead. Call it straight from the click handler, before any await, so that a tab it needs opens within the
 * click and is not taken for a pop-up.
 *
 *   printPdf(`/remittance/remittances/${id}/pdf`, { fileName: `remittance-${no}.pdf` }).catch((e) => notifyError(e.message));
 *
 * @param {string|Blob|function(): Promise<Blob>} source API path (as the services write it), a PDF, or a function
 *   that fetches one
 * @param {{ fileName?: string, onReady?: function(): void }} [options] name of the file when the PDF has to be saved;
 *   onReady is called once the document is ready and the print dialog (or its tab) opens, so the button that asked for
 *   it can stop showing that it is busy while the user is still in the print dialog
 * @returns {Promise<"printed"|"opened"|"downloaded">} how the document reached the user; rejects with the API's
 *   message when the document could not be fetched
 */
export const printPdf = async (source, { fileName = "document.pdf", onReady } = {}) => {
  const framed = canPrintInFrame();
  const tab = framed ? null : window.open("", "_blank");
  let pdf;
  try {
    pdf = await fetchPdf(source);
    if (!pdf || !pdf.size) throw new Error(i18n.t("print.empty"));
  } catch (e) {
    if (tab) tab.close();
    throw e;
  }
  const url = URL.createObjectURL(pdf.type === "application/pdf" ? pdf : new Blob([pdf], { type: "application/pdf" }));
  if (framed) {
    try {
      await printInFrame(url, onReady);
      return "printed";
    } catch {
      // the browser would not print the frame: the PDF opens in a tab instead
    }
  }
  onReady?.();
  const how = deliver(url, fileName, tab);
  setTimeout(() => URL.revokeObjectURL(url), KEEP_URL);
  return how;
};

export default printPdf;
