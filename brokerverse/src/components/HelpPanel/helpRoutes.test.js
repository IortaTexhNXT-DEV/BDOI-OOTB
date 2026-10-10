import fs from "fs";
import path from "path";
import { DEFAULT_SECTION, HELP_ROUTES, helpSectionFor } from "./helpRoutes";
import { manualFile, roleChapters, supportContacts, ticketDetails } from "./index";
import { menuList } from "../SideBar/list";
import { flattenLeaves } from "../SideBar/menuTree";

const manual = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../public/help/sections.json"), "utf8"));
const ids = new Set(manual.sections.map((s) => s.id));

describe("help for this screen", () => {
  it("links only to headings of the published manual (run npm run help:build after the manual changes)", () => {
    const broken = HELP_ROUTES.filter(([, ...route]) => !route.some((id) => ids.has(id))).map(([prefix, ...route]) => `${prefix} -> ${route.join(" | ")}`);
    expect(broken).toEqual([]);
    expect(ids.has(DEFAULT_SECTION)).toBe(true);
  });
  it("takes the first section of a route that the published manual has", () => {
    expect(helpSectionFor("/product-configurator/rating").id).toBe("rating-engine");
    expect(helpSectionFor("/product-configurator/rating", new Set(["module-reference-product-configurator"])).id).toBe("module-reference-product-configurator");
    expect(helpSectionFor("/master/incentive/programs/view", new Set(["incentives"])).id).toBe("incentives");
  });
  it("every menu screen has a section of its own", () => {
    const missing = flattenLeaves(menuList)
      .map((leaf) => leaf.item.path)
      .filter((p) => p && !helpSectionFor(p).matched);
    expect(missing).toEqual([]);
  });
  it("takes the most specific section", () => {
    expect(helpSectionFor("/agent/claim").id).toBe("the-claims-list");
    expect(helpSectionFor("/agent/claimrequest/adjustersubmission/12").id).toBe("adjuster-report");
    expect(helpSectionFor("/master/generals/usermanagement/user/edit/5").id).toBe("users");
    expect(helpSectionFor("/master/finance/posting-rules").id).toBe("posting-configuration-configuration-approvals-posting-rules-account-determination");
    expect(helpSectionFor("/").id).toBe("dashboard");
    expect(helpSectionFor("/no/such/screen")).toEqual({ id: DEFAULT_SECTION, matched: false });
  });
});

describe("the manual of the edition", () => {
  const manual = { files: { pdf: "TISPH_User_Manual.pdf", word: null }, roles: { "tis-finance": { id: "tis-finance-and-general-accounting", title: "TIS Finance & General Accounting" },
    "tis-it-admin": { id: "tis-it-appsupport-admin", title: "TIS IT AppSupport / Admin" } } };
  it("offers the chapters of the user's own roles only", () => {
    expect(roleChapters(manual, ["TIS-FINANCE", "sales"])).toEqual([{ code: "tis-finance", id: "tis-finance-and-general-accounting", title: "TIS Finance & General Accounting" }]);
    expect(roleChapters(null, ["tis-finance"])).toEqual([]);
  });
  it("downloads the files the edition names", () => {
    expect(manualFile(manual, "pdf")).toBe("/help/TISPH_User_Manual.pdf");
    expect(manualFile(manual, "word")).toBeNull();
  });
});

describe("support contacts", () => {
  it("shows only what is set, and only a web address as the portal", () => {
    const rows = [
      { key: "support.email", value: " help@broker.ph " },
      { key: "support.phone", value: "" },
      { key: "support.hours", value: "8 to 5" },
      { key: "support.portal_url", value: "javascript:alert(1)" },
    ];
    expect(supportContacts(rows)).toEqual({ email: "help@broker.ph", phone: "", hours: "8 to 5", portalUrl: "" });
    expect(supportContacts([{ key: "support.portal_url", value: "https://support.example.ph" }]).portalUrl).toBe("https://support.example.ph");
  });
  it("fills the ticket with the screen, the user, the version and the time", () => {
    const text = ticketDetails({
      screen: "Claims",
      url: "https://bv.example.ph/agent/claim",
      user: { username: "carlo.estrada", displayName: "Carlo Estrada", roles: ["claims"] },
      version: "Web 0.1.0 · API 1.0.0",
      environment: "uat",
      at: "2026-10-04T08:00:00.000Z",
    });
    expect(text).toContain("Screen: Claims");
    expect(text).toContain("User: carlo.estrada (Carlo Estrada)");
    expect(text).toContain("Version: Web 0.1.0 · API 1.0.0");
    expect(text).toContain("Environment: uat");
    expect(text).toContain("Time: 2026-10-04T08:00:00.000Z");
  });
});
