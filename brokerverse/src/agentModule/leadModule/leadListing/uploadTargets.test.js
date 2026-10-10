import i18n from "../../../i18n";
import { uploadTargets } from "./index";

jest.mock("../../../services/leadService", () => ({ __esModule: true, default: {} }));

describe("Prospects bulk upload", () => {
  it("offers the prospects file and the TFS account file, each with its template and importer", () => {
    expect(uploadTargets(i18n.t.bind(i18n))).toEqual([
      { label: "Prospects", templatePath: "/leads/bulk-upload/template", uploadPath: "/leads/bulk-upload" },
      { label: "TFS accounts", templatePath: "/leads/tfs-import/template", uploadPath: "/leads/tfs-import" },
    ]);
  });
});
