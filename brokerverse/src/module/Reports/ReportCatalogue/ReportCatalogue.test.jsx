import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import reportsService from "../../../services/reportsService";
import ReportCatalogue from ".";
import { categoryOf } from "./reportCategories";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }));
jest.mock("../../../services/reportsService", () => ({ __esModule: true, default: { getCatalogue: jest.fn() } }));
jest.mock("../ReportScreen", () => () => null);

const CATALOGUE = [
  { code: "production-register", name: "Production Register", category: "operational", description: "Policies issued in the period" },
  { code: "claims-ageing", name: "Claims Ageing", category: "operational", description: "Open claims by age bucket" },
  { code: "bir-vat-summary", name: "VAT Summary", category: "financial", description: "Output and input VAT" },
  { code: "brand-new-report", name: "Brand New Report", category: "financial", description: "Not mapped yet" },
];

const renderPage = async (list = CATALOGUE) => {
  reportsService.getCatalogue.mockResolvedValue(list);
  render(
    <MemoryRouter>
      <ReportCatalogue />
    </MemoryRouter>
  );
  await screen.findByText(list[0]?.name || "reports.centre.none");
};

const rail = () => screen.getByRole("navigation", { name: /categories/i });
const rowNames = () => screen.queryAllByRole("link").filter((a) => (a.getAttribute("href") || "").startsWith("/reports/run/")).map((a) => a.textContent);

describe("ReportCatalogue (report centre)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("USER_ID", "u1");
    mockNavigate.mockReset();
  });

  it("maps codes to categories, unknown ones to Other", () => {
    expect(categoryOf("bir-vat-summary")).toBe("tax");
    expect(categoryOf("nope")).toBe("other");
  });

  it("lists only the reports the API returns for the user (permission filtering is server side)", async () => {
    await renderPage(CATALOGUE.slice(0, 2));
    expect(rowNames()).toEqual(["Production Register", "Claims Ageing"]);
    expect(screen.queryByText("VAT Summary")).not.toBeInTheDocument();
    // categories without a visible report are not offered
    expect(within(rail()).queryByText(/Tax/)).not.toBeInTheDocument();
  });

  it("filters by name, description and code", async () => {
    await renderPage();
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "vat" } });
    expect(rowNames()).toEqual(["VAT Summary"]);
    fireEvent.change(search, { target: { value: "age bucket" } });
    expect(rowNames()).toEqual(["Claims Ageing"]);
    fireEvent.change(search, { target: { value: "production-reg" } });
    expect(rowNames()).toEqual(["Production Register"]);
  });

  it("focuses the search on /", async () => {
    await renderPage();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("filters by category from the rail, with counts", async () => {
    await renderPage();
    const claims = within(rail()).getByRole("button", { name: /^Claims/ });
    expect(claims).toHaveTextContent("1");
    fireEvent.click(claims);
    expect(rowNames()).toEqual(["Claims Ageing"]);
    fireEvent.click(within(rail()).getByRole("button", { name: /^Other/ }));
    expect(rowNames()).toEqual(["Brand New Report"]);
  });

  it("keeps favourites per user in localStorage", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /(to|from) favourites/i })[1]);
    expect(JSON.parse(localStorage.getItem("bv.reports.favourites.u1"))).toEqual(["claims-ageing"]);
    fireEvent.click(within(rail()).getByRole("button", { name: /^Favourites/ }));
    expect(rowNames()).toEqual(["Claims Ageing"]);
  });

  it("restores favourites on the next visit", async () => {
    localStorage.setItem("bv.reports.favourites.u1", JSON.stringify(["bir-vat-summary"]));
    await renderPage();
    fireEvent.click(within(rail()).getByRole("button", { name: /^Favourites/ }));
    expect(rowNames()).toEqual(["VAT Summary"]);
  });

  it("records a report as recently run when opened", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("link", { name: "VAT Summary" }));
    expect(mockNavigate).toHaveBeenCalledWith("/reports/run/bir-vat-summary");
    fireEvent.click(screen.getByRole("button", { name: /Production Register/ }));
    expect(JSON.parse(localStorage.getItem("bv.reports.recent.u1"))).toEqual(["production-register", "bir-vat-summary"]);
    fireEvent.click(within(rail()).getByRole("button", { name: /^Recently run/ }));
    expect(rowNames()).toEqual(["Production Register", "VAT Summary"]);
  });

  it("works when localStorage throws", async () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /(to|from) favourites/i })[0]);
    fireEvent.click(within(rail()).getByRole("button", { name: /^Favourites/ }));
    expect(rowNames()).toEqual(["Production Register"]);
    spy.mockRestore();
    set.mockRestore();
  });
});
