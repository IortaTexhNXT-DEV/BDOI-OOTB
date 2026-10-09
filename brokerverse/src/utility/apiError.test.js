import { apiErrorMessage, readableError, statusMessage } from "./apiError";

describe("API error text", () => {
  it("shows the field message of a validation error, without the headline and the field path", () => {
    const body = { success: false, message: "Validation failed", errors: [{ path: "brokerSlipId", message: "At least two insurer offers are needed for a comparison" }] };
    expect(apiErrorMessage(body, 400)).toBe("At least two insurer offers are needed for a comparison");
  });

  it("lists several field messages as bullets, once each", () => {
    const body = { message: "Validation failed", errors: [{ path: "a", message: "Name is required" }, { path: "b", message: "Code is required" }, { path: "c", message: "Name is required" }] };
    expect(apiErrorMessage(body, 400)).toBe("• Name is required\n• Code is required");
  });

  it("keeps a specific message of the server and adds the reasons it does not state", () => {
    expect(apiErrorMessage({ message: "The quotation cannot be submitted", errors: [{ message: "The client has no e-mail address" }] }, 409))
      .toBe("The quotation cannot be submitted\nThe client has no e-mail address");
    expect(apiErrorMessage({ message: "Period is closed" }, 409)).toBe("Period is closed");
  });

  it("gives a sentence (or the caller's fallback) when the server says nothing", () => {
    expect(apiErrorMessage(null, 403)).toBe(statusMessage(403));
    expect(apiErrorMessage({ message: "Bad Request" }, 400, "The claim could not be saved")).toBe("The claim could not be saved");
    expect(statusMessage(502)).toMatch(/try again/);
  });

  it("turns text put together by older code into the field messages", () => {
    expect(readableError("Validation failed (brokerSlipId: At least two insurer offers are needed for a comparison)"))
      .toBe("At least two insurer offers are needed for a comparison");
    expect(readableError("Validation failed (lines[0].amount: Amount is required; lines[1].account: Account is required)"))
      .toBe("• Amount is required\n• Account is required");
    expect(readableError("Validation failed: Code is required")).toBe("Code is required");
    expect(readableError("The period is closed")).toBe("The period is closed");
  });
});
