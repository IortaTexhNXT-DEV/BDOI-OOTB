import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import brandingService from "../../services/brandingService";
import { canPrintInFrame, printPdf } from "./printPdf";
import { printView } from "./printView";
import PrintableDocument from "./PrintableDocument";

jest.mock("../../services/brandingService", () => ({ __esModule: true, default: { letterhead: jest.fn() } }));

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

const LETTERHEAD = {
  name: "Toyota Insurance Services Philippines, Inc.", addressLines: ["31F Net Park, 5th Avenue", "Taguig City"], tin: "000-123-456-000", licence: "IC-B-1234",
  phone: "+63 2 8888 0000", email: "tisph@example.ph", website: "", logo: "data:image/png;base64,iVBORw0KGgo=",
  documents: { accent: "#eb0a1e", headingColor: "#eb0a1e", tableHeaderBg: "#eb0a1e", tableHeaderText: "#ffffff", footerText: "Authorized by the Insurance Commission", showLogo: true, logoHeight: 40 },
};

const pdfResponse = () => ({ ok: true, status: 200, blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }) });

let frames;
let frameWindow;
let userAgent;

beforeEach(() => {
  frames = [];
  frameWindow = { focus: jest.fn(), print: jest.fn() };
  userAgent = CHROME;
  jest.spyOn(navigator, "userAgent", "get").mockImplementation(() => userAgent);
  URL.createObjectURL = jest.fn(() => "blob:http://localhost/pdf");
  URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn(async () => pdfResponse());
  const create = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag, options) => {
    const node = create(tag, options);
    if (tag === "iframe") {
      Object.defineProperty(node, "contentWindow", { value: frameWindow });
      frames.push(node);
    }
    return node;
  });
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  jest.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => jest.restoreAllMocks());

const frameLoaded = async () => {
  await waitFor(() => expect(frames).toHaveLength(1));
  frames[0].dispatchEvent(new Event("load"));
};

describe("printPdf", () => {
  it("knows the browsers that print a PDF in a frame", () => {
    expect(canPrintInFrame({ userAgent: CHROME })).toBe(true);
    expect(canPrintInFrame({ userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0" })).toBe(true);
    expect(canPrintInFrame({ userAgent: SAFARI })).toBe(false);
    expect(canPrintInFrame({ userAgent: SAFARI, platform: "MacIntel", maxTouchPoints: 5 })).toBe(false);
    expect(canPrintInFrame({ userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36" })).toBe(false);
  });

  it("fetches the PDF with the session token and prints it from a hidden frame", async () => {
    localStorage.setItem("accessToken", "tok");
    const printing = printPdf("/remittance/remittances/rm_1/pdf", { fileName: "remittance-REM-1.pdf" });
    await frameLoaded();
    await expect(printing).resolves.toBe("printed");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/remittance\/remittances\/rm_1\/pdf$/), expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/pdf" }) }));
    expect(frames[0]).toHaveAttribute("src", "blob:http://localhost/pdf");
    expect(frames[0]).toHaveClass("bv-print-frame");
    expect(frameWindow.print).toHaveBeenCalledTimes(1);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("tells the caller when the print dialog opens, before printing ends", async () => {
    const onReady = jest.fn();
    frameWindow.print = jest.fn(() => expect(onReady).toHaveBeenCalledTimes(1));
    const printing = printPdf("/document-templates/receipt/rc_1", { onReady });
    await frameLoaded();
    await expect(printing).resolves.toBe("printed");
    expect(frameWindow.print).toHaveBeenCalledTimes(1);
  });

  it("opens the PDF in a tab when the browser will not print the frame", async () => {
    frameWindow.print.mockImplementation(() => { throw new Error("Blocked a frame from printing"); });
    const tab = { opener: {} };
    window.open.mockImplementation(() => tab);
    const printing = printPdf("/journal-vouchers/1/pdf");
    await frameLoaded();
    await expect(printing).resolves.toBe("opened");
    expect(window.open).toHaveBeenCalledWith("blob:http://localhost/pdf", "_blank");
    expect(tab.opener).toBeNull();
    expect(frames[0]).not.toBeInTheDocument();
  });

  it("opens a tab within the click where frames do not print (Safari), and shows the PDF in it", async () => {
    userAgent = SAFARI;
    const tab = { closed: false, location: { href: "about:blank" }, close: jest.fn() };
    window.open.mockImplementation(() => tab);
    const printing = printPdf("/document-templates/receipt/rc_1");
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    await expect(printing).resolves.toBe("opened");
    expect(tab.location.href).toBe("blob:http://localhost/pdf");
    expect(frames).toHaveLength(0);
  });

  it("saves the PDF when even a tab is refused", async () => {
    userAgent = SAFARI;
    await expect(printPdf(new Blob(["%PDF-1.4"], { type: "application/pdf" }), { fileName: "receipt.pdf" })).resolves.toBe("downloaded");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("passes on the message of the API and closes the tab it opened", async () => {
    userAgent = SAFARI;
    const tab = { closed: false, location: {}, close: jest.fn() };
    window.open.mockImplementation(() => tab);
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false, message: "You do not have permission to print this remittance" }) });
    await expect(printPdf("/remittance/remittances/rm_1/pdf")).rejects.toThrow("You do not have permission to print this remittance");
    expect(tab.close).toHaveBeenCalledTimes(1);
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob([]) });
    await expect(printPdf("/remittance/remittances/rm_1/pdf")).rejects.toThrow("The document is empty.");
  });
});

describe("printView and PrintableDocument", () => {
  it("prints a view of its own on the letterhead, alone, and removes it afterwards", async () => {
    brandingService.letterhead.mockResolvedValue(LETTERHEAD);
    const seen = {};
    jest.spyOn(window, "print").mockImplementation(() => {
      seen.printing = document.body.classList.contains("bv-printing");
      seen.title = document.title;
      seen.company = !!screen.queryByText("Toyota Insurance Services Philippines, Inc.");
      seen.number = !!screen.queryByText("No. REM-2026-00012");
      window.dispatchEvent(new Event("afterprint"));
    });
    document.title = "BrokerVerse";
    let done;
    act(() => {
      done = printView(<PrintableDocument title="Remittance Advice" number="REM-2026-00012"><p>Policies</p></PrintableDocument>, { title: "Remittance REM-2026-00012" });
    });
    // printing waits for the letterhead logo
    fireEvent.load(await screen.findByRole("img", { name: LETTERHEAD.name }));
    await act(async () => {
      await done;
    });
    expect(seen).toEqual({ printing: true, title: "Remittance REM-2026-00012", company: true, number: true });
    expect(document.body).not.toHaveClass("bv-printing");
    expect(document.title).toBe("BrokerVerse");
    expect(screen.queryByText("Remittance Advice")).toBeNull();
  });

  it("lays out the letterhead of the documents theme, the title and the footer", () => {
    localStorage.setItem("user", JSON.stringify({ userId: "usr_1", username: "r.finance", displayName: "Rosa Finance" }));
    render(<PrintableDocument title="Remittance Advice" number="REM-2026-00012" letterhead={LETTERHEAD}><p>Policies</p></PrintableDocument>);
    expect(screen.getByRole("img", { name: LETTERHEAD.name })).toHaveStyle({ height: "40px" });
    expect(screen.getByText("31F Net Park, 5th Avenue")).toBeInTheDocument();
    expect(screen.getByText("TIN 000-123-456-000 · IC-B-1234")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remittance Advice" })).toBeInTheDocument();
    expect(screen.getByText("Authorized by the Insurance Commission")).toBeInTheDocument();
    expect(screen.getByText(/^Printed .+ by Rosa Finance$/)).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveStyle({ "--bv-doc-accent": "#eb0a1e" });
    localStorage.clear();
  });
});
