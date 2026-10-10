import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { LetterheadContext, loadLetterhead } from "./letterhead";

// afterprint never comes in a few browsers: the print container is removed after this long in any case
const AFTER_PRINT_WAIT = 120000;
// an image that does not load in this time is printed without it rather than holding the print back
const IMAGE_WAIT = 5000;

const imagesLoaded = (node) => {
  const pending = Array.from(node.getElementsByTagName("img"))
    .filter((img) => !img.complete)
    .map((img) => new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    }));
  if (!pending.length) return Promise.resolve();
  return Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, IMAGE_WAIT))]);
};

const printed = () =>
  new Promise((resolve) => {
    let timer = null;
    const done = () => {
      window.removeEventListener("afterprint", done);
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(done, AFTER_PRINT_WAIT);
    window.addEventListener("afterprint", done);
    window.print();
  });

/**
 * Print a view of its own instead of the screen behind it: the element (usually a PrintableDocument) is rendered alone
 * into a print container, with the letterhead loaded, and printed once its fonts and images are ready; only the
 * container is printed (print.scss). The document title names the file of "Save as PDF".
 *
 *   await printView(<PrintableDocument title={statementTitle} number={s.period}>...</PrintableDocument>,
 *     { title: `Incentive statement ${s.period}` });
 *
 * @param {React.ReactElement} element
 * @param {{ title?: string }} [options]
 * @returns {Promise<void>} once the print dialog has closed
 */
export const printView = async (element, { title } = {}) => {
  const letterhead = await loadLetterhead().catch(() => null);
  const host = document.createElement("div");
  host.className = "bv-print-root";
  document.body.appendChild(host);
  const root = createRoot(host);
  const pageTitle = document.title;
  try {
    flushSync(() => root.render(<LetterheadContext.Provider value={letterhead}>{element}</LetterheadContext.Provider>));
    await Promise.all([document.fonts?.ready, imagesLoaded(host)]);
    if (title) document.title = title;
    document.body.classList.add("bv-printing");
    await printed();
  } finally {
    document.body.classList.remove("bv-printing");
    document.title = pageTitle;
    root.unmount();
    host.remove();
  }
};

export default printView;
