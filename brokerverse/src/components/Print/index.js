/**
 * Printing that works on every screen:
 *   printPdf(path)       a PDF of the API, printed from a hidden frame (a new tab where the browser cannot)
 *   printView(element)   a printable view of the page's own (PrintableDocument on the letterhead), printed alone
 * Never window.print() of the screen: dialogs, side panels and lists do not print as documents.
 */
import "./print.scss";

export { printPdf, canPrintInFrame } from "./printPdf";
export { printView } from "./printView";
export { default as PrintableDocument } from "./PrintableDocument";
export { loadLetterhead, useLetterhead, LetterheadContext } from "./letterhead";
