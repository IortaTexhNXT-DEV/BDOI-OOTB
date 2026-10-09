import { apiErrorMessage } from "../mastersService";

describe("apiErrorMessage", () => {
  it("does not repeat field messages the summary already states", () => {
    const json = {
      message: "Password must be at least 8 characters, contain a digit",
      errors: [
        { path: "password", message: "Password must be at least 8 characters" },
        { path: "password", message: "Password must contain a digit" },
      ],
    };
    expect(apiErrorMessage(json, 400)).toBe("Password must be at least 8 characters, contain a digit");
  });

  it("shows the field messages without the generic headline", () => {
    const json = { message: "Validation failed", errors: [{ message: "Required" }, { message: "E-mail is not valid" }] };
    expect(apiErrorMessage(json, 400)).toBe("• Required\n• E-mail is not valid");
  });

  it("falls back to a sentence for the status", () => {
    expect(apiErrorMessage({}, 500)).toBe("The system could not complete the request. Please try again.");
  });
});
