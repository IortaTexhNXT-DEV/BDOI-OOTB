import fs from "fs";
import path from "path";
import { DEFAULT_SECTION, HELP_ROUTES, helpSectionFor } from "./helpRoutes";
import { supportContacts, ticketDetails } from "./index";
import { menuList } from "../SideBar/list";
import { flattenLeaves } from "../SideBar/menuTree";

const manual = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../public/help/sections.json"), "utf8"));
const ids = new Set(manual.sections.map((s) => s.id));

describe("help for this screen", () => {
  it("links only to headings of the user manual (run npm run help:build after the manual changes)", () => {
    const broken = HELP_ROUTES.filter(([, id]) => !ids.has(id)).map(([prefix, id]) => `${prefix} -> ${id}`);
    expect(broken).toEqual([]);
    expect(ids.has(DEFAULT_SECTION)).toBe(true);
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
