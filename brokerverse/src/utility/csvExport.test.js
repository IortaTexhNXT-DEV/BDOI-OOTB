import { downloadCsv, toCsv } from "./csvExport";

describe("csvExport", () => {
  it("writes a header and one line per row, quoting every value", () => {
    const columns = [{ header: "Policy", field: "policyNumber" }, { header: "Premium", field: (r) => r.premium * 2 }, { header: "Note", field: "note" }];
    expect(toCsv([{ policyNumber: "POL-1", premium: 10, note: 'Say "hi", Ñ' }, { policyNumber: "POL-2", premium: 0 }], columns))
      .toBe('"Policy","Premium","Note"\r\n"POL-1","20","Say ""hi"", Ñ"\r\n"POL-2","0",""');
  });

  it("downloads the file with a byte order mark so that Excel reads UTF-8", async () => {
    let blob;
    URL.createObjectURL = jest.fn((b) => { blob = b; return "blob:csv"; });
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadCsv("queue.csv", [{ a: "₱1" }], [{ header: "A", field: "a" }]);
    expect(click).toHaveBeenCalled();
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await new Response(blob).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await new Response(blob).text()).toBe('"A"\r\n"₱1"');
    click.mockRestore();
  });
});
