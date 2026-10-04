import { statusLabel, statusSeverity } from "./statusSeverity";

describe("status severity", () => {
  it("maps statuses of every module to one scheme", () => {
    expect(statusSeverity("Active")).toBe("success");
    expect(statusSeverity("ConvertedToPolicy")).toBe("success");
    expect(statusSeverity("PendingCustomer")).toBe("warning");
    expect(statusSeverity("in_review")).toBe("info");
    expect(statusSeverity("Rejected")).toBe("danger");
    expect(statusSeverity("cancelled")).toBe("secondary");
    expect(statusSeverity("something new")).toBe("info");
    expect(statusSeverity("")).toBe("secondary");
  });

  it("writes a status as words", () => {
    expect(statusLabel("PendingCustomer")).toBe("Pending Customer");
    expect(statusLabel("in-review")).toBe("In review");
  });
});
